// ---------------------------------------------------------------------------
// HOW THE FIFTEEN MINUTES ARE SPENT, AND WHO IS SPEAKING.
//
// The audio is a core feature, not a text-to-speech afterthought, and the
// difference is entirely in the script. A machine reading notes aloud produces
// "Today we are going to discuss… [reads notes]". A teacher does something
// else: they tell you what you are about to learn, they tell you why it
// matters before they tell you what it is, and they come back to the hard part
// twice.
//
// MODE decides what the time is spent on. PERSONA decides who is spending it.
// Both change the script and neither changes the material.
// ---------------------------------------------------------------------------

export type AudioMode = 'lesson_15' | 'recap_5' | 'exam_review' | 'deep_dive' | 'qa';
export type Persona = 'professor' | 'tutor' | 'exam_coach' | 'study_buddy';

export interface ModeSpec {
  id: AudioMode;
  label: string;
  minutes: number;
  /** A minute is about 140 spoken words. The script is written to this. */
  words: number;
  blurb: string;
  brief: string;
}

export const MODES: ModeSpec[] = [
  {
    id: 'lesson_15',
    label: '15-minute lesson',
    minutes: 15,
    words: 2100,
    blurb: 'The lecture taught back to you in a quarter of an hour.',
    brief: `Teach the whole lecture. Open by saying what the lesson will cover and
why it hangs together. Take the material in the order the lecturer took it,
because that order is usually an argument. Spend the most time where the
lecturer spent the most time. Close with the two or three things to remember.`,
  },
  {
    id: 'recap_5',
    label: '5-minute recap',
    minutes: 5,
    words: 700,
    blurb: 'Only what you must not forget.',
    brief: `Only the essentials — the claims the lecture is built on and the terms
that carry them. No examples unless an example IS the point. Assume the
listener has heard the lecture and needs it brought back, not taught.`,
  },
  {
    id: 'exam_review',
    label: 'Exam review',
    minutes: 12,
    words: 1700,
    blurb: 'What the lecturer signalled matters for assessment.',
    brief: `Work through what the lecture ITSELF flagged as examinable — anything
said twice, said slowly, or named as important. Say plainly where the lecturer
gave a warning about a common error. DO NOT PREDICT EXAMINATION QUESTIONS and
do not claim anything will be on the paper; you know what the lecture
emphasised, and that is all you know.`,
  },
  {
    id: 'deep_dive',
    label: 'Deep dive',
    minutes: 20,
    words: 2800,
    blurb: 'The two or three hard ideas, slowly.',
    brief: `Choose the two or three hardest ideas in the lecture and spend the whole
time on them. Build each one up from what the listener already has. Say the
difficult thing twice, in different words, the second time more concretely.
Leave the easy material out entirely — the listener has the notes for that.`,
  },
  {
    id: 'qa',
    label: 'Question and answer',
    minutes: 15,
    words: 2100,
    blurb: 'You are asked, then told — the way revision actually works.',
    brief: `Ask a question, leave a beat — write "…" on its own line for the pause —
then answer it properly. Twelve to eighteen questions, ordered as the lecture
was. Start each answer by saying whether the obvious answer is the right one.
This is revision by recall, so the questions must be answerable from the
lecture and the answers must stay inside it.`,
  },
];

export const MODE_BY_ID: Record<AudioMode, ModeSpec> =
  Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<AudioMode, ModeSpec>;

export interface PersonaSpec {
  id: Persona;
  label: string;
  blurb: string;
  voice: string;
}

export const PERSONAS: PersonaSpec[] = [
  {
    id: 'professor',
    label: 'Professor',
    blurb: 'Academic and detailed.',
    voice: `Speak as a university lecturer speaks: precise, unhurried, the technical
term used and then glossed. Qualify a claim where the lecture qualified it.
Name the theory, the figure and the school. Do not simplify away a distinction
the lecture drew.`,
  },
  {
    id: 'tutor',
    label: 'Tutor',
    blurb: 'Explains difficult things simply.',
    voice: `Speak as a good tutor in a small room: plain words first, the technical
term straight after, and an analogy where the lecture supports one. Notice
aloud where a thing is confusing — "this is the part people get wrong, so take
it slowly" — and then take it slowly.`,
  },
  {
    id: 'exam_coach',
    label: 'Exam coach',
    blurb: 'Focused on what gets marks.',
    voice: `Speak as someone preparing a candidate: brisk, direct, structured in
numbered points the listener can hold. Say what a good answer would contain
and what a weak answer leaves out. Never claim to know what is on the paper.`,
  },
  {
    id: 'study_buddy',
    label: 'Study buddy',
    blurb: 'Conversational, as if you were revising together.',
    voice: `Speak as a friend who has done the reading: warm, informal, contractions,
short sentences, the occasional "right, so" to move things on. Still exact
about the material — friendliness is the register, not a licence to be vague.`,
  },
];

export const PERSONA_BY_ID: Record<Persona, PersonaSpec> =
  Object.fromEntries(PERSONAS.map((p) => [p.id, p])) as Record<Persona, PersonaSpec>;

// ---------------------------------------------------------------------------
// A NINETY-MINUTE LECTURE IS NOT A FIFTEEN-MINUTE LESSON.
//
// Compressing ninety minutes into fifteen does not produce a shorter lesson —
// it produces a list. So a long lecture becomes SEVERAL lessons, each a proper
// fifteen minutes of teaching over its own part of the material, and the
// student listens to part two on the way home.
//
// The ratio is deliberate and not a guess: a lecture is compressible by about
// four to one before teaching turns into enumeration — a fifty-minute lecture
// is one lesson, ninety minutes is two, a three-hour block is four.
// ---------------------------------------------------------------------------

export interface Segment {
  part: number;
  ofParts: number;
  label: string;
}

export function planSegments(sourceMinutes: number | undefined, mode: ModeSpec): Segment[] {
  const one = [{ part: 1, ofParts: 1, label: mode.label }];
  if (!sourceMinutes || mode.id !== 'lesson_15') return one;

  const parts = Math.max(1, Math.min(6, Math.ceil(sourceMinutes / 60)));
  if (parts === 1) return one;

  return Array.from({ length: parts }, (_, i) => ({
    part: i + 1,
    ofParts: parts,
    label: `${mode.label} — part ${i + 1} of ${parts}`,
  }));
}

/**
 * Which part of the notes a given lesson covers. Split on top-level headings,
 * because a section is where a lecture changes subject — cutting by word count
 * would end part one halfway through a definition.
 */
export function sliceNotes(notes: string, segment: Segment): string {
  if (segment.ofParts === 1) return notes;
  const sections = notes.split(/\n(?=## )/);
  const per = Math.ceil(sections.length / segment.ofParts);
  const from = (segment.part - 1) * per;
  return sections.slice(from, from + per).join('\n').trim() || notes;
}
