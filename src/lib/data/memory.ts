// ---------------------------------------------------------------------------
// THE STANDALONE STORE.
//
// In process, with an optional JSON snapshot on disk so a demonstration
// survives a restart. It is deliberately simple: a university buying this
// platform will point it at a database, and the interface is what they
// implement — not this file.
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Artefact, ArtefactVersion, Assignment, Course, Department, Enrolment, Faculty,
  Lecture, Person, QuizAttempt, Reading, StudyAid, Submission, TutorConversation,
  TutorMessage, University,
} from '../domain/types';
import type { ProgressRecord } from '../study/progress';
import type { Recall } from '../study/repetition';
import type { RunCost, UsageRecord } from '../billing/usage';
import type { Notification } from '../notify/notifications';
import type { Certificate } from '../credential/certificate';
import type { LectureExtract } from '../knowledge/types';
import type { Store } from './store';

export interface Snapshot {
  university: University;
  faculties: Faculty[];
  departments: Department[];
  courses: Course[];
  people: Person[];
  enrolments: Enrolment[];
  lectures: Lecture[];
  artefacts: Artefact[];
  versions: ArtefactVersion[];
  extracts: Record<string, LectureExtract[]>;
  studyAids: StudyAid[];
  progress: ProgressRecord[];
  attempts: QuizAttempt[];
  recalls: Recall[];
  costs: RunCost[];
  usage: UsageRecord[];
  notifications: Notification[];
  certificates: Certificate[];
  readings: Reading[];
  assignments: Assignment[];
  submissions: Submission[];
  conversations: TutorConversation[];
  messages: TutorMessage[];
}

const DIR = process.env.ACADEMIC_DATA_DIR;
const FILE = DIR ? join(DIR, 'workspace.json') : null;

function persist(snapshot: Snapshot) {
  if (!FILE || !DIR) return;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(snapshot, null, 2));
}

export function createMemoryStore(initial: Snapshot): Store {
  const db: Snapshot = FILE && existsSync(FILE)
    ? (JSON.parse(readFileSync(FILE, 'utf8')) as Snapshot)
    : initial;

  const save = () => persist(db);
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

  return {
    id: 'memory',

    async university() { return clone(db.university); },
    async faculties() { return clone(db.faculties); },
    async departments() { return clone(db.departments); },

    async courses() { return clone(db.courses); },
    async course(id) { return clone(db.courses.find((c) => c.id === id) ?? null); },
    async coursesFor(personId) {
      const taught = db.courses.filter((c) => c.lecturerIds.includes(personId));
      if (taught.length) return clone(taught);
      const enrolled = db.enrolments
        .filter((e) => e.studentId === personId && e.status !== 'withdrawn')
        .map((e) => e.courseId);
      return clone(db.courses.filter((c) => enrolled.includes(c.id)));
    },
    async saveCourse(course) {
      const at = db.courses.findIndex((c) => c.id === course.id);
      if (at >= 0) db.courses[at] = course; else db.courses.push(course);
      save();
      return clone(course);
    },

    async people() { return clone(db.people); },
    async person(id) { return clone(db.people.find((p) => p.id === id) ?? null); },
    async savePerson(person) {
      const at = db.people.findIndex((p) => p.id === person.id);
      if (at >= 0) db.people[at] = person; else db.people.push(person);
      save();
      return clone(person);
    },

    async enrolments(courseId) { return clone(db.enrolments.filter((e) => e.courseId === courseId)); },
    async enrolmentFor(courseId, studentId) {
      return clone(db.enrolments.find((e) => e.courseId === courseId && e.studentId === studentId) ?? null);
    },
    async enrolmentsOf(studentId) { return clone(db.enrolments.filter((e) => e.studentId === studentId)); },
    async saveEnrolment(enrolment) {
      const at = db.enrolments.findIndex((e) => e.id === enrolment.id);
      if (at >= 0) db.enrolments[at] = enrolment; else db.enrolments.push(enrolment);
      save();
      return clone(enrolment);
    },

    async lectures(courseId) {
      return clone(db.lectures.filter((l) => l.courseId === courseId).sort((a, b) => a.sequence - b.sequence));
    },
    async lecture(id) { return clone(db.lectures.find((l) => l.id === id) ?? null); },
    async saveLecture(lecture) {
      const at = db.lectures.findIndex((l) => l.id === lecture.id);
      if (at >= 0) db.lectures[at] = lecture; else db.lectures.push(lecture);
      save();
      return clone(lecture);
    },

    async artefacts(lectureId) { return clone(db.artefacts.filter((a) => a.lectureId === lectureId)); },
    async artefactsForCourse(courseId) { return clone(db.artefacts.filter((a) => a.courseId === courseId)); },
    async artefact(id) { return clone(db.artefacts.find((a) => a.id === id) ?? null); },
    async artefactsByMediaKey(key) {
      return clone(db.artefacts.filter((a) => a.mediaPath === key
        || a.parts?.some((part) => part.mediaPath === key)));
    },
    async saveArtefact(artefact) {
      const at = db.artefacts.findIndex((a) => a.id === artefact.id);
      if (at >= 0) db.artefacts[at] = artefact; else db.artefacts.push(artefact);
      save();
      return clone(artefact);
    },
    async deleteArtefact(id) {
      db.artefacts = db.artefacts.filter((a) => a.id !== id);
      db.versions = db.versions.filter((v) => v.artefactId !== id);
      save();
    },

    async versions(artefactId) {
      return clone(db.versions.filter((v) => v.artefactId === artefactId).sort((a, b) => a.version - b.version));
    },
    async addVersion(version) {
      db.versions.push(version);
      save();
      return clone(version);
    },

    async extracts(courseId) { return clone(db.extracts[courseId] ?? []); },
    async saveExtract(courseId, extract) {
      const list = db.extracts[courseId] ?? [];
      const at = list.findIndex((e) => e.lectureId === extract.lectureId);
      if (at >= 0) list[at] = extract; else list.push(extract);
      db.extracts[courseId] = list;
      save();
    },

    async studyAids(courseId, personId) {
      // Built from published lectures, so there is nothing personal in one and
      // no reason to hide it. `personId` is kept in the signature because a
      // deployment may want "mine first"; visibility is not what it decides.
      void personId;
      return clone(db.studyAids.filter((a) => a.courseId === courseId));
    },
    async progress(courseId, personId) {
      return clone(db.progress.filter((r) => r.courseId === courseId
        && (!personId || r.personId === personId)));
    },
    async recordProgress(record) {
      db.progress.push(record);
      save();
      return clone(record);
    },
    async attempts(studyAidId, personId) {
      return clone(db.attempts.filter((a) => a.studyAidId === studyAidId
        && (!personId || a.personId === personId)));
    },
    async saveAttempt(attempt) {
      db.attempts.push(attempt);
      save();
      return clone(attempt);
    },

    async recalls(personId, studyAidId) {
      return clone((db.recalls ?? []).filter((r) => r.personId === personId
        && (!studyAidId || r.studyAidId === studyAidId)));
    },
    async saveRecall(recall) {
      db.recalls = db.recalls ?? [];
      // One row per card per student: answering again rewrites the schedule
      // rather than leaving a trail of every time they turned a card over.
      const at = db.recalls.findIndex((r) => r.personId === recall.personId
        && r.studyAidId === recall.studyAidId && r.card === recall.card);
      if (at >= 0) db.recalls[at] = recall; else db.recalls.push(recall);
      save();
      return clone(recall);
    },

    async costs(courseId) { return clone(db.costs.filter((c) => c.courseId === courseId)); },
    async recordCost(cost) { db.costs.push(cost); save(); },
    async usage(personId) { return clone(db.usage.filter((u) => u.personId === personId)); },
    async recordUsage(record) { db.usage.push(record); save(); },

    async notifications(personId) {
      return clone(db.notifications.filter((n) => n.personId === personId)
        .sort((a, b) => b.at.localeCompare(a.at)));
    },
    async notify(notification) { db.notifications.push(notification); save(); },
    async markNotificationsRead(personId) {
      for (const n of db.notifications) {
        if (n.personId === personId && !n.readAt) n.readAt = new Date().toISOString();
      }
      save();
    },

    async certificates(courseId, personId) {
      return clone(db.certificates.filter((c) => (!courseId || c.courseId === courseId)
        && (!personId || c.studentId === personId)));
    },
    async certificateByCode(code) {
      return clone(db.certificates.find((c) => c.code === code.toUpperCase()) ?? null);
    },
    async saveCertificate(certificate) {
      const at = db.certificates.findIndex((c) => c.id === certificate.id);
      if (at >= 0) db.certificates[at] = certificate; else db.certificates.push(certificate);
      save();
      return clone(certificate);
    },

    async readings(courseId) { return clone(db.readings.filter((r) => r.courseId === courseId)); },
    async saveReading(reading) {
      const at = db.readings.findIndex((r) => r.id === reading.id);
      if (at >= 0) db.readings[at] = reading; else db.readings.push(reading);
      save();
      return clone(reading);
    },

    async assignments(courseId) { return clone(db.assignments.filter((a) => a.courseId === courseId)); },
    async assignment(id) { return clone(db.assignments.find((a) => a.id === id) ?? null); },
    async saveAssignment(assignment) {
      const at = db.assignments.findIndex((a) => a.id === assignment.id);
      if (at >= 0) db.assignments[at] = assignment; else db.assignments.push(assignment);
      save();
      return clone(assignment);
    },
    async submissions(assignmentId, studentId) {
      return clone(db.submissions.filter((sub) => sub.assignmentId === assignmentId
        && (!studentId || sub.studentId === studentId)));
    },
    async submissionById(id) { return clone(db.submissions.find((sub) => sub.id === id) ?? null); },
    async saveSubmission(submission) {
      const at = db.submissions.findIndex((sub) => sub.id === submission.id);
      if (at >= 0) db.submissions[at] = submission; else db.submissions.push(submission);
      save();
      return clone(submission);
    },

    async studyAidById(id) { return clone(db.studyAids.find((a) => a.id === id) ?? null); },
    async saveStudyAid(aid) {
      const at = db.studyAids.findIndex((a) => a.id === aid.id);
      if (at >= 0) db.studyAids[at] = aid; else db.studyAids.push(aid);
      save();
      return clone(aid);
    },

    async conversations(courseId, studentId) {
      return clone(db.conversations.filter((c) => c.courseId === courseId && c.studentId === studentId));
    },
    async saveConversation(conversation) {
      const at = db.conversations.findIndex((c) => c.id === conversation.id);
      if (at >= 0) db.conversations[at] = conversation; else db.conversations.push(conversation);
      save();
      return clone(conversation);
    },
    async messages(conversationId) {
      return clone(db.messages.filter((m) => m.conversationId === conversationId));
    },
    async saveMessage(message) {
      db.messages.push(message);
      save();
      return clone(message);
    },
  };
}
