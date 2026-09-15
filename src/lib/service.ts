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
  Artefact, ArtefactKind, ArtefactVersion, Course, Enrolment, Lecture, Person,
  Register, StudyAid,
} from './domain/types';
import { mayAct, type Actor } from './domain/ownership';
import { can } from './capabilities';
import { buildKnowledgeBase, emptyKnowledgeBase } from './knowledge/build';
import type { CourseKnowledgeBase } from './knowledge/types';
import { mayRun, STAGE_BY_KIND, staleAfterEdit, studentFacingKinds } from './pipeline/stages';
import { parseExtract, runTransformation } from './ai/transform';
import { MODE_BY_ID, planSegments } from './ai/audioModes';
import { answer, type Passage } from './ai/tutor';
import { verifyTransformation } from './ai/verify';
import { protectTerms, restoreTerms, validateTerminology } from './ai/terminology';
import { clearApproval, mayRegenerate } from './ai/masterIntegrity';
import { translationPrompt, tutorLanguageNote } from './i18n/translate';
import { validateTranslation } from './i18n/validate';
import { LANGUAGE_BY_CODE, languageName, TRANSLATABLE as TRANSLATABLE_KINDS } from './i18n/languages';
import { applyDecisions, findUnusual, type WordDecision } from './ai/unusual';
import type { Engine } from './ai/provider';
import { callAs } from './ai/roles';
import type { Store } from './data/store';

export class Refused extends Error {
  constructor(public readonly why: string) { super(why); }
}

const now = () => new Date().toISOString();

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
    if (kind === 'audio_15min') {
      // One recording per part of the script, so a ninety-minute lecture
      // arrives as two lessons rather than one compressed one.
      const parts = source!.parts?.length ? source!.parts : [
        { part: 1, ofParts: 1, label: MODE_BY_ID[options.mode ?? 'lesson_15'].label, body: source!.body },
      ];
      const spokenParts = [];
      for (const part of parts) {
        const spoken = await e.speech.speak({ script: part.body ?? source!.body ?? '' });
        spokenParts.push({ ...part, mediaPath: spoken.mediaPath, seconds: spoken.seconds });
        artefact.producedBy = spoken.producedBy;
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
export type AskScope = { lectureSequence?: number };

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

  return { ...(await answer(e, ask)), answeredIn: 'course' as const };
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
  return store.saveLecture(lecture);
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