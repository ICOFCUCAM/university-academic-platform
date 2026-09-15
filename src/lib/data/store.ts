// ---------------------------------------------------------------------------
// WHERE THE COURSE LIVES.
//
// One interface, two implementations, and the platform never knows which it
// has:
//
//   memory.ts  — standalone. A university, a business or one lecturer runs
//                this product on its own, with its own tenants.
//   icof.ts    — mounted inside an existing university system, reading that
//                system's own courses, lecturers and enrolments so nothing is
//                entered twice and nothing can disagree.
//
// The second is the reason this interface is narrow. Everything it asks for is
// something any student-records system already has: a course, who teaches it,
// who is on it. The lecture pipeline, the artefacts and the knowledge base are
// this platform's own and travel with it.
// ---------------------------------------------------------------------------

import type {
  Artefact, ArtefactVersion, Course, Department, Enrolment, Faculty, Lecture,
  Person, QuizAttempt, StudyAid, TutorConversation, TutorMessage, University,
} from '../domain/types';
import type { LectureExtract } from '../knowledge/types';
import type { ProgressRecord } from '../study/progress';

export interface Store {
  /** Which implementation this is, shown in Settings. */
  readonly id: 'memory' | 'icof';

  university(): Promise<University>;
  faculties(): Promise<Faculty[]>;
  departments(): Promise<Department[]>;

  courses(): Promise<Course[]>;
  course(id: string): Promise<Course | null>;
  coursesFor(personId: string): Promise<Course[]>;
  saveCourse(course: Course): Promise<Course>;

  people(): Promise<Person[]>;
  person(id: string): Promise<Person | null>;
  savePerson(person: Person): Promise<Person>;

  enrolments(courseId: string): Promise<Enrolment[]>;
  enrolmentFor(courseId: string, studentId: string): Promise<Enrolment | null>;
  enrolmentsOf(studentId: string): Promise<Enrolment[]>;
  saveEnrolment(enrolment: Enrolment): Promise<Enrolment>;

  lectures(courseId: string): Promise<Lecture[]>;
  lecture(id: string): Promise<Lecture | null>;
  saveLecture(lecture: Lecture): Promise<Lecture>;

  artefacts(lectureId: string): Promise<Artefact[]>;
  artefactsForCourse(courseId: string): Promise<Artefact[]>;
  artefact(id: string): Promise<Artefact | null>;
  saveArtefact(artefact: Artefact): Promise<Artefact>;
  deleteArtefact(id: string): Promise<void>;

  /** The audit trail behind "the lecturer corrected it". */
  versions(artefactId: string): Promise<ArtefactVersion[]>;
  addVersion(version: ArtefactVersion): Promise<ArtefactVersion>;

  /** The knowledge base is rebuilt from these; they are never edited. */
  extracts(courseId: string): Promise<LectureExtract[]>;
  saveExtract(courseId: string, extract: LectureExtract): Promise<void>;

  studyAids(courseId: string, personId?: string): Promise<StudyAid[]>;
  saveStudyAid(aid: StudyAid): Promise<StudyAid>;
  studyAidById(id: string): Promise<StudyAid | null>;

  /** What a person has read, listened to and sat. See study/progress.ts. */
  progress(courseId: string, personId?: string): Promise<ProgressRecord[]>;
  recordProgress(record: ProgressRecord): Promise<ProgressRecord>;

  attempts(studyAidId: string, personId?: string): Promise<QuizAttempt[]>;
  saveAttempt(attempt: QuizAttempt): Promise<QuizAttempt>;

  conversations(courseId: string, studentId: string): Promise<TutorConversation[]>;
  saveConversation(conversation: TutorConversation): Promise<TutorConversation>;
  messages(conversationId: string): Promise<TutorMessage[]>;
  saveMessage(message: TutorMessage): Promise<TutorMessage>;
}
