// ---------------------------------------------------------------------------
// THE AUDIT LOG, AND THE THING IT DELIBERATELY DOES NOT CONTAIN.
//
// A university buying this will ask who published the notes that turned out to
// be wrong, who withdrew a lecture the week before the examination, who moved
// a student's working language in March, and who issued a certificate. Those
// are administrative acts with consequences for other people, and they are
// recorded here with a name against each.
//
// WHAT IS NEVER RECORDED IS READING. Not who opened which notes, not when, not
// for how long. It is the same principle `study/progress.ts` holds — a
// platform that told a lecturer their student read Lecture 04 at two in the
// morning would change what a student is willing to open — and it is held here
// by construction rather than by restraint: `AUDITED_ACTS` is a closed list,
// `record` refuses anything not on it, and a test asserts no reading act ever
// appears on the list. Adding one means the check fails.
//
// Nor is there a delete. An audit log somebody can tidy is not an audit log,
// so the store has an append and a read and nothing else.
// ---------------------------------------------------------------------------

/**
 * Every act worth a name against it. Each one changes what somebody else can
 * see, do, or claim — which is the test for belonging here.
 */
export const AUDITED_ACTS = {
  'artefact.corrected': 'corrected the text',
  'artefact.approved': 'approved it',
  'artefact.published': 'published it to the cohort',
  'artefact.withdrawn': 'withdrew it from the cohort',
  'artefact.regenerated': 'regenerated it, clearing the approval',
  'translation.approved': 'vouched for a translation',
  'certificate.issued': 'issued a certificate',
  'certificate.revoked': 'revoked a certificate',
  'enrolment.changed': 'changed an enrolment',
  'language.changed': 'changed somebody’s working language',
  'voice.authorised': 'authorised their own voice',
  'voice.revoked': 'withdrew their own voice',
  'course.terminology': 'changed the terms that may never be substituted',
  'course.completion': 'changed what completing the course means',
  'course.voice': 'changed the voice the course is spoken in',
  'institution.voice': 'changed the university’s own voice',
} as const;

export type AuditAct = keyof typeof AUDITED_ACTS;

/**
 * Words that would mean somebody's reading was being recorded. The test holds
 * `AUDITED_ACTS` against this list, so the day somebody adds `artefact.read`
 * the suite fails and the conversation happens before the release, not after
 * a student asks what the platform knows about them.
 */
export const NEVER_AUDITED = [
  'read', 'opened', 'viewed', 'listened', 'watched', 'played', 'visited',
  'searched', 'asked', 'scrolled', 'idle', 'session',
];

export interface AuditEntry {
  id: string;
  at: string;
  act: AuditAct;
  /** Who did it, by name as well as by id: an id is not an answer. */
  actorId: string;
  actorName: string;
  actorRole: string;
  /** What it was done to, in words a person reading the log will recognise. */
  subject: string;
  /** Scoped to a course where there is one, so a lecturer can read their own. */
  courseId?: string;
  /** Anything worth keeping: the reason given, the version, the code. */
  detail?: string;
}

/** Refuses an act that is not on the list, which is the whole defence. */
export function isAudited(act: string): act is AuditAct {
  return Object.prototype.hasOwnProperty.call(AUDITED_ACTS, act);
}

/** The line a screen shows. Deliberately a sentence, not a row of columns. */
export function describe(entry: AuditEntry): string {
  return `${entry.actorName} (${entry.actorRole}) ${AUDITED_ACTS[entry.act]} — ${entry.subject}`;
}

/**
 * WHO MAY READ IT.
 *
 *   The registry reads all of it: it is the institution's record.
 *   Whoever teaches a course reads that course's acts, because those acts were
 *   done to their material and they are answerable for it.
 *   Nobody else reads any of it, including the person the entry is about —
 *   an entry naming a student is an administrative act done to them, and
 *   they are told by a notification rather than by browsing a log.
 */
export function visibleTo(
  entries: AuditEntry[],
  reader: { role: string; coursesTaught: string[]; everything: boolean },
): AuditEntry[] {
  if (reader.everything) return entries;
  return entries.filter((e) => e.courseId && reader.coursesTaught.includes(e.courseId));
}
