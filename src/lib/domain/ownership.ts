// ---------------------------------------------------------------------------
// WHOSE THING IS THIS?
//
// The platform's founding distinction, made enforceable:
//
//   THE LECTURER OWNS THE ACADEMIC SOURCE MATERIAL — the recording, and
//   everything the AI makes out of it. It is theirs while they teach the
//   course and it leaves with them when they stop.
//
//   THE UNIVERSITY OWNS THE COURSE ENVIRONMENT — the course exists, it runs
//   this session, these students are on it, this lecturer teaches it. The
//   university opens the room. It does not write on the board.
//
//   AI TRANSFORMS. It proposes; it never approves, never publishes, and
//   never owns.
//
//   STUDENTS CONSUME what has been published to a course they are on, and
//   nothing else, and never before the lecturer has stood behind it.
//
// A capability says what KIND of act is yours (`capabilities.ts`). This says
// whose THING it is. Both have to agree, and every write goes through
// `mayAct` — including the ones the screen already hid, because a hidden
// button is not a rule.
// ---------------------------------------------------------------------------

import type { Artefact, Course, Enrolment } from './types';
import { can, type Capability, type Role } from '../capabilities';

export interface Actor {
  id: string;
  role: Role;
}

export type Act =
  | 'read'        // see the body, not merely that it exists
  | 'edit'        // change the words
  | 'approve'     // stand behind it academically
  | 'publish'     // release it to the cohort
  | 'withdraw'    // take it back from the cohort
  | 'delete'      // remove it from the platform entirely
  | 'export'      // take a copy away
  | 'transform';  // ask the AI to make the next artefact from it

export interface Decision {
  allowed: boolean;
  /** Always set when refused. Shown to the person, not logged and swallowed. */
  reason?: string;
}

const ALLOW: Decision = { allowed: true };
const refuse = (reason: string): Decision => ({ allowed: false, reason });

export interface Scene {
  course: Course;
  /** The student's enrolment on this course, if they have one. */
  enrolment?: Enrolment | null;
  /**
   * True when the lecture lives in somebody's personal library rather than on
   * a taught course. It changes one thing and only one: the owner is the whole
   * audience, so there is no cohort to protect and no approval to wait for.
   */
  personal?: boolean;
}

/** Does this person teach this course? Ownership of material starts here. */
export function teaches(actor: Actor, course: Course): boolean {
  return course.lecturerIds.includes(actor.id);
}

export function isEnrolled(enrolment: Enrolment | null | undefined): boolean {
  return !!enrolment && enrolment.status !== 'withdrawn';
}

/**
 * MAY THIS PERSON BE ON THIS COURSE'S SCREENS AT ALL?
 *
 * Written because five pages each answered it themselves and two of them got
 * it wrong: the catalogue offered "Open the course" and the course then told
 * the reader they were not enrolled, because that page had never heard of
 * `access: 'open'` while `mayAct` and the service had. A rule that is written
 * down five times is a rule with five versions.
 *
 * It answers the door, not what is behind it: what a person may read, edit or
 * publish once inside is still `mayAct`, artefact by artefact.
 */
export function mayEnterCourse(
  actor: Actor, course: Course, enrolment: Enrolment | null | undefined,
): boolean {
  if (teaches(actor, course)) return true;
  if (isEnrolled(enrolment)) return true;
  if (course.access === 'open') return true;
  // The registry and a coordinator run the environment, and a course they
  // cannot open is a course they cannot administer.
  return actor.role === 'registry' || actor.role === 'coordinator';
}

/**
 * The one door. Every route, every screen and every store adapter calls this.
 */
export function mayAct(actor: Actor, act: Act, artefact: Artefact, scene: Scene): Decision {
  const { course, enrolment } = scene;
  const owns = artefact.ownerId === actor.id;
  const teaching = teaches(actor, course);

  // ---- A PERSONAL LIBRARY -----------------------------------------------
  //
  // A student records their own lecture, or uploads one they were given. The
  // recording is theirs, everything made from it is theirs, and this platform
  // is a study tool rather than a university's publishing system. So the
  // owner may do anything to their own material — and nobody else may touch
  // it at all, not their lecturer, not the registry, not another student.
  if (scene.personal) {
    if (!owns) return refuse('This is somebody else’s material.');
    return ALLOW;
  }

  // ---- THE STUDENT ------------------------------------------------------
  //
  // Reads what was published, on a course they are on. Nothing else is a
  // narrower rule than it sounds: an unapproved transcript is a machine's
  // first draft of somebody's speech, and a student reading it would be
  // reading something no academic has yet stood behind.
  if (actor.role === 'student') {
    if (act !== 'read') return refuse('A student studies the material; they do not change it.');
    // AN OPEN COURSE IS OPEN. A university publishing internationally, a
    // continuing-education course, a course a partner's students take: the
    // cohort is everybody signed in, and the published material is what they
    // get. Everything else about the platform is unchanged — approval,
    // terminology, the master, the languages.
    const open = course.access === 'open';
    if (!open && !isEnrolled(enrolment)) return refuse('This course is not one of yours.');
    if (artefact.state !== 'published') {
      return refuse('This has not been released by the lecturer yet.');
    }
    return ALLOW;
  }

  // ---- THE UNIVERSITY'S ADMINISTRATION ----------------------------------
  //
  // The environment is theirs and the material is not. They may see THAT a
  // lecture has been recorded, transformed and published — that is delivery,
  // and a university is answerable for it — and they may read what has been
  // published, as any member of the institution may. They may not read a
  // draft, may not edit a word, may not approve, publish or delete.
  //
  // THE DELETE LINE IS THE IMPORTANT ONE. If an administrator could delete a
  // lecturer's recording, the lecturer would not own it.
  if (actor.role === 'registry' || actor.role === 'coordinator') {
    if (act === 'read') {
      return artefact.state === 'published'
        ? ALLOW
        : refuse('Unreleased material belongs to the lecturer. Delivery status is visible; the content is not.');
    }
    return refuse('The university holds the course environment. The academic material is the lecturer’s.');
  }

  // ---- THE TEACHING ASSISTANT -------------------------------------------
  //
  // Prepares and never releases. They may upload and run a transformation
  // where the lecturer has put them on the course; the academic judgement —
  // this is correct, and students may have it — stays with the lecturer.
  if (actor.role === 'assistant') {
    if (!teaching) return refuse('You are not assigned to this course.');
    if (act === 'read' || act === 'transform') return ALLOW;
    return refuse('Correcting, approving and publishing stay with the lecturer whose lecture it is.');
  }

  // ---- THE LECTURER ------------------------------------------------------
  if (actor.role === 'lecturer') {
    // A lecturer on the course may read its material — co-teaching is normal
    // and a co-teacher who could not read the course's lectures could not
    // teach it. Everything that CHANGES the material is the owner's alone.
    if (!teaching) return refuse('This is not one of your courses.');
    if (act === 'read') return ALLOW;

    if (!owns) {
      return refuse('This lecture is your colleague’s. You can read it; it is theirs to change.');
    }

    const needed: Record<Exclude<Act, 'read'>, Capability> = {
      edit: 'correct-derived-text',
      approve: 'approve-artefact',
      publish: 'publish-to-students',
      withdraw: 'withdraw-own-material',
      delete: 'withdraw-own-material',
      export: 'export-own-material',
      transform: 'run-transformation',
    };
    if (!can(actor.role, needed[act])) return refuse('Your account does not hold that.');

    // ---- WHAT THE MODEL WROTE IS A PROPOSAL UNTIL A PERSON AGREES ------
    //
    // Publishing an artefact the lecturer has not approved would put the
    // model's words in front of students over the lecturer's name. The
    // pipeline states allow it structurally; this refuses it.
    if (act === 'publish' && artefact.state !== 'approved' && artefact.state !== 'published') {
      return refuse('Approve it first: publishing puts it in front of students under your name.');
    }

    // The recording is the lecturer's own voice and their own file. Editing
    // it is not something this platform does — it transforms it.
    if (act === 'edit' && artefact.origin === 'lecturer' && artefact.kind === 'recording') {
      return refuse('A recording is replaced, not edited.');
    }

    return ALLOW;
  }

  return refuse('Unknown role.');
}

/**
 * Who may open a course, enrol a cohort, or say who teaches — the environment
 * side of the same line. Kept here so both halves of the principle are read
 * together rather than in two files that can drift.
 */
export function mayShapeEnvironment(actor: Actor, capability: Capability): Decision {
  if (!can(actor.role, capability)) {
    return refuse('That belongs to the university’s administration, not to the course.');
  }
  return ALLOW;
}
