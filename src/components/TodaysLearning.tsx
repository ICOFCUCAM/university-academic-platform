'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Bot, Brain, Check, Headphones, ListChecks } from 'lucide-react';
import type { LectureProgress } from '@/lib/study/progress';
import { translator } from '@/lib/i18n/ui';

/**
 * 📖 Read · 🎧 Listen · 🧠 Revision · ❓ Quiz · 🤖 Ask
 *
 * What a student does with a lecture, in the order they usually do it, with a
 * tick against what they have already done — so "where was I?" has an answer
 * without anybody having to remember.
 *
 * WHAT IS NOT OFFERED IS NOT SHOWN AS BROKEN. A lecture with no audio yet
 * simply has no listen button; a greyed-out control that never becomes
 * available teaches a student to distrust the page.
 */
export function TodaysLearning({
  courseId, lectureId, progress, has, language,
}: {
  courseId: string;
  lectureId: string;
  progress?: LectureProgress;
  has: { notes: boolean; audio: boolean; revision: boolean };
  /** The student's working language: the strip is chrome, so it follows it. */
  language?: string;
}) {
  const [done, setDone] = useState(progress);
  const t = translator(language);

  async function record(event: 'read' | 'listened' | 'revised') {
    setDone((d) => ({ ...(d ?? { lectureId, read: false, listened: false, revised: false, quizTaken: false }),
      [event === 'read' ? 'read' : event === 'listened' ? 'listened' : 'revised']: true }));
    await fetch('/api/study', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ courseId, lectureId, event }),
    }).catch(() => {});
  }

  const item = (
    key: string, label: string, Icon: typeof BookOpen, href: string,
    finished: boolean, onGo?: () => void,
  ) => (
    <Link
      key={key}
      href={href}
      onClick={onGo}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
        finished ? 'border-emerald-200 bg-emerald-50 text-ok' : 'border-page-line text-ink-soft hover:border-brand/40'
      }`}
    >
      {finished ? <Check size={12} /> : <Icon size={12} />}
      {label}
    </Link>
  );

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {has.notes && item('read', t('lecture.read'), BookOpen,
        `/lectures/${lectureId}#structured_notes`, !!done?.read, () => void record('read'))}
      {has.audio && item('listen', t('lecture.listen'), Headphones,
        `/lectures/${lectureId}#audio_15min`, !!done?.listened, () => void record('listened'))}
      {has.revision && item('revise', t('lecture.revise'), Brain,
        `/lectures/${lectureId}#revision_materials`, !!done?.revised, () => void record('revised'))}
      {item('quiz', done?.bestScore
        ? `Quiz — best ${done.bestScore.score}/${done.bestScore.outOf}`
        : t('lecture.quiz'), ListChecks, `/courses/${courseId}/study`, !!done?.quizTaken)}
      {item('ask', t('lecture.ask'), Bot, `/lectures/${lectureId}#ask`, false)}
    </div>
  );
}
