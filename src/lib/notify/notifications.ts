// ---------------------------------------------------------------------------
// TELLING SOMEBODY THAT SOMETHING HAPPENED.
//
// The last box of the specification's job diagram, and the one a background
// architecture makes necessary: work that takes ten minutes and finishes
// somewhere else needs to reach the person who asked for it. Without this a
// lecturer uploads a lecture, closes the tab, and finds out on Thursday.
//
// IN-APP, AND DELIBERATELY. Email and push are a vendor and a consent
// conversation; a bell with a count is neither, works today, and is what a
// person actually looks at while they are working.
//
// WHAT IS NOT NOTIFIED MATTERS AS MUCH. Nobody is told that a student read
// their notes, or that a quiz was sat: a notification about a named student's
// studying would turn this into the surveillance the progress layer refuses to
// be.
// ---------------------------------------------------------------------------

export type NotificationKind =
  | 'processing-finished'   // your lecture came out the other side
  | 'processing-failed'     // …or did not
  | 'awaiting-review'       // something is waiting for you to read it
  | 'translation-ready'     // a language is ready, unread by anybody
  | 'work-returned'         // your marked work is back
  | 'work-set'              // an assignment was set
  | 'allowance-spent';      // the minutes are gone

export interface Notification {
  id: string;
  personId: string;
  kind: NotificationKind;
  title: string;
  /** One line. A notification that needs a paragraph is an email. */
  body?: string;
  /** Where to go. Always somewhere, or it is not worth sending. */
  link?: string;
  at: string;
  readAt?: string;
}

export function unread(notifications: Notification[]): number {
  return notifications.filter((n) => !n.readAt).length;
}

/**
 * The same event, said in the words the recipient needs. Kept together so the
 * platform has one voice rather than a sentence invented at each call site.
 */
export const WORDING: Record<NotificationKind, (subject: string) => { title: string; body?: string }> = {
  'processing-finished': (subject) => ({
    title: `${subject} is ready to review`,
    body: 'The corrected text is waiting. Nothing reaches your students until you have read it.',
  }),
  'processing-failed': (subject) => ({
    title: `${subject} did not finish`,
    body: 'The reason is on the lecture page, in the words the engine gave.',
  }),
  'awaiting-review': (subject) => ({ title: `${subject} is waiting for you` }),
  'translation-ready': (subject) => ({
    title: `${subject} has been translated`,
    body: 'Nobody who reads that language has checked it yet.',
  }),
  'work-returned': (subject) => ({ title: `Your work on ${subject} has been marked` }),
  'work-set': (subject) => ({ title: `${subject} has been set` }),
  'allowance-spent': (subject) => ({
    title: 'This month’s minutes are used up',
    body: subject,
  }),
};
