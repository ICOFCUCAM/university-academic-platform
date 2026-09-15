// ---------------------------------------------------------------------------
// THE STORE, AGAINST POSTGRES.
//
// Reads the HOST's courses, lecturers, students and enrolment — whatever the
// university already has — and keeps this platform's own objects in the
// `ls_*` tables that `docs/integration/001_lecture_studio.sql` creates.
//
// NOT VERIFIED AGAINST A DATABASE. This environment cannot reach one, so every
// query below is written from the schema in that migration and has never
// returned a row. `data/conformance.mjs` is the suite it must pass before
// anybody points a university at it — run it against a real project with
// `node src/lib/data/supabase.conformance.mjs`, and until that passes this
// adapter is a draft.
//
// RLS DOES THE REAL WORK. These queries are written as the signed-in person:
// no service key, no `bypass`. If a query returns nothing where it should
// return something, the policy is what to read — not this file.
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Artefact, ArtefactVersion, Assignment, Course, Department, Enrolment, Faculty,
  Lecture, Person, QuizAttempt, Reading, StudyAid, Submission, TutorConversation,
  TutorMessage, University,
} from '../domain/types';
import type { LectureExtract } from '../knowledge/types';
import type { ProgressRecord } from '../study/progress';
import type { Voice } from '../voice/voices';
import type { AuditEntry } from '../audit/audit';
import type { CarriedSegment, LiveSegment, LiveSession } from '../live/types';
import type { Recall } from '../study/repetition';
import type { RunCost, UsageRecord } from '../billing/usage';
import type { Notification } from '../notify/notifications';
import type { Certificate } from '../credential/certificate';
import type { Store } from './store';

type Row = Record<string, unknown>;

/** snake_case in, camelCase out. One place, so a column rename is one edit. */
const camel = (row: Row): Row => Object.fromEntries(
  Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), value]),
);
const snake = (object: Row): Row => Object.fromEntries(
  Object.entries(object)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), value]),
);

export interface SupabaseStoreOptions {
  url: string;
  /** The PUBLISHABLE key, and the caller's own access token. Never a service key. */
  key: string;
  accessToken?: string;
  /** The institution, which this platform does not own. */
  university: University;
}

export function createSupabaseStore(options: SupabaseStoreOptions): Store {
  const client: SupabaseClient = createClient(options.url, options.key, {
    global: options.accessToken
      ? { headers: { Authorization: `Bearer ${options.accessToken}` } }
      : undefined,
    auth: { persistSession: false },
  });

  // The builder's type is deliberately loose here: these are the only lines in
  // the platform that speak SQL-by-proxy, and a typed row map for forty tables
  // would be a second schema to keep in step with the migration.
  type Query = { eq(column: string, value: unknown): Query; is(column: string, value: unknown): Query;
    order(column: string, options?: { ascending?: boolean }): Query;
    then: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>['then'] };

  const rows = async (table: string, build?: (q: Query) => Query) => {
    const query = client.from(table).select('*') as unknown as Query;
    const result = await (build ? build(query) : query);
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    return (result.data ?? []).map((row) => camel(row as Row));
  };

  const one = async (table: string, id: string) => {
    const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ? camel(data as Row) : null;
  };

  const upsert = async (table: string, object: Row) => {
    const { error } = await client.from(table).upsert(snake(object));
    if (error) throw new Error(`${table}: ${error.message}`);
  };

  return {
    id: 'icof',

    // THE HOST'S UNIVERSITY, PLUS WHAT IS THIS PLATFORM'S OWN. The name and
    // the identity come from the deployment's configuration and are never
    // written back — mounted inside somebody else's system, this platform does
    // not edit their institution. The standard voice is ours, so it lives in
    // our own settings row.
    async university() {
      const settings = (await one('ls_settings', 'university')) as { standardVoice?: Voice } | null;
      return settings?.standardVoice
        ? { ...options.university, standardVoice: settings.standardVoice }
        : options.university;
    },
    async saveUniversity(university) {
      await upsert('ls_settings', {
        id: 'university', standardVoice: university.standardVoice ?? null,
      } as unknown as Row);
      return university;
    },

    // ---- THE HOST'S OWN TABLES -----------------------------------------
    async faculties() {
      return (await rows('schools')).map((row) => ({
        id: String(row.id), universityId: options.university.id,
        name: String(row.name ?? ''), code: row.code as string | undefined,
      })) as Faculty[];
    },
    async departments() {
      return (await rows('departments')).map((row) => ({
        id: String(row.id), facultyId: String(row.schoolId ?? row.facultyId ?? ''),
        name: String(row.name ?? ''), code: row.code as string | undefined,
      })) as Department[];
    },

    async courses() {
      const [courses, offerings] = await Promise.all([rows('courses'), rows('course_offerings')]);
      return courses.map((row) => {
        // WHO TEACHES IT THIS TERM, falling back to the catalogue — which is
        // exactly what the host's own `my_teaching` view does, and for the
        // same reason: until a term is set up, the catalogue is the only
        // record of who teaches what.
        const thisTerm = offerings
          .filter((o) => o.courseId === row.id && o.lecturerId)
          .map((o) => String(o.lecturerId));
        const lecturerIds = thisTerm.length ? thisTerm
          : row.lecturerId ? [String(row.lecturerId)] : [];
        return {
          id: String(row.id),
          departmentId: row.departmentId as string | undefined,
          code: String(row.code ?? ''),
          title: String(row.title ?? ''),
          creditUnit: row.creditUnit as number | undefined,
          description: row.description as string | undefined,
          lecturerIds,
          status: 'running',
          originalLanguage: (row.language as string) ?? 'en',
        } as Course;
      });
    },
    async course(id) { return (await this.courses()).find((c) => c.id === id) ?? null; },
    async coursesFor(personId) {
      const all = await this.courses();
      const taught = all.filter((c) => c.lecturerIds.includes(personId));
      if (taught.length) return taught;
      const mine = await this.enrolmentsOf(personId);
      return all.filter((c) => mine.some((e) => e.courseId === c.id && e.status !== 'withdrawn'));
    },
    async saveCourse(course) {
      // THE COURSE IS THE HOST'S. This platform does not create or retire one;
      // it writes back only what belongs to it, and there is nothing of its
      // own on a course row.
      return course;
    },

    async people() {
      const [lecturers, students] = await Promise.all([rows('lecturers'), rows('students')]);
      return [
        ...lecturers.map((row) => ({
          id: String(row.authUserId ?? row.id), name: String(row.name ?? row.fullName ?? ''),
          email: row.email as string | undefined, role: 'lecturer' as const,
        })),
        ...students.map((row) => ({
          id: String(row.authUserId ?? row.id), name: String(row.name ?? row.fullName ?? ''),
          email: row.email as string | undefined, role: 'student' as const,
        })),
      ] as Person[];
    },
    async person(id) {
      const profile = await one('ls_profiles', id);
      const found = (await this.people()).find((p) => p.id === id) ?? null;
      if (!found) return null;
      return {
        ...found,
        workingLanguage: profile?.workingLanguage as string | undefined,
        voicePreference: profile?.voicePreference as string | undefined,
        audioSpeed: profile?.audioSpeed as number | undefined,
        plan: profile?.plan as Person['plan'],
        voiceConsent: profile?.voiceConsent as Person['voiceConsent'],
        accessibility: profile?.accessibility as Person['accessibility'],
        workingLanguageHistory: (profile?.workingLanguageHistory ?? []) as Person['workingLanguageHistory'],
      };
    },
    async savePerson(person) {
      // ONLY THE PLATFORM'S OWN HALF. A person's name and email belong to the
      // university's records; what is written here is the learning profile.
      await upsert('ls_profiles', {
        personId: person.id,
        workingLanguage: person.workingLanguage,
        voicePreference: person.voicePreference,
        audioSpeed: person.audioSpeed,
        plan: person.plan,
        voiceConsent: person.voiceConsent,
        accessibility: person.accessibility,
        workingLanguageHistory: person.workingLanguageHistory ?? [],
      });
      return person;
    },

    async enrolments(courseId) {
      return (await rows('course_roll', (q) => q.eq('course_id', courseId))).map((row) => ({
        id: String(row.enrollmentId ?? row.id), courseId: String(row.courseId),
        studentId: String(row.studentId), status: (row.status ?? 'registered') as Enrolment['status'],
      }));
    },
    async enrolmentFor(courseId, studentId) {
      return (await this.enrolments(courseId)).find((e) => e.studentId === studentId) ?? null;
    },
    async enrolmentsOf(studentId) {
      return (await rows('course_roll', (q) => q.eq('student_id', studentId))).map((row) => ({
        id: String(row.enrollmentId ?? row.id), courseId: String(row.courseId),
        studentId: String(row.studentId), status: (row.status ?? 'registered') as Enrolment['status'],
      }));
    },
    async saveEnrolment(enrolment) {
      // Enrolment is the registry's, in the host's own tables and its own
      // screens. This platform reads it and never writes it.
      return enrolment;
    },

    // ---- THIS PLATFORM'S OWN TABLES ------------------------------------
    async lectures(courseId) {
      return (await rows('ls_lectures', (q) => q.eq('course_id', courseId).order('sequence'))) as unknown as Lecture[];
    },
    async lecture(id) { return (await one('ls_lectures', id)) as unknown as Lecture | null; },
    async saveLecture(lecture) { await upsert('ls_lectures', lecture as unknown as Row); return lecture; },

    async artefacts(lectureId) {
      return (await rows('ls_artefacts', (q) => q.eq('lecture_id', lectureId))) as unknown as Artefact[];
    },
    async artefactsForCourse(courseId) {
      return (await rows('ls_artefacts', (q) => q.eq('course_id', courseId))) as unknown as Artefact[];
    },
    async artefact(id) { return (await one('ls_artefacts', id)) as unknown as Artefact | null; },
    async artefactsByMediaKey(key) {
      return (await rows('ls_artefacts', (q) => q.eq('media_path', key))) as unknown as Artefact[];
    },
    async saveArtefact(artefact) { await upsert('ls_artefacts', artefact as unknown as Row); return artefact; },
    async deleteArtefact(id) {
      const { error } = await client.from('ls_artefacts').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },

    async versions(artefactId) {
      return (await rows('ls_artefact_versions',
        (q) => q.eq('artefact_id', artefactId).order('version'))) as unknown as ArtefactVersion[];
    },
    async addVersion(version) { await upsert('ls_artefact_versions', version as unknown as Row); return version; },

    async extracts(courseId) {
      const found = await rows('ls_lecture_knowledge', (q) => q.eq('course_id', courseId));
      const lectures = await this.lectures(courseId);
      return found.map((row) => {
        const lecture = lectures.find((l) => l.id === row.lectureId);
        return {
          lectureId: String(row.lectureId),
          lectureSequence: lecture?.sequence ?? 0,
          lectureTitle: lecture?.title ?? '',
          nodes: (row.nodes ?? []) as LectureExtract['nodes'],
        };
      });
    },
    async saveExtract(courseId, extract) {
      await upsert('ls_lecture_knowledge', {
        lectureId: extract.lectureId, courseId, nodes: extract.nodes,
      });
    },

    async studyAids(courseId) {
      return (await rows('ls_study_aids', (q) => q.eq('course_id', courseId))) as unknown as StudyAid[];
    },
    async studyAidById(id) { return (await one('ls_study_aids', id)) as unknown as StudyAid | null; },
    async saveStudyAid(aid) { await upsert('ls_study_aids', aid as unknown as Row); return aid; },

    async progress(courseId, personId) {
      return (await rows('ls_progress', (q) => personId
        ? q.eq('course_id', courseId).eq('person_id', personId)
        : q.eq('course_id', courseId))) as unknown as ProgressRecord[];
    },
    async recordProgress(record) { await upsert('ls_progress', record as unknown as Row); return record; },

    async attempts(studyAidId, personId) {
      return (await rows('ls_quiz_attempts', (q) => personId
        ? q.eq('study_aid_id', studyAidId).eq('person_id', personId)
        : q.eq('study_aid_id', studyAidId))) as unknown as QuizAttempt[];
    },
    async saveAttempt(attempt) { await upsert('ls_quiz_attempts', attempt as unknown as Row); return attempt; },

    async liveSessions(courseId) {
      return (await rows('ls_live_sessions', (q) => courseId
        ? q.eq('course_id', courseId) : q)) as unknown as LiveSession[];
    },
    async liveSession(id) { return (await one('ls_live_sessions', id)) as unknown as LiveSession | null; },
    async saveLiveSession(session) { await upsert('ls_live_sessions', session as unknown as Row); return session; },
    async liveSegments(sessionId) {
      const found = (await rows('ls_live_segments', (q) => q.eq('session_id', sessionId))) as unknown as LiveSegment[];
      return found.sort((a, b) => a.sequence - b.sequence);
    },
    async saveLiveSegment(segment) { await upsert('ls_live_segments', segment as unknown as Row); return segment; },
    async carriedSegments(sessionId, language) {
      const found = (await rows('ls_live_carried', (q) => language
        ? q.eq('session_id', sessionId).eq('language', language)
        : q.eq('session_id', sessionId))) as unknown as CarriedSegment[];
      return found.sort((a, b) => a.sequence - b.sequence);
    },
    async saveCarried(carried) { await upsert('ls_live_carried', carried as unknown as Row); return carried; },

    async auditEntries(courseId) {
      // `seq` is the table's own bigserial: it breaks a tie between two acts
      // in the same millisecond by which was written first. See memory.ts.
      const found = (await rows('ls_audit', (q) => courseId
        ? q.eq('course_id', courseId) : q)) as unknown as (AuditEntry & { seq?: number })[];
      return found.sort((a, b) =>
        b.at.localeCompare(a.at) || (b.seq ?? 0) - (a.seq ?? 0));
    },
    async appendAudit(entry) { await upsert('ls_audit', entry as unknown as Row); },

    async recalls(personId, studyAidId) {
      return (await rows('ls_recalls', (q) => studyAidId
        ? q.eq('person_id', personId).eq('study_aid_id', studyAidId)
        : q.eq('person_id', personId))) as unknown as Recall[];
    },
    async saveRecall(recall) { await upsert('ls_recalls', recall as unknown as Row); return recall; },

    async costs(courseId) {
      return (await rows('ls_run_costs', (q) => q.eq('course_id', courseId))) as unknown as RunCost[];
    },
    async recordCost(cost) { await upsert('ls_run_costs', cost as unknown as Row); },
    async usage(personId) {
      return (await rows('ls_usage', (q) => q.eq('person_id', personId))) as unknown as UsageRecord[];
    },
    async recordUsage(record) { await upsert('ls_usage', record as unknown as Row); },

    async notifications(personId) {
      return (await rows('ls_notifications',
        (q) => q.eq('person_id', personId).order('at', { ascending: false }))) as unknown as Notification[];
    },
    async notify(notification) { await upsert('ls_notifications', notification as unknown as Row); },
    async markNotificationsRead(personId) {
      const { error } = await client.from('ls_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('person_id', personId).is('read_at', null);
      if (error) throw new Error(error.message);
    },

    async certificates(courseId, personId) {
      return (await rows('ls_certificates', (q) => {
        let query = q;
        if (courseId) query = query.eq('course_id', courseId);
        if (personId) query = query.eq('student_id', personId);
        return query;
      })) as unknown as Certificate[];
    },
    async certificateByCode(code) {
      const found = await rows('ls_certificates', (q) => q.eq('code', code.toUpperCase()));
      return (found[0] as unknown as Certificate) ?? null;
    },
    async saveCertificate(certificate) {
      await upsert('ls_certificates', certificate as unknown as Row);
      return certificate;
    },

    async readings(courseId) {
      return (await rows('ls_readings', (q) => q.eq('course_id', courseId))) as unknown as Reading[];
    },
    async saveReading(reading) { await upsert('ls_readings', reading as unknown as Row); return reading; },

    async assignments(courseId) {
      return (await rows('ls_assignments', (q) => q.eq('course_id', courseId))) as unknown as Assignment[];
    },
    async assignment(id) { return (await one('ls_assignments', id)) as unknown as Assignment | null; },
    async saveAssignment(assignment) { await upsert('ls_assignments', assignment as unknown as Row); return assignment; },
    async submissions(assignmentId, studentId) {
      return (await rows('ls_submissions', (q) => studentId
        ? q.eq('assignment_id', assignmentId).eq('student_id', studentId)
        : q.eq('assignment_id', assignmentId))) as unknown as Submission[];
    },
    async submissionById(id) { return (await one('ls_submissions', id)) as unknown as Submission | null; },
    async saveSubmission(submission) { await upsert('ls_submissions', submission as unknown as Row); return submission; },

    // ---- THE COURSE AI'S CONVERSATIONS, in the host's own tables --------
    async conversations(courseId, studentId) {
      return (await rows('tutor_conversations',
        (q) => q.eq('course_id', courseId).eq('student_id', studentId))) as unknown as TutorConversation[];
    },
    async saveConversation(conversation) {
      await upsert('tutor_conversations', conversation as unknown as Row);
      return conversation;
    },
    async messages(conversationId) {
      return (await rows('tutor_messages',
        (q) => q.eq('conversation_id', conversationId))) as unknown as TutorMessage[];
    },
    async saveMessage(message) { await upsert('tutor_messages', message as unknown as Row); return message; },
  };
}
