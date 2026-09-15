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
  Artefact, ArtefactVersion, Course, Department, Enrolment, Faculty, Lecture,
  Person, StudyAid, TutorConversation, TutorMessage, University,
} from '../domain/types';
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

    async enrolments(courseId) { return clone(db.enrolments.filter((e) => e.courseId === courseId)); },
    async enrolmentFor(courseId, studentId) {
      return clone(db.enrolments.find((e) => e.courseId === courseId && e.studentId === studentId) ?? null);
    },
    async enrolmentsOf(studentId) { return clone(db.enrolments.filter((e) => e.studentId === studentId)); },

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
      return clone(db.studyAids.filter((a) =>
        a.courseId === courseId &&
        // A private study aid belongs to the person who asked for it, and to
        // nobody else — not to the cohort, not to the lecturer.
        (a.audience === 'course' || !personId || a.requestedBy === personId)));
    },
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
