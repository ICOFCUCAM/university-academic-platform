// ---------------------------------------------------------------------------
// THE ACTS THE PLATFORM PERFORMS.
//
// Every one of them goes through `mayAct` before it touches anything, and
// every one of them is callable from a test without a browser. The screens
// below are thin on purpose: a rule that lives in a component is a rule that
// holds only while somebody is looking at that component.
//
// THE WORKFLOW IS NEVER Lecture → AI → Student.
// It is    Lecture → AI → LECTURER REVIEW → Student,
// and the three functions that enforce it are `approve`, `publish` and
// `editArtefact` — the last because a correction that leaves the notes, the
// script, the audio and the revision cards untouched has published a
// correction nobody receives.
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import type {
  Artefact, ArtefactKind, ArtefactVersion, Assignment, Course, Enrolment, Lecture,
  Person, QuizAttempt, Reading, Register, StudyAid, Submission,
} from './domain/types';
import { isEnrolled, mayAct, type Actor } from './domain/ownership';
import { can } from './capabilities';
import { buildKnowledgeBase, emptyKnowledgeBase } from './knowledge/build';
import type { CourseKnowledgeBase } from './knowledge/types';
import { mayRun, STAGE_BY_KIND, staleAfterEdit, studentFacingKinds } from './pipeline/stages';
import { parseExtract, runTransformation } from './ai/transform';
import { MODE_BY_ID, planSegments } from './ai/audioModes';
import { answer, retrieve, type Passage } from './ai/tutor';
import { verifyTransformation } from './ai/verify';
import { protectTerms, restoreTerms, validateTerminology } from './ai/terminology';
import { clearApproval, mayRegenerate } from './ai/masterIntegrity';
import { translationPrompt, tutorLanguageNote } from './i18n/translate';
import { validateTranslation } from './i18n/validate';
import { LANGUAGE_BY_CODE, languageName, TRANSLATABLE as TRANSLATABLE_KINDS } from './i18n/languages';
import { applyDecisions, findUnusual, type WordDecision } from './ai/unusual';
import { cohortShape, myProgress, neglected, type LearningEvent } from './study/progress';
import { mayProcess, PLAN_BY_ID } from './billing/plans';
import { minutesUsedIn, period } from './billing/usage';
import { WORDING, type NotificationKind } from './notify/notifications';
import { createLimiter, type Limiter } from './limits';
import { mark, parseQuiz } from './study/quiz';
import type { Engine } from './ai/provider';
import { callAs } from './ai/roles';
import type { Store } from './data/store';

export class Refused extends Error {
  constructor(public readonly why: string) { super(why); }
}

const now = () => new Date().toISOString();

/**
 * One account cannot spend a department's budget in an evening. Replaceable:
 * a deployment with two instances passes its own limiter in.
 */
let limiter: Limiter = createLimiter();
export function useLimiter(replacement: Limiter) { limiter = replacement; }

async function scene(store: Store, courseId: string, actorId: string, lecture?: Lecture | null) {
  const course = await store.course(courseId);
  if (!course) throw new Refused('No such course.');
  const enrolment = await store.enrolmentFor(courseId, actorId);
  return { course, enrolment, personal: lecture?.context === 'personal' };
}

/** The same, for an act named by its artefact rather than by its lecture. */
async function sceneOf(store: Store, artefact: Artefact, actorId: string) {
  const lecture = await store.lecture(artefact.lectureId);
  return scene(store, artefact.courseId, actorId, lecture);
}

/** ---- Making an artefact ---------------------------------------------- */

export interface StageOptions {
  mode?: import('./ai/audioModes').AudioMode;
  persona?: import('./ai/audioModes').Persona;
  revision?: import('./ai/prompts').RevisionKind;
  /**
   * THE APPROVED MASTER IS IMMUTABLE IN SUBSTANCE, so writing over something a
   * person has approved takes a second, explicit act — and costs the approval.
   */
  regenerate?: boolean;
}

export async function runStage(
  store: Store, e: Engine, actor: Actor, lectureId: string, kind: ArtefactKind,
  options: StageOptions = {},
): Promise<Artefact> {
  const lecture = await store.lecture(lectureId);
  if (!lecture) throw new Refused('No such lecture.');
  const where = await scene(store, lecture.courseId, actor.id, lecture);

  const stage = STAGE_BY_KIND[kind];
  if (!stage.from) throw new Refused('A recording is uploaded, not generated.');

  const existing = await store.artefacts(lectureId);
  const source = existing.find((a) => a.kind === stage.from);
  const readiness = mayRun(kind, source?.state ?? 'missing', lecture.context === 'course');
  if (!readiness.ready) throw new Refused(readiness.blockedBy!);

  // The permission is checked against the SOURCE, because transforming is an
  // act on somebody's material — not on the artefact that does not exist yet.
  const permitted = mayAct(actor, 'transform', source!, where);
  if (!permitted.allowed) throw new Refused(permitted.reason!);

  // ---- NOTHING IS SPOKEN THAT NOBODY HAS PROOFREAD ----------------------
  //
  // The script is the last text a person sees before it becomes a voice. A
  // word the system could not place, let through here, is pronounced with
  // total confidence to somebody who cannot see that it is wrong.
  if (kind === 'audio_15min' && !source!.wordCheck) {
    throw new Refused(
      'Run the word check on the script first. Once it is spoken, a mis-heard word cannot be seen.',
    );
  }

  const previous = existing.find((a) => a.kind === kind);

  // ---- NOTHING WRITES OVER AN APPROVAL WITHOUT SAYING SO ----------------
  //
  // A regeneration that quietly replaced approved, published, translated
  // material would erase a person's approval and nobody would see it happen —
  // the students would simply be reading something else.
  const integrity = mayRegenerate(previous, { explicitly: options.regenerate });
  if (!integrity.allowed) throw new Refused(integrity.reason!);
  const context = {
    courseCode: where.course.code,
    courseTitle: where.course.title,
    lectureSequence: lecture.sequence,
    lectureTitle: lecture.title,
    abstract: lecture.abstract,
  };

  const artefact: Artefact = previous ?? {
    id: randomUUID(),
    lectureId,
    courseId: lecture.courseId,
    kind,
    origin: 'ai',
    // OWNED BY THE LECTURER WHOSE MATERIAL IT IS, never by the model and never
    // by the university. A transformation of your lecture is still your
    // lecture.
    ownerId: source!.ownerId,
    state: 'queued',
    derivedFromId: source!.id,
    createdAt: now(),
    updatedAt: now(),
    version: 0,
    correctedByLecturer: false,
  };

  // The approval goes now, not when the new text arrives: a failed run must
  // not leave the old approval sitting on top of a half-written artefact.
  const demoted = integrity.clearsApproval ? clearApproval(artefact) : artefact;
  Object.assign(artefact, demoted);
  artefact.state = 'running';
  artefact.derivedFromId = source!.id;
  artefact.error = undefined;
  await store.saveArtefact(artefact);

  try {
    // Every run is costed, whatever it was: what a lecture costs to process is
    // the first question a university asks before it buys.
    const charge = async (
      stage: string, producedBy: string, inText: string, outText: string,
      usage?: { inputTokens?: number; outputTokens?: number; seconds?: number },
    ) => {
      await store.recordCost({
        id: randomUUID(),
        courseId: artefact.courseId,
        lectureId: artefact.lectureId,
        stage,
        producedBy,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        charactersIn: inText.length,
        charactersOut: outText.length,
        at: now(),
      });
    };

    // ---- TRANSCRIPTION ------------------------------------------------
    //
    // The one stage that starts from audio rather than text. It went through
    // the language-model branch for weeks and died there with "transcript is
    // not made by the language model" — true, and useless.
    if (kind === 'transcript') {
      if (!source!.mediaPath) {
        throw new Error('There is no recording to transcribe. Paste the transcript instead.');
      }
      const heard = await e.transcriber.transcribe({
        mediaPath: source!.mediaPath,
        // The course's own vocabulary as a hint: it is what stops "rubisco"
        // coming back as "rubisko" in the first place.
        hint: where.course.terminology?.join(', '),
      });
      artefact.body = heard.text;
      artefact.producedBy = heard.producedBy;
      artefact.segments = 'segments' in heard
        ? (heard as { segments?: Artefact['segments'] }).segments : undefined;
      await charge(kind, heard.producedBy, source!.mediaPath, heard.text, heard.usage);

      // The meter has been waiting for this number: until something listens to
      // the recording, nobody knows how long it is.
      const spoken = heard.usage?.seconds;
      if (spoken && !lecture.sourceMinutes) {
        lecture.sourceMinutes = Math.round(spoken / 60);
        await store.saveLecture(lecture);
        await store.recordUsage({
          id: randomUUID(), personId: artefact.ownerId, period: period(),
          minutes: lecture.sourceMinutes, lectureId: lecture.id, at: now(),
        });
      }
    } else if (kind === 'audio_15min') {
      // One recording per part of the script, so a ninety-minute lecture
      // arrives as two lessons rather than one compressed one.
      const parts = source!.parts?.length ? source!.parts : [
        { part: 1, ofParts: 1, label: MODE_BY_ID[options.mode ?? 'lesson_15'].label, body: source!.body },
      ];
      const spokenParts = [];
      for (const part of parts) {
        const spoken = await e.speech.speak({
          script: part.body ?? source!.body ?? '',
          voice: where.course.defaultVoice,
          courseId: artefact.courseId,
          lectureId: artefact.lectureId,
        });
        spokenParts.push({ ...part, mediaPath: spoken.mediaPath, seconds: spoken.seconds });
        artefact.producedBy = spoken.producedBy;
        await charge(kind, spoken.producedBy, part.body ?? '', '', { seconds: spoken.seconds });
      }
      artefact.parts = spokenParts;
      artefact.mediaPath = spokenParts[0]?.mediaPath;
      artefact.mediaSeconds = spokenParts[0]?.seconds;
    } else if (kind === 'teaching_script') {
      const mode = MODE_BY_ID[options.mode ?? 'lesson_15'];
      const segments = planSegments(lecture.sourceMinutes, mode);
      const written = [];
      for (const segment of segments) {
        const result = await runTransformation(e, {
          kind, context, source: source!.body ?? '',
          mode: options.mode, persona: options.persona, segment,
        });
        written.push({ ...segment, body: result.text });
        artefact.producedBy = result.producedBy;
      }
      artefact.parts = written.length > 1 ? written : undefined;
      artefact.body = written
        .map((w) => (written.length > 1 ? `## ${w.label}\n\n${w.body}` : w.body))
        .join('\n\n');
    } else {
      const knowledge = kind === 'structured_notes'
        ? existing.find((a) => a.kind === 'knowledge_extract')?.body
        : undefined;

      // ---- TERM PROTECTION ---------------------------------------------
      //
      //   … → TERM PROTECTION → AI TRANSFORMATION → TERM VALIDATION → …
      //
      // The lecturer's terms are replaced by opaque markers BEFORE the model
      // sees the text, so there is nothing in front of it to normalise. A
      // rule in a prompt is a request; this is not one.
      const guarded = protectTerms(source!.body ?? '', { glossary: where.course.terminology });

      const result = await runTransformation(e, {
        kind, context, source: guarded.text, knowledge,
        mode: options.mode, persona: options.persona, revision: options.revision,
      });

      const restored = restoreTerms(result.text, guarded.markers);
      artefact.producedBy = result.producedBy;
      await charge(kind, result.producedBy, guarded.text, result.text, result.usage);

      // ---- TERM VALIDATION ---------------------------------------------
      //
      // And the hard boundary. A term substituted, or a protected term that
      // did not come back, is not a finding for the lecturer to weigh: the
      // output is REJECTED rather than published, and the stage reads as
      // failed with the reason on it.
      const validation = validateTerminology(source!.body ?? '', restored.text, {
        glossary: where.course.terminology,
        missingProtected: restored.missing,
      });
      artefact.terminology = validation.findings;

      if (!validation.ok) {
        artefact.state = 'failed';
        artefact.error = validation.rejection;
        artefact.updatedAt = now();
        return store.saveArtefact(artefact);
      }

      artefact.body = restored.text;

      // ---- THE VERIFICATION PASS ---------------------------------------
      //
      // The transformation is done; now a second pass asks the only question
      // worth asking about it — did any substantive claim move? The lecturer
      // reviews a report of changes rather than re-reading twelve thousand
      // words against twelve thousand words.
      if (kind === 'corrected_text') {
        artefact.verification = await verifyTransformation(e, source!.body ?? '', restored.text);
      }

      // The extraction is not read by a person; it is merged into the course.
      if (kind === 'knowledge_extract') {
        const extract = parseExtract(restored.text, {
          id: lecture.id, sequence: lecture.sequence, title: lecture.title,
        });
        await store.saveExtract(lecture.courseId, extract);
      }
    }

    artefact.state = 'ready';
    artefact.version += 1;
    artefact.staleSince = undefined;
    artefact.updatedAt = now();
    // The machine's version is recorded as the machine's. What a lecturer
    // later corrects is recorded as theirs, and both stay readable.
    await store.addVersion({
      id: randomUUID(),
      artefactId: artefact.id,
      version: artefact.version,
      body: artefact.body,
      mediaPath: artefact.mediaPath,
      authoredBy: artefact.producedBy ?? 'unknown',
      origin: 'ai',
      note: integrity.clearsApproval
        ? 'Regenerated after approval — the approval was cleared by it'
        : previous ? 'Regenerated' : 'Generated',
      createdAt: now(),
    });

    // Everything carried from the old master is now carrying something that
    // was withdrawn. Marked stale rather than deleted: a student mid-revision
    // keeps what they have, with a notice on it.
    if (integrity.clearsApproval) await markStale(store, artefact);
  } catch (error) {
    artefact.state = 'failed';
    artefact.error = error instanceof Error ? error.message : String(error);
    artefact.updatedAt = now();
  }

  // The person who asked is told, because ten minutes later they are somewhere
  // else. Told once, about their own lecture, and never about a student.
  const stageLabel = `${STAGE_BY_KIND[kind].label} for Lecture ${String(lecture.sequence).padStart(2, '0')}`;
  await tell(
    store, artefact.ownerId,
    artefact.state === 'failed' ? 'processing-failed' : 'processing-finished',
    stageLabel, `/lectures/${lecture.id}`,
  );

  return store.saveArtefact(artefact);
}

/** ---- The review layer -------------------------------------------------- */

export async function editArtefact(
  store: Store, actor: Actor, artefactId: string, body: string, note?: string,
): Promise<Artefact> {
  const artefact = await store.artefact(artefactId);
  if (!artefact) throw new Refused('No such artefact.');
  const where = await sceneOf(store, artefact, actor.id);
  const permitted = mayAct(actor, 'edit', artefact, where);
  if (!permitted.allowed) throw new Refused(permitted.reason!);

  const person = await store.person(actor.id);
  artefact.body = body;
  artefact.version += 1;
  // THE CORRECTED VERSION IS NOW THE AUTHORITATIVE ONE. Everything made from
  // here on is made from this, and the artefact stops being the machine's.
  artefact.correctedByLecturer = true;
  artefact.origin = 'lecturer';
  artefact.updatedAt = now();
  artefact.staleSince = undefined;
  // The words changed after somebody read them, so the reading no longer
  // stands. `recordWordCheck` sets it again immediately for its own edit.
  artefact.wordCheck = undefined;
  await store.addVersion({
    id: randomUUID(),
    artefactId: artefact.id,
    version: artefact.version,
    body,
    authoredBy: actor.id,
    authoredByName: person?.name,
    origin: 'lecturer',
    note: note ?? 'Lecturer correction',
    createdAt: now(),
  });
  await store.saveArtefact(artefact);

  // AND EVERYTHING BUILT ON IT IS NOW OUT OF DATE. Marked, not silently
  // regenerated: regenerating would throw away a lecturer's own corrections
  // downstream without asking.
  await markStale(store, artefact);
  return artefact;
}

async function markStale(store: Store, source: Artefact) {
  const siblings = await store.artefacts(source.lectureId);
  const stale = staleAfterEdit(source.kind);
  for (const sibling of siblings) {
    // ---- EVERY TRANSLATION OF THIS ARTEFACT ---------------------------
    //
    // A correction that reaches the notes and not their Arabic leaves a
    // cohort reading the uncorrected lecture in the one language nobody at
    // this university checks.
    if (sibling.translatedFromId === source.id) {
      if (sibling.staleSince) continue;
      sibling.staleSince = now();
      sibling.translationStanding = 'stale';
      await store.saveArtefact(sibling);
      continue;
    }
    if (!stale.includes(sibling.kind)) continue;
    if (sibling.state === 'absent' || sibling.staleSince) continue;
    sibling.staleSince = now();
    await store.saveArtefact(sibling);
  }
}

export async function approve(store: Store, actor: Actor, artefactId: string): Promise<Artefact> {
  const artefact = await store.artefact(artefactId);
  if (!artefact) throw new Refused('No such artefact.');
  const where = await sceneOf(store, artefact, actor.id);
  const permitted = mayAct(actor, 'approve', artefact, where);
  if (!permitted.allowed) throw new Refused(permitted.reason!);
  if (artefact.state !== 'ready' && artefact.state !== 'failed') {
    if (artefact.state !== 'approved' && artefact.state !== 'published') {
      throw new Refused('There is nothing finished to approve yet.');
    }
  }
  const person = await store.person(actor.id);
  artefact.state = artefact.state === 'published' ? 'published' : 'approved';
  artefact.approvedBy = actor.id;
  artefact.approvedByName = person?.name;
  artefact.approvedAt = now();
  artefact.updatedAt = now();
  return store.saveArtefact(artefact);
}

export async function publish(store: Store, actor: Actor, artefactId: string): Promise<Artefact> {
  const artefact = await store.artefact(artefactId);
  if (!artefact) throw new Refused('No such artefact.');
  const where = await sceneOf(store, artefact, actor.id);
  const permitted = mayAct(actor, 'publish', artefact, where);
  if (!permitted.allowed) throw new Refused(permitted.reason!);
  artefact.state = 'published';
  artefact.publishedAt = now();
  artefact.updatedAt = now();
  return store.saveArtefact(artefact);
}

export async function withdraw(store: Store, actor: Actor, artefactId: string): Promise<Artefact> {
  const artefact = await store.artefact(artefactId);
  if (!artefact) throw new Refused('No such artefact.');
  const where = await sceneOf(store, artefact, actor.id);
  const permitted = mayAct(actor, 'withdraw', artefact, where);
  if (!permitted.allowed) throw new Refused(permitted.reason!);
  artefact.state = 'approved';
  artefact.publishedAt = undefined;
  artefact.updatedAt = now();
  return store.saveArtefact(artefact);
}

/** ---- The course knowledge base ---------------------------------------- */

export async function knowledgeBase(store: Store, courseId: string): Promise<CourseKnowledgeBase> {
  const [lectures, extracts] = await Promise.all([
    store.lectures(courseId), store.extracts(courseId),
  ]);
  if (!extracts.length) return emptyKnowledgeBase(courseId);
  return buildKnowledgeBase({
    courseId,
    lectures: lectures.map((l) => ({ id: l.id, sequence: l.sequence, title: l.title })),
    extracts,
  });
}

/**
 * What the Course AI is allowed to read: published artefacts, split into
 * passages. Nothing unapproved, ever — a student asking a question would
 * otherwise be answered out of a draft no academic had read.
 */
export async function coursePassages(store: Store, courseId: string): Promise<Passage[]> {
  const [lectures, artefacts] = await Promise.all([
    store.lectures(courseId), store.artefactsForCourse(courseId),
  ]);
  const byId = new Map(lectures.map((l) => [l.id, l]));
  const readable = studentFacingKinds();
  const passages: Passage[] = [];

  for (const artefact of artefacts) {
    if (artefact.state !== 'published') continue;
    if (!readable.includes(artefact.kind)) continue;
    if (!artefact.body) continue;
    // ---- ONE ACADEMIC SOURCE, IN THE LANGUAGE IT WAS TAUGHT -------------
    //
    // The course knowledge is the lecturer's approved master; the student's
    // language is a presentation layer over it. Retrieving over translations
    // as well would mean the Course AI answered sometimes from the lecture and
    // sometimes from a rendering of it — and a claim that drifted in the
    // French would come back as the course's own teaching.
    if (artefact.translatedFromId) continue;
    const lecture = byId.get(artefact.lectureId);
    if (!lecture) continue;

    // Split on blank lines: a paragraph is the unit a citation can point at.
    for (const chunk of artefact.body.split(/\n\s*\n/)) {
      const text = chunk.trim();
      if (text.length < 40) continue;
      passages.push({
        lectureId: lecture.id,
        lectureSequence: lecture.sequence,
        lectureTitle: lecture.title,
        artefactKind: artefact.kind,
        text,
      });
    }
  }
  return passages;
}

/**
 * THE LADDER. "Ask about this lecture" means this lecture. A student sitting
 * in Lecture 07 asking "what did she mean by that?" is not asking the
 * university; they are asking the last fifty minutes.
 *
 * So the question is put to the NARROWEST scope first and widens only when
 * that scope does not cover it — and when it widens, the answer says so
 * ("Lecture 07 does not cover that; Lecture 06 does"), because a student who
 * cannot tell which lecture an answer came from cannot revise from it.
 */
export type AskScope = {
  lectureSequence?: number;
  /**
   * How far the question may travel when the course cannot answer it:
   *
   *   lecture → course → department → university
   *
   * Each rung is wider and each is announced, because an answer from another
   * course is not this course's teaching and a student revising it for this
   * examination would be revising the wrong thing. The default stops at the
   * course: leaving a syllabus is something a student asks for.
   */
  widenTo?: 'course' | 'department' | 'university';
};

/**
 * The courses this person may be answered out of, at a given reach. Never more
 * than they could read by opening the pages themselves: their own courses, and
 * whatever the institution has published openly.
 */
async function reachableCourses(
  store: Store, actor: Actor, from: Course, reach: 'department' | 'university',
): Promise<Course[]> {
  const all = await store.courses();
  const enrolments = await store.enrolmentsOf(actor.id);
  const mine = new Set(enrolments.filter((e) => e.status !== 'withdrawn').map((e) => e.courseId));

  return all.filter((course) => {
    if (course.id === from.id) return false;
    const readable = mine.has(course.id)
      || course.access === 'open'
      || course.lecturerIds.includes(actor.id);
    if (!readable) return false;
    return reach === 'university'
      || (!!course.departmentId && course.departmentId === from.departmentId);
  });
}

/** The published passages of several courses, each tagged with where it is from. */
async function passagesAcross(store: Store, courses: Course[]): Promise<Passage[]> {
  const gathered: Passage[] = [];
  for (const course of courses) {
    const passages = await coursePassages(store, course.id);
    gathered.push(...passages.map((p) => ({ ...p, courseId: course.id, courseCode: course.code })));
  }
  return gathered;
}

export async function askCourseAI(
  store: Store, e: Engine, actor: Actor, courseId: string, question: string,
  options: {
    register?: Register | null; conversationId?: string; scope?: AskScope;
    /** The language the student reads. The course is taught in its own. */
    language?: string;
  } = {},
) {
  const where = await scene(store, courseId, actor.id);
  const teaching = where.course.lecturerIds.includes(actor.id);
  const open = where.course.access === 'open';
  if (actor.role === 'student' && !where.enrolment && !open) {
    throw new Refused('This course is not one of yours.');
  }
  if (!teaching && actor.role !== 'student') {
    throw new Refused('The Course AI answers for the people on the course.');
  }

  const allowed = limiter.take(actor.id, 'ask');
  if (!allowed.allowed) throw new Refused(allowed.reason!);

  const [passages, knowledge] = await Promise.all([
    coursePassages(store, courseId), knowledgeBase(store, courseId),
  ]);
  if (!passages.length) {
    return {
      body: 'Nothing has been published on this course yet, so I have nothing to answer from.',
      citations: [], refusedReason: 'nothing-published' as const, producedBy: 'course knowledge base',
    };
  }

  const history = options.conversationId
    ? (await store.messages(options.conversationId)).slice(-6).map((m) => ({ role: m.role, body: m.body }))
    : [];

  // THE STUDENT'S LANGUAGE, THE COURSE'S CORPUS. The material is not
  // translated first — that would mean translating a course to answer one
  // question — so the tutor reads the lecturer's original and answers in the
  // student's language, quoting the original sentence beside its rendering
  // because that is the sentence the student is examined on.
  const courseLanguage = where.course.originalLanguage ?? 'en';
  const languageNote = options.language ? tutorLanguageNote(options.language, courseLanguage) : '';

  const ask = { question, passages, knowledge, register: options.register, history, languageNote };
  const narrow = options.scope?.lectureSequence;
  if (narrow) {
    const here = passages.filter((p) => p.lectureSequence === narrow);
    if (here.length) {
      const first = await answer(e, { ...ask, passages: here });
      if (!first.refusedReason) return { ...first, answeredIn: 'this-lecture' as const };
    }
    // Not here. Widen to the course, and say that is what happened.
    const wider = await answer(e, ask);
    if (wider.refusedReason) return { ...wider, answeredIn: 'course' as const };
    const elsewhere = [...new Set(wider.citations.map((c) => c.lectureSequence))]
      .sort((a, b) => a - b)
      .map((n) => `Lecture ${String(n).padStart(2, '0')}`)
      .join(', ');
    return {
      ...wider,
      body: `That is not in this lecture — it is covered in ${elsewhere}.\n\n${wider.body}`,
      answeredIn: 'course' as const,
    };
  }

  const inCourse = await answer(e, ask);
  if (!inCourse.refusedReason || !options.scope?.widenTo || options.scope.widenTo === 'course') {
    return { ...inCourse, answeredIn: 'course' as const };
  }

  // ---- THE LADDER, ONE RUNG AT A TIME -----------------------------------
  //
  //   lecture → course → department → university
  //
  // Each rung is only tried when the one before it could not answer, and each
  // is announced. An answer from another course is not this course's teaching:
  // a student who could not tell would revise it for the wrong examination.
  for (const reach of ['department', 'university'] as const) {
    if (options.scope.widenTo === 'department' && reach === 'university') break;

    const courses = await reachableCourses(store, actor, where.course, reach);
    if (!courses.length) continue;
    const wider = await passagesAcross(store, courses);
    if (!wider.length) continue;

    const found = await answer(e, { ...ask, passages: wider });
    if (found.refusedReason) continue;

    const from = [...new Set(found.citations.map((c) => {
      const passage = wider.find((p) => p.lectureId === c.lectureId);
      return passage?.courseCode;
    }).filter(Boolean))];

    return {
      ...found,
      body: `${where.course.code} does not cover that. ${
        from.length ? `This is from ${from.join(', ')}` : `This is from elsewhere in the ${reach}`
      }, so it is not what you are examined on here.\n\n${found.body}`,
      answeredIn: reach as 'department' | 'university',
    };
  }

  return { ...inCourse, answeredIn: 'course' as const };
}

/** ---- What the Course AI makes ----------------------------------------- */

export async function makeStudyAid(
  store: Store, e: Engine, actor: Actor, courseId: string,
  brief: {
    kind: StudyAid['kind']; lectures: number[] | null;
    questions?: number; minutes?: number; register?: Register;
    /**
     * The language the student wants it in. THE QUESTIONS ARE STILL WRITTEN
     * FROM THE MASTER: this decides what is carried across afterwards, not
     * what the quiz is made from.
     */
    language?: string;
  },
): Promise<StudyAid> {
  const where = await scene(store, courseId, actor.id);
  const teaching = where.course.lecturerIds.includes(actor.id);
  if (actor.role === 'student' && !where.enrolment && where.course.access !== 'open') {
    throw new Refused('This course is not one of yours.');
  }

  const courseLanguage = where.course.originalLanguage ?? 'en';
  const permitted = limiter.take(actor.id, 'make');
  if (!permitted.allowed) throw new Refused(permitted.reason!);

  const lectures = await store.lectures(courseId);
  const chosen = brief.lectures
    ? lectures.filter((l) => brief.lectures!.includes(l.sequence))
    : lectures;
  const passages = (await coursePassages(store, courseId))
    .filter((p) => chosen.some((l) => l.id === p.lectureId));

  if (!passages.length) {
    throw new Refused('Nothing is published for those lectures, so there is nothing to build from.');
  }

  const span = chosen.map((l) => l.sequence).sort((a, b) => a - b);
  const range = span.length > 1 ? `Lectures ${span[0]}–${span[span.length - 1]}` : `Lecture ${span[0]}`;

  // ---- ONE FRENCH VERSION, NOT TWENTY THOUSAND -------------------------
  //
  // A course's study material belongs to the course, not to whoever asked for
  // it first. If twenty thousand students have French as their working
  // language, there is one approved French quiz — generated once, translated
  // once, served to all of them. Regenerating per student would multiply the
  // cost of the platform by its enrolment and, worse, would give two students
  // in the same seminar different questions.
  const wanted = JSON.stringify({
    kind: brief.kind, lectures: chosen.map((l) => l.id).sort(),
    questions: brief.questions ?? null, minutes: brief.minutes ?? null,
  });
  const sameBrief = (aid: StudyAid) => JSON.stringify({
    kind: aid.kind, lectures: [...aid.lectureIds].sort(),
    questions: aid.brief?.questions ?? null, minutes: aid.brief?.minutes ?? null,
  }) === wanted;

  const shelf = await store.studyAids(courseId);
  const askedFor = brief.language ?? courseLanguage;
  // A study aid for a given brief and a given language is the same object
  // whoever asked for it, so a second student asking gets the first one's —
  // and the same questions, which matters more than the saving.
  const alreadyMade = shelf.find((aid) => aid.state !== 'failed'
    && (aid.language ?? courseLanguage) === askedFor && sameBrief(aid));
  if (alreadyMade) return alreadyMade;

  // AND IF THE MASTER EXISTS, A NEW LANGUAGE IS A TRANSLATION OF IT — never a
  // second master. Writing the questions again for the Spanish cohort would
  // give them a different paper from the French one, which is the whole thing
  // this route exists to prevent.
  const existingMaster = shelf.find((aid) => aid.state !== 'failed'
    && (aid.language ?? courseLanguage) === courseLanguage && !aid.translatedFromId && sameBrief(aid));
  if (existingMaster && askedFor !== courseLanguage) {
    return translateStudyAid(store, e, where.course, existingMaster, askedFor);
  }
  const material = passages.map((p) => `Lecture ${p.lectureSequence} — ${p.lectureTitle}\n${p.text}`).join('\n\n---\n\n');

  const ASK: Record<StudyAid['kind'], string> = {
    test: `Write a test of ${brief.questions ?? 10} questions on this material. Number them. Give the answers at the end, under "Answers", each with the lecture it comes from. Every question must be answerable from the material above and from nothing else.`,
    flashcards: 'Write flashcards: the term on one line, the lecturer’s definition on the next, a blank line between cards. Only terms the material defines.',
    audio_revision: `Write a script to be read aloud, revising this material in ${brief.minutes ?? 15} minutes — about ${(brief.minutes ?? 15) * 140} words. Written for the ear: short sentences, no bullet points, signposted aloud. Cover ${range} in the order they were taught.`,
    summary: 'Summarise this material in about four hundred words, in the order it was taught.',
  };

  const result = await callAs(e, 'course-tutor', {
    system: `You make study material for one university course out of that course’s own lectures.

THE MATERIAL BELOW IS THE WHOLE OF YOUR SOURCE. Do not add a fact, a date, a
figure, an example or a definition that is not in it. Do not draw on general
knowledge of the subject: a student revising from this is being examined on
what their lecturer taught, and anything else you add is an error in their
hands. Where the material does not support a question you wanted to ask, ask a
different question.`,
    user: `${ASK[brief.kind]}\n\nCOURSE MATERIAL — ${range}\n\n${material}`,
    maxTokens: 16000,
    effort: 'high',
  }, { corpusSize: passages.length });

  const masterAid: StudyAid = {
    id: randomUUID(),
    courseId,
    kind: brief.kind,
    title: `${brief.kind === 'test' ? `${brief.questions ?? 10}-question test` :
      brief.kind === 'audio_revision' ? `${brief.minutes ?? 15}-minute audio revision` :
        brief.kind === 'flashcards' ? 'Flashcards' : 'Summary'} — ${range}`,
    lectureIds: chosen.map((l) => l.id),
    requestedBy: actor.id,
    // THE APPROVAL LAYER REACHES IN HERE — as a label rather than as a lock.
    // A lecturer's study aid is course material. A student's is built from the
    // same published lectures and is shared with the cohort just the same, but
    // no academic has read it, and every screen that shows it says so.
    standing: teaching ? 'lecturer-requested' : 'unreviewed',
    state: teaching ? 'ready' : 'ready',
    body: result.text,
    brief: { questions: brief.questions, register: brief.register, minutes: brief.minutes },
    language: courseLanguage,
    createdAt: now(),
  };
  await store.saveStudyAid(masterAid);

  // ---- AND THEN, IF THE STUDENT READS ANOTHER LANGUAGE, CARRIED ACROSS ---
  //
  //   Approved lecture → master quiz → translation → localised quiz
  //
  // so a student in Lyon and a student in Lagos answer the same academic
  // questions. Writing the French quiz from the French notes would give them
  // different questions, and they sit the same examination.
  if (!brief.language || brief.language === courseLanguage) return masterAid;
  return translateStudyAid(store, e, where.course, masterAid, brief.language);
}

/**
 * A study aid carried into another language, under the same protection and the
 * same validation as any other translation. A rejected one is returned as a
 * failed aid rather than published: a quiz that lost a figure is a quiz with an
 * unanswerable question in it.
 */
async function translateStudyAid(
  store: Store, e: Engine, course: Course, master: StudyAid, language: string,
): Promise<StudyAid> {
  const sourceLanguage = course.originalLanguage ?? 'en';
  const guarded = protectTerms(master.body ?? '', { glossary: course.terminology });
  // A quiz is revision material: it is carried across under the rules written
  // for revision material rather than for prose.
  const prompt = translationPrompt('revision_materials', language, sourceLanguage, guarded.text);

  const localised: StudyAid = {
    ...master,
    id: randomUUID(),
    language,
    translatedFromId: master.id,
    translationStanding: 'unreviewed',
    state: 'running',
    createdAt: now(),
  };

  try {
    const result = await callAs(e, 'transformation', {
      system: prompt.system, user: prompt.user, maxTokens: 16000, effort: 'high',
    });
    const shape = validateTranslation(guarded.text, result.text);
    const restored = restoreTerms(result.text, guarded.markers);
    const terms = validateTerminology(master.body ?? '', restored.text, {
      glossary: course.terminology,
      missingProtected: restored.missing,
    });
    localised.translationFindings = shape.findings;

    if (!shape.ok || !terms.ok) {
      localised.state = 'failed';
      localised.body = undefined;
      localised.title = `${localised.title} — ${languageName(language)} (rejected)`;
      await store.saveStudyAid({ ...localised, body: shape.rejection ?? terms.rejection });
      return { ...localised, body: shape.rejection ?? terms.rejection };
    }

    localised.body = restored.text;
    localised.state = 'ready';
    localised.title = `${master.title} — ${languageName(language)}`;
  } catch (error) {
    localised.state = 'failed';
    localised.body = error instanceof Error ? error.message : String(error);
  }

  return store.saveStudyAid(localised);
}

/** ---- Lectures --------------------------------------------------------- */

export async function addLecture(
  store: Store, actor: Actor, courseId: string,
  input: { title: string; abstract?: string; sequence?: number; minutes?: number; personal?: boolean },
): Promise<Lecture> {
  const where = await scene(store, courseId, actor.id);
  const personal = input.personal === true;

  // ---- THE REFUSAL COMES BEFORE THE SPEND -------------------------------
  //
  // Transcription and speech cost real money per minute. A person uploading
  // ninety minutes with forty left in the month is told now, while they can
  // still do something about it — not after the transcript is half made.
  if (input.minutes) {
    const person = await store.person(actor.id);
    const plan = PLAN_BY_ID[person?.plan ?? 'institution'];
    const used = minutesUsedIn(await store.usage(actor.id), actor.id);
    const allowance = mayProcess(plan, { minutesUsed: used, periodStart: period() }, input.minutes);
    if (!allowance.allowed) {
      await store.notify({
        id: randomUUID(), personId: actor.id, kind: 'allowance-spent',
        ...WORDING['allowance-spent'](allowance.reason ?? ''),
        at: now(),
      });
      throw new Refused(allowance.reason!);
    }
  }

  // A LECTURE ON A COURSE IS ADDED BY SOMEBODY WHO TEACHES IT. A lecture in a
  // personal library is added by whoever is building that library, which is
  // usually a student with a recording of a lecture they attended.
  if (!personal && !where.course.lecturerIds.includes(actor.id)) {
    throw new Refused('Lectures are added by the people who teach the course.');
  }

  const existing = await store.lectures(courseId);
  const lecture: Lecture = {
    id: randomUUID(),
    context: personal ? 'personal' : 'course',
    courseId,
    sequence: input.sequence ?? existing.length + 1,
    title: input.title,
    abstract: input.abstract,
    ownerId: actor.id,
    createdBy: actor.id,
    createdAt: now(),
    sourceMinutes: input.minutes,
  };
  await store.saveLecture(lecture);

  if (input.minutes) {
    await store.recordUsage({
      id: randomUUID(), personId: actor.id, period: period(),
      minutes: input.minutes, lectureId: lecture.id, at: now(),
    });
  }
  return lecture;
}

/**
 * The source material arrives — a recording, or a transcript pasted in where
 * the lecture was not recorded or the transcription happens elsewhere.
 */
export async function addSource(
  store: Store, actor: Actor, lectureId: string,
  input: { kind: 'recording' | 'transcript'; mediaPath?: string; body?: string; seconds?: number },
): Promise<Artefact> {
  const lecture = await store.lecture(lectureId);
  if (!lecture) throw new Refused('No such lecture.');
  const where = await scene(store, lecture.courseId, actor.id, lecture);
  // On a course, the material is added by somebody who teaches it. In a
  // personal library, by the person whose library it is.
  const mine = lecture.context === 'personal'
    ? lecture.ownerId === actor.id
    : where.course.lecturerIds.includes(actor.id);
  if (!mine) throw new Refused('Only somebody teaching this course can add its material.');

  const existing = (await store.artefacts(lectureId)).find((a) => a.kind === input.kind);
  const artefact: Artefact = existing ?? {
    id: randomUUID(),
    lectureId,
    courseId: lecture.courseId,
    kind: input.kind,
    // THE SOURCE IS THE LECTURER'S, and this is where that begins. Everything
    // downstream inherits `ownerId` from here.
    origin: 'lecturer',
    ownerId: actor.id,
    state: 'ready',
    derivedFromId: null,
    createdAt: now(),
    updatedAt: now(),
    version: 0,
    correctedByLecturer: false,
  };
  artefact.mediaPath = input.mediaPath ?? artefact.mediaPath;
  artefact.body = input.body ?? artefact.body;
  artefact.mediaSeconds = input.seconds ?? artefact.mediaSeconds;
  artefact.state = 'ready';
  artefact.version += 1;
  artefact.updatedAt = now();
  artefact.origin = 'lecturer';
  const person = await store.person(actor.id);
  artefact.producedBy = person?.name;
  await store.addVersion({
    id: randomUUID(),
    artefactId: artefact.id,
    version: artefact.version,
    body: artefact.body,
    mediaPath: artefact.mediaPath,
    authoredBy: actor.id,
    authoredByName: person?.name,
    origin: 'lecturer',
    note: existing ? 'Replaced' : 'Uploaded',
    createdAt: now(),
  });
  if (existing) await markStale(store, artefact);
  return store.saveArtefact(artefact);
}


/** ---- The word check, before anything is spoken ------------------------ */

export interface WordCheckView {
  artefactId: string;
  words: ReturnType<typeof findUnusual>;
  alreadyChecked?: import('./ai/unusual').WordCheck;
}

/**
 * What the proofreading pane shows: every word this system could not place, in
 * its sentence, with a suggestion where the course's own vocabulary supplies
 * an obvious one.
 */
export async function wordCheckFor(
  store: Store, actor: Actor, artefactId: string,
): Promise<WordCheckView> {
  const artefact = await store.artefact(artefactId);
  if (!artefact) throw new Refused('No such artefact.');
  const where = await sceneOf(store, artefact, actor.id);
  const permitted = mayAct(actor, 'read', artefact, where);
  if (!permitted.allowed) throw new Refused(permitted.reason!);

  const knowledge = await knowledgeBase(store, artefact.courseId);
  // The course's other lectures are the vocabulary of this subject. A word
  // this course has used before needs no query; a word nothing has used is
  // exactly what has to be read before it is spoken.
  const corpus = (await store.artefactsForCourse(artefact.courseId))
    .filter((a) => a.id !== artefact.id && a.body
      && (a.state === 'published' || a.state === 'approved'))
    .map((a) => a.body)
    .join('\n\n');

  return {
    artefactId,
    words: findUnusual(artefact.body ?? '', {
      glossary: where.course.terminology,
      courseTerms: knowledge.nodes.map((n) => n.term),
      corpus,
    }),
    alreadyChecked: artefact.wordCheck,
  };
}

/**
 * The lecturer has been through the list. Replacements are applied as a
 * correction — a new version, authored by them — and the audio stage opens.
 */
export async function recordWordCheck(
  store: Store, actor: Actor, artefactId: string, decisions: WordDecision[],
): Promise<Artefact> {
  const artefact = await store.artefact(artefactId);
  if (!artefact) throw new Refused('No such artefact.');
  const where = await sceneOf(store, artefact, actor.id);
  const permitted = mayAct(actor, 'edit', artefact, where);
  if (!permitted.allowed) throw new Refused(permitted.reason!);

  const replaced = decisions.filter((d) => d.action === 'replaced' && d.replacement);
  const person = await store.person(actor.id);

  if (replaced.length) {
    // THE REPLACEMENTS ARE A LECTURER'S CORRECTION, and are recorded as one:
    // a new version in their name, and everything built on this marked stale.
    await editArtefact(
      store, actor, artefactId,
      applyDecisions(artefact.body ?? '', replaced),
      `Word check: ${replaced.map((d) => `${d.word} → ${d.replacement}`).join(', ')}`,
    );
  }

  const updated = (await store.artefact(artefactId))!;
  updated.wordCheck = {
    checkedAt: now(),
    checkedBy: person?.name ?? actor.id,
    decisions,
    flagged: decisions.length,
  };
  // A check is about the words that are there now. Correcting the text later
  // clears it, because the words changed after somebody read them.
  return store.saveArtefact(updated);
}

/** ---- The translation engine ------------------------------------------- */

/**
 * WHAT IS CARRIED INTO ANOTHER LANGUAGE, AND WHAT IS NOT.
 *
 * The four a student reads or listens to. The transcript is working material
 * and nobody revises from it in any language; the knowledge extraction is the
 * course's own index, read by the Course AI in the lecture's language, and
 * translating it would give the course two indexes that could disagree.
 */
export const TRANSLATABLE: ArtefactKind[] = [...TRANSLATABLE_KINDS];

export async function translateArtefact(
  store: Store, e: Engine, actor: Actor, artefactId: string, targetLanguage: string,
): Promise<Artefact> {
  const original = await store.artefact(artefactId);
  if (!original) throw new Refused('No such artefact.');
  const where = await sceneOf(store, original, actor.id);

  if (!can(actor.role, 'request-translation')) {
    throw new Refused('Translation is asked for by the lecturer whose lecture it is.');
  }
  const permitted = mayAct(actor, 'transform', original, where);
  if (!permitted.allowed) throw new Refused(permitted.reason!);

  if (!LANGUAGE_BY_CODE[targetLanguage]) throw new Refused(`This platform is not set up for ${targetLanguage}.`);
  if (!TRANSLATABLE.includes(original.kind)) {
    throw new Refused(`${original.kind.replace(/_/g, ' ')} is not translated — see TRANSLATABLE in service.ts.`);
  }
  if (original.translatedFromId) {
    // NEVER A TRANSLATION OF A TRANSLATION. Each language carries from the
    // lecturer's own approved original, so six languages are six renderings of
    // one lecture rather than a chain in which the sixth has drifted.
    throw new Refused('Translate from the lecturer’s original, not from another translation.');
  }

  // ---- THE GATE ---------------------------------------------------------
  //
  //   … → LECTURER REVIEW → ✅ FINAL APPROVAL → TRANSLATION ENGINE
  //
  // Translating a draft multiplies one mistake into six languages and then
  // asks a lecturer who reads one of them to find it.
  if (original.state !== 'approved' && original.state !== 'published') {
    throw new Refused(
      'Translation happens after approval. Approve the original first — a draft translated into six languages is one mistake in six places.',
    );
  }

  const sourceLanguage = original.language
    ?? where.course.originalLanguage
    ?? 'en';
  if (sourceLanguage === targetLanguage) {
    throw new Refused(`This lecture is already in ${languageName(targetLanguage)}.`);
  }

  const existing = (await store.artefacts(original.lectureId))
    .find((a) => a.translatedFromId === original.id && a.language === targetLanguage);

  const artefact: Artefact = existing ?? {
    id: randomUUID(),
    lectureId: original.lectureId,
    courseId: original.courseId,
    kind: original.kind,
    origin: 'ai',
    // STILL THE LECTURER'S. A translation of somebody's lecture is their
    // lecture; the reviewer vouches for the rendering, they do not own it.
    ownerId: original.ownerId,
    state: 'running',
    derivedFromId: original.derivedFromId,
    translatedFromId: original.id,
    language: targetLanguage,
    translationStanding: 'unreviewed',
    createdAt: now(),
    updatedAt: now(),
    version: 0,
    correctedByLecturer: false,
  };
  artefact.state = 'running';
  artefact.error = undefined;
  artefact.staleSince = undefined;
  await store.saveArtefact(artefact);

  try {
    // Protection, translation, restoration, validation — the same layer the
    // original pipeline uses, and for a sharper reason: a model translating
    // "Yahusha HaMashiach" will otherwise render it into the target language's
    // conventional name without hesitating.
    const guarded = protectTerms(original.body ?? '', { glossary: where.course.terminology });
    const prompt = translationPrompt(original.kind, targetLanguage, sourceLanguage, guarded.text);

    const result = await callAs(e, 'transformation', {
      system: prompt.system,
      user: prompt.user,
      maxTokens: 32000,
      effort: 'high',
    });

    // Checked while the markers are still in place, so "was the lecturer's
    // term carried across?" is a question about markers and not about the
    // target language's orthography.
    const shape = validateTranslation(guarded.text, result.text);
    const restored = restoreTerms(result.text, guarded.markers);
    const terms = validateTerminology(original.body ?? '', restored.text, {
      glossary: where.course.terminology,
      missingProtected: restored.missing,
    });

    artefact.producedBy = result.producedBy;
    artefact.terminology = terms.findings;
    artefact.translationFindings = shape.findings;

    if (!shape.ok || !terms.ok) {
      artefact.state = 'failed';
      artefact.error = shape.rejection ?? terms.rejection;
      artefact.updatedAt = now();
      return store.saveArtefact(artefact);
    }

    artefact.body = restored.text;
    artefact.state = 'ready';
    artefact.translationStanding = 'unreviewed';
    artefact.version += 1;
    artefact.updatedAt = now();
    await tell(store, artefact.ownerId, 'translation-ready',
      `${languageName(targetLanguage)} — ${original.kind.replace(/_/g, ' ')}`,
      `/lectures/${artefact.lectureId}`);
    await store.addVersion({
      id: randomUUID(),
      artefactId: artefact.id,
      version: artefact.version,
      body: artefact.body,
      authoredBy: artefact.producedBy ?? 'unknown',
      origin: 'ai',
      note: `Translated into ${languageName(targetLanguage)} from the approved original`,
      createdAt: now(),
    });
  } catch (error) {
    artefact.state = 'failed';
    artefact.error = error instanceof Error ? error.message : String(error);
    artefact.updatedAt = now();
  }

  return store.saveArtefact(artefact);
}

/**
 * Somebody who reads the language says it says what the original says.
 *
 * THE LECTURER CANNOT DO THIS FOR A LANGUAGE THEY DO NOT READ, and the
 * capability matrix is what stops them: `approve-translation` is held by a
 * translation reviewer and by nobody else. A translation nobody has read is
 * publishable — it is often better than nothing for a student who cannot read
 * the original — but it is labelled as unread, every time it is shown.
 */
export async function approveTranslation(
  store: Store, actor: Actor, artefactId: string,
): Promise<Artefact> {
  const artefact = await store.artefact(artefactId);
  if (!artefact) throw new Refused('No such artefact.');
  if (!artefact.translatedFromId) throw new Refused('That is not a translation.');
  if (!can(actor.role, 'approve-translation')) {
    throw new Refused('A translation is vouched for by somebody who reads that language.');
  }
  if (artefact.state === 'failed') {
    throw new Refused('This translation was rejected. It has to be made again, not approved.');
  }
  if (artefact.staleSince) {
    throw new Refused('The original has been corrected since this was translated. Remake it first.');
  }

  const person = await store.person(actor.id);
  artefact.translationStanding = 'reviewed';
  artefact.reviewedBy = actor.id;
  artefact.reviewedByName = person?.name;
  artefact.reviewedAt = now();
  artefact.state = artefact.state === 'published' ? 'published' : 'approved';
  artefact.updatedAt = now();
  return store.saveArtefact(artefact);
}

/** Which languages a lecture exists in, and what each one is worth. */
export async function languagesOf(store: Store, lectureId: string) {
  const artefacts = await store.artefacts(lectureId);
  const lecture = await store.lecture(lectureId);
  const course = lecture ? await store.course(lecture.courseId) : null;
  const original = course?.originalLanguage ?? 'en';

  const seen = new Map<string, { language: string; artefacts: number; published: number; standing?: string }>();
  seen.set(original, { language: original, artefacts: 0, published: 0 });

  for (const artefact of artefacts) {
    const code = artefact.language ?? original;
    const row = seen.get(code) ?? { language: code, artefacts: 0, published: 0 };
    row.artefacts += 1;
    if (artefact.state === 'published') row.published += 1;
    if (artefact.translationStanding) {
      // The weakest standing of any artefact in that language is the one the
      // student should be told about.
      row.standing = row.standing === 'stale' || artefact.translationStanding === 'stale'
        ? 'stale'
        : row.standing === 'unreviewed' || artefact.translationStanding === 'unreviewed'
          ? 'unreviewed' : artefact.translationStanding;
    }
    seen.set(code, row);
  }
  return [...seen.values()];
}

/** ---- Enrolment, which is the registry's ---------------------------------- */

/**
 * Putting a student on a course. The environment side of the line: a lecturer
 * owns what is taught and does not decide who is taught it.
 */
export async function enrol(
  store: Store, actor: Actor, courseId: string, studentId: string,
): Promise<Enrolment> {
  if (!can(actor.role, 'manage-enrolment')) {
    throw new Refused('Enrolment is held by the registry.');
  }
  const course = await store.course(courseId);
  if (!course) throw new Refused('No such course.');
  const student = await store.person(studentId);
  if (!student) throw new Refused('No such student.');

  const existing = await store.enrolmentFor(courseId, studentId);
  return store.saveEnrolment({
    id: existing?.id ?? randomUUID(),
    courseId,
    studentId,
    status: 'registered',
  });
}

/** ---- The learning profile ---------------------------------------------- */

/**
 * A STUDENT'S WORKING LANGUAGE IS CHANGED BY THE REGISTRY, WITH A REASON.
 *
 * Not because a student cannot be trusted, but because a term studied in one
 * language is a term studied once: hopping between languages mid-course leaves
 * a student revising from four half-remembered versions of one lecture, and
 * quoting a sentence in an examination that their lecturer never said in that
 * language. The change is recorded with who made it and why, because a student
 * whose course is suddenly in Portuguese is owed that answer.
 */
export async function setWorkingLanguage(
  store: Store, actor: Actor, personId: string, language: string, reason: string,
): Promise<Person> {
  if (!can(actor.role, 'set-working-language')) {
    throw new Refused('Your working language is changed by the registry, so that a term is studied in one language.');
  }
  if (!LANGUAGE_BY_CODE[language]) throw new Refused(`This platform is not set up for ${language}.`);
  if (!reason.trim()) throw new Refused('Say why. A change nobody can account for is one nobody can undo.');

  const person = await store.person(personId);
  if (!person) throw new Refused('No such person.');
  const actorPerson = await store.person(actor.id);

  const updated: Person = {
    ...person,
    workingLanguage: language,
    workingLanguageHistory: [
      ...(person.workingLanguageHistory ?? []),
      {
        from: person.workingLanguage, to: language,
        by: actor.id, byName: actorPerson?.name, reason: reason.trim(), at: now(),
      },
    ],
  };
  return store.savePerson(updated);
}

/**
 * VOICE AND SPEED ARE THE STUDENT'S OWN. They change how the audio sounds and
 * nothing about what it says, so they need no ceremony at all.
 */
export async function setListeningPreference(
  store: Store, actor: Actor, preference: { voice?: string; speed?: number },
): Promise<Person> {
  const person = await store.person(actor.id);
  if (!person) throw new Refused('No such person.');
  return store.savePerson({
    ...person,
    voicePreference: preference.voice ?? person.voicePreference,
    audioSpeed: preference.speed ?? person.audioSpeed,
  });
}

/**
 * A LECTURER AUTHORISING THEIR OWN VOICE — and nobody else may do it for them.
 *
 * A voice is a person. Synthesising one without consent is impersonation, and
 * it is the single act in this platform that withdrawing a page cannot undo.
 * So: the capability is the lecturer's alone, the scope is narrow by default,
 * the agreement is dated, and revoking it is one call that is honoured
 * everywhere the voice would otherwise be used.
 */
export async function authoriseOwnVoice(
  store: Store, actor: Actor,
  authorisation: { scope: 'translated-audio' | 'all-audio'; note?: string },
): Promise<Person> {
  if (!can(actor.role, 'authorise-own-voice')) {
    throw new Refused('Only the person whose voice it is can authorise its use.');
  }
  const person = await store.person(actor.id);
  if (!person) throw new Refused('No such person.');
  return store.savePerson({
    ...person,
    voiceConsent: { authorisedAt: now(), scope: authorisation.scope, note: authorisation.note },
  });
}

export async function revokeOwnVoice(store: Store, actor: Actor): Promise<Person> {
  const person = await store.person(actor.id);
  if (!person) throw new Refused('No such person.');
  if (!person.voiceConsent) return person;
  // KEPT, NOT DELETED. "They authorised it in March and withdrew it in June"
  // is a fact the university may one day need; and `consentHolds` reads
  // `revokedAt` at listening time, so audio already made stops being offered.
  return store.savePerson({
    ...person,
    voiceConsent: { ...person.voiceConsent, revokedAt: now() },
  });
}

/** ---- Studying: what a student did, and what a cohort did --------------- */

/**
 * A student read the notes, listened to the lesson, worked through the
 * revision. Recorded from the screen that showed it, and recorded ONCE a day
 * per thing — a page they keep coming back to is one reader, not forty.
 */
export async function recordStudy(
  store: Store, actor: Actor, input: {
    courseId: string; lectureId: string; artefactKind?: ArtefactKind; event: LearningEvent;
  },
): Promise<void> {
  const where = await scene(store, input.courseId, actor.id);
  if (actor.role === 'student' && !where.enrolment && where.course.access !== 'open') return;

  const already = await store.progress(input.courseId, actor.id);
  const today = now().slice(0, 10);
  const duplicate = already.some((r) => r.lectureId === input.lectureId
    && r.event === input.event && r.artefactKind === input.artefactKind && r.at.slice(0, 10) === today);
  if (duplicate) return;

  await store.recordProgress({
    id: randomUUID(),
    personId: actor.id,
    courseId: input.courseId,
    lectureId: input.lectureId,
    artefactKind: input.artefactKind,
    event: input.event,
    at: now(),
  });
}

/** What this person has done on this course. Theirs, and nobody else's. */
export async function myProgressOn(store: Store, actor: Actor, courseId: string) {
  const [records, lectures] = await Promise.all([
    store.progress(courseId, actor.id), store.lectures(courseId),
  ]);
  return myProgress(records, lectures.map((l) => l.id));
}

/**
 * What the cohort has done. COUNTS, never a name — `cohortShape` reduces
 * `personId` to a set size and nothing downstream can recover it, so a
 * lecturer cannot learn from this screen that one student has read nothing.
 */
export async function cohortOn(store: Store, actor: Actor, courseId: string) {
  const where = await scene(store, courseId, actor.id);
  const teaching = where.course.lecturerIds.includes(actor.id);
  if (!teaching && !can(actor.role, 'view-engagement')) {
    throw new Refused('Engagement on a course is visible to the people who teach it.');
  }

  const [records, lectures, enrolments] = await Promise.all([
    store.progress(courseId), store.lectures(courseId), store.enrolments(courseId),
  ]);
  const cohortSize = enrolments.filter((e) => e.status === 'registered').length;
  const rows = cohortShape(records, lectures.map((l) => l.id));
  return { rows, cohortSize, neglected: neglected(rows, cohortSize) };
}

/** ---- Sitting a quiz ---------------------------------------------------- */

export async function sitQuiz(
  store: Store, actor: Actor, studyAidId: string, given: Record<number, string>,
): Promise<{ attempt: QuizAttempt; marked: ReturnType<typeof mark> }> {
  const aid = await store.studyAidById(studyAidId);
  if (!aid) throw new Refused('No such quiz.');

  const where = await scene(store, aid.courseId, actor.id);
  if (actor.role === 'student' && !where.enrolment && where.course.access !== 'open') {
    throw new Refused('This course is not one of yours.');
  }

  const quiz = parseQuiz(aid.body ?? '');
  const marked = mark(quiz, given);

  const attempt: QuizAttempt = {
    id: randomUUID(),
    studyAidId,
    courseId: aid.courseId,
    lectureIds: aid.lectureIds,
    personId: actor.id,
    given,
    score: marked.score,
    outOf: marked.outOf,
    takenAt: now(),
  };
  await store.saveAttempt(attempt);

  // One record per lecture the quiz covered, so a lecturer sees which lecture
  // the cohort is being tested on rather than which quiz object was opened.
  for (const lectureId of aid.lectureIds) {
    await store.recordProgress({
      id: randomUUID(),
      personId: actor.id,
      courseId: aid.courseId,
      lectureId,
      event: 'quiz-taken',
      score: marked.score,
      outOf: marked.outOf,
      at: now(),
    });
  }

  return { attempt, marked };
}

/** ---- Reading, and work that a person marks ----------------------------- */

export async function setReading(
  store: Store, actor: Actor, courseId: string,
  input: { id?: string; lectureId?: string; kind: Reading['kind']; citation: string; url?: string; note?: string; required?: boolean; published?: boolean },
): Promise<Reading> {
  const where = await scene(store, courseId, actor.id);
  const onCourse = where.course.lecturerIds.includes(actor.id);
  if (!onCourse || !can(actor.role, 'set-reading')) {
    throw new Refused('The reading is set by the people who teach the course.');
  }
  if (!input.citation.trim()) throw new Refused('A reading needs a citation.');

  const existing = input.id ? (await store.readings(courseId)).find((r) => r.id === input.id) : undefined;
  return store.saveReading({
    id: existing?.id ?? randomUUID(),
    courseId,
    lectureId: input.lectureId,
    kind: input.kind,
    // THE CITATION AS THEY WROTE IT. Not reformatted into a house style, not
    // "corrected" into another referencing convention: a lecturer's reading
    // list is theirs, and the platform has no view about APA.
    citation: input.citation.trim(),
    url: input.url?.trim() || undefined,
    note: input.note?.trim() || undefined,
    required: input.required ?? true,
    addedBy: existing?.addedBy ?? actor.id,
    addedAt: existing?.addedAt ?? now(),
    published: input.published ?? existing?.published ?? false,
  });
}

export async function readingFor(store: Store, actor: Actor, courseId: string): Promise<Reading[]> {
  const where = await scene(store, courseId, actor.id);
  const teaching = where.course.lecturerIds.includes(actor.id);
  const readings = await store.readings(courseId);
  // A student sees what was published, as with everything else here.
  return teaching ? readings : readings.filter((r) => r.published);
}

export async function setAssignment(
  store: Store, actor: Actor, courseId: string,
  input: { id?: string; lectureId?: string; title: string; brief: string; dueAt?: string; marksOutOf?: number; published?: boolean },
): Promise<Assignment> {
  const where = await scene(store, courseId, actor.id);
  if (!where.course.lecturerIds.includes(actor.id) || !can(actor.role, 'set-assignment')) {
    throw new Refused('Work is set by the people who teach the course.');
  }
  if (!input.title.trim() || !input.brief.trim()) throw new Refused('An assignment needs a title and a brief.');

  const existing = input.id ? await store.assignment(input.id) : null;
  const saved = await store.saveAssignment({
    id: existing?.id ?? randomUUID(),
    courseId,
    lectureId: input.lectureId,
    title: input.title.trim(),
    brief: input.brief.trim(),
    dueAt: input.dueAt,
    marksOutOf: input.marksOutOf,
    createdBy: existing?.createdBy ?? actor.id,
    createdAt: existing?.createdAt ?? now(),
    published: input.published ?? existing?.published ?? false,
  });

  // Told once, when it is set — not again each time the brief is edited.
  if (saved.published && !existing?.published) {
    for (const enrolment of await store.enrolments(courseId)) {
      if (enrolment.status !== 'registered') continue;
      await tell(store, enrolment.studentId, 'work-set', saved.title, `/courses/${courseId}/work`);
    }
  }
  return saved;
}

export async function submitWork(
  store: Store, actor: Actor, assignmentId: string, body: string,
): Promise<Submission> {
  const assignment = await store.assignment(assignmentId);
  if (!assignment) throw new Refused('No such assignment.');
  if (!assignment.published) throw new Refused('That assignment has not been set yet.');

  const where = await scene(store, assignment.courseId, actor.id);
  if (!can(actor.role, 'submit-assignment')) throw new Refused('Only a student hands work in.');
  if (!isEnrolled(where.enrolment)) throw new Refused('This course is not one of yours.');
  if (!body.trim()) throw new Refused('There is nothing here to hand in.');

  const mine = (await store.submissions(assignmentId, actor.id))[0];
  // MARKED WORK IS NOT OVERWRITTEN. A student who edits after a mark would
  // leave a mark attached to something the lecturer never read.
  if (mine?.markedAt) throw new Refused('This has been marked. Ask your lecturer before changing it.');

  return store.saveSubmission({
    id: mine?.id ?? randomUUID(),
    assignmentId,
    courseId: assignment.courseId,
    studentId: actor.id,
    body: body.trim(),
    submittedAt: now(),
    late: !!assignment.dueAt && now() > assignment.dueAt,
  });
}

/**
 * MARKING IS A PERSON'S ACT, and the signature says so: it takes a mark and
 * words from a human caller. There is no model call in this function, no
 * suggested grade, and no rubric score "for the lecturer to adjust" — because a
 * number a lecturer merely agreed to is a number a model gave, and the student
 * would have no way of knowing which it was.
 */
export async function markWork(
  store: Store, actor: Actor, submissionId: string,
  marking: { mark?: number; feedback: string; release?: boolean },
): Promise<Submission> {
  const submission = await store.submissionById(submissionId);
  if (!submission) throw new Refused('No such submission.');

  const where = await scene(store, submission.courseId, actor.id);
  if (!where.course.lecturerIds.includes(actor.id) || !can(actor.role, 'mark-assignment')) {
    throw new Refused('A mark is an academic judgement about a student. It is the lecturer’s.');
  }
  if (!marking.feedback.trim()) {
    // A MARK WITH NO WORDS is a number a student cannot learn anything from.
    throw new Refused('Say something. A mark with no words teaches nobody anything.');
  }

  const person = await store.person(actor.id);
  return store.saveSubmission({
    ...submission,
    mark: marking.mark,
    feedback: marking.feedback.trim(),
    markedBy: actor.id,
    markedByName: person?.name,
    markedAt: now(),
    // Marked and returned are two acts: a lecturer marks a set over an
    // evening and releases them together, so nobody reads theirs early and
    // compares it with a friend who has not been marked yet.
    returnedAt: marking.release ? now() : submission.returnedAt,
  });
}

export async function returnWork(
  store: Store, actor: Actor, assignmentId: string,
): Promise<number> {
  const assignment = await store.assignment(assignmentId);
  if (!assignment) throw new Refused('No such assignment.');
  const where = await scene(store, assignment.courseId, actor.id);
  if (!where.course.lecturerIds.includes(actor.id) || !can(actor.role, 'mark-assignment')) {
    throw new Refused('A mark is released by the lecturer who gave it.');
  }

  const submissions = await store.submissions(assignmentId);
  let released = 0;
  for (const submission of submissions) {
    if (!submission.markedAt || submission.returnedAt) continue;
    await store.saveSubmission({ ...submission, returnedAt: now() });
    await tell(store, submission.studentId, 'work-returned', assignment.title,
      `/courses/${assignment.courseId}/work`);
    released += 1;
  }
  return released;
}

/** What a student may see of their own work, and what a lecturer sees of all. */
export async function workFor(
  store: Store, actor: Actor, assignmentId: string,
): Promise<Submission[]> {
  const assignment = await store.assignment(assignmentId);
  if (!assignment) throw new Refused('No such assignment.');
  const where = await scene(store, assignment.courseId, actor.id);
  const teaching = where.course.lecturerIds.includes(actor.id);

  if (teaching) return store.submissions(assignmentId);

  const mine = await store.submissions(assignmentId, actor.id);
  // A MARK EXISTS BEFORE IT IS RELEASED. Until it is returned the student sees
  // their own submission and nothing about the marking.
  return mine.map((submission) => submission.returnedAt ? submission : {
    ...submission, mark: undefined, feedback: undefined,
    markedBy: undefined, markedByName: undefined, markedAt: undefined,
  });
}

/** ---- Telling somebody ---------------------------------------------------- */

export async function tell(
  store: Store, personId: string, kind: NotificationKind, subject: string, link?: string,
): Promise<void> {
  await store.notify({
    id: randomUUID(), personId, kind, ...WORDING[kind](subject), link, at: now(),
  });
}

export async function myNotifications(store: Store, actor: Actor) {
  return store.notifications(actor.id);
}

export async function readNotifications(store: Store, actor: Actor) {
  await store.markNotificationsRead(actor.id);
}

/** What the runs on a course have cost, for whoever pays for it. */
export async function costsOn(store: Store, actor: Actor, courseId: string) {
  const where = await scene(store, courseId, actor.id);
  const teaching = where.course.lecturerIds.includes(actor.id);
  if (!teaching && !can(actor.role, 'manage-courses')) {
    throw new Refused('What a course costs to run is for the people who run it.');
  }
  return store.costs(courseId);
}

/**
 * SEARCHING A COURSE'S OWN MATERIAL. No model, no cost, no waiting: the same
 * retrieval the Course AI uses, with the passages shown as they are rather
 * than summarised — which is what somebody looking for a half-remembered
 * sentence actually wants.
 */
export async function searchCourse(
  store: Store, actor: Actor, courseId: string, query: string,
  options: { widenTo?: 'course' | 'department' | 'university' } = {},
): Promise<Passage[]> {
  const where = await scene(store, courseId, actor.id);
  const teaching = where.course.lecturerIds.includes(actor.id);
  if (actor.role === 'student' && !where.enrolment && where.course.access !== 'open') {
    throw new Refused('This course is not one of yours.');
  }
  if (!teaching && actor.role !== 'student') throw new Refused('Search is for the people on the course.');
  if (!query.trim()) return [];

  const here = await coursePassages(store, courseId);
  const found = retrieve(here, query, 12);
  if (found.length || !options.widenTo || options.widenTo === 'course') return found;

  const courses = await reachableCourses(store, actor, where.course, options.widenTo);
  return retrieve(await passagesAcross(store, courses), query, 12);
}