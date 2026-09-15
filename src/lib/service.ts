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
  Artefact, ArtefactKind, ArtefactVersion, Lecture, Register, StudyAid,
} from './domain/types';
import { mayAct, type Actor } from './domain/ownership';
import { buildKnowledgeBase, emptyKnowledgeBase } from './knowledge/build';
import type { CourseKnowledgeBase } from './knowledge/types';
import { mayRun, STAGE_BY_KIND, staleAfterEdit, studentFacingKinds } from './pipeline/stages';
import { parseExtract, runTransformation } from './ai/transform';
import { MODE_BY_ID, planSegments } from './ai/audioModes';
import { answer, type Passage } from './ai/tutor';
import { verifyTransformation } from './ai/verify';
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

  const previous = existing.find((a) => a.kind === kind);
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
      const result = await runTransformation(e, {
        kind, context, source: source!.body ?? '', knowledge,
        mode: options.mode, persona: options.persona, revision: options.revision,
      });
      artefact.body = result.text;
      artefact.producedBy = result.producedBy;

      // ---- THE VERIFICATION PASS ---------------------------------------
      //
      // The transformation is done; now a second pass asks the only question
      // worth asking about it — did any substantive claim move? The lecturer
      // reviews a report of changes rather than re-reading twelve thousand
      // words against twelve thousand words.
      if (kind === 'corrected_text') {
        artefact.verification = await verifyTransformation(e, source!.body ?? '', result.text);
      }

      // The extraction is not read by a person; it is merged into the course.
      if (kind === 'knowledge_extract') {
        const extract = parseExtract(result.text, {
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
      note: previous ? 'Regenerated' : 'Generated',
      createdAt: now(),
    });
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
  options: { register?: Register | null; conversationId?: string; scope?: AskScope } = {},
) {
  const where = await scene(store, courseId, actor.id);
  const teaching = where.course.lecturerIds.includes(actor.id);
  if (actor.role === 'student' && !where.enrolment) {
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

  const narrow = options.scope?.lectureSequence;
  if (narrow) {
    const here = passages.filter((p) => p.lectureSequence === narrow);
    if (here.length) {
      const first = await answer(e, {
        question, passages: here, knowledge, register: options.register, history,
      });
      if (!first.refusedReason) return { ...first, answeredIn: 'this-lecture' as const };
    }
    // Not here. Widen to the course, and say that is what happened.
    const wider = await answer(e, { question, passages, knowledge, register: options.register, history });
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

  return { ...(await answer(e, { question, passages, knowledge, register: options.register, history })), answeredIn: 'course' as const };
}

/** ---- What the Course AI makes ----------------------------------------- */

export async function makeStudyAid(
  store: Store, e: Engine, actor: Actor, courseId: string,
  brief: { kind: StudyAid['kind']; lectures: number[] | null; questions?: number; minutes?: number; register?: Register },
): Promise<StudyAid> {
  const where = await scene(store, courseId, actor.id);
  const teaching = where.course.lecturerIds.includes(actor.id);
  if (actor.role === 'student' && !where.enrolment) throw new Refused('This course is not one of yours.');

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

  const aid: StudyAid = {
    id: randomUUID(),
    courseId,
    kind: brief.kind,
    title: `${brief.kind === 'test' ? `${brief.questions ?? 10}-question test` :
      brief.kind === 'audio_revision' ? `${brief.minutes ?? 15}-minute audio revision` :
        brief.kind === 'flashcards' ? 'Flashcards' : 'Summary'} — ${range}`,
    lectureIds: chosen.map((l) => l.id),
    requestedBy: actor.id,
    // THE APPROVAL LAYER REACHES IN HERE. A lecturer's study aid is course
    // material and goes through review under their name. A student's is
    // theirs alone, and is labelled as not reviewed — because machine-made
    // material circulating in a cohort under a university's name, with no
    // academic behind it, is the thing this platform exists to prevent.
    audience: teaching ? 'course' : 'private',
    state: teaching ? 'ready' : 'ready',
    body: result.text,
    brief: { questions: brief.questions, register: brief.register, minutes: brief.minutes },
    createdAt: now(),
  };
  return store.saveStudyAid(aid);
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
