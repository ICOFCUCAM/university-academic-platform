import Link from 'next/link';
import { Award, BookOpen, Globe } from 'lucide-react';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { translate } from '@/lib/i18n/ui';
import { catalogue } from '@/lib/service';
import { LANGUAGE_BY_CODE } from '@/lib/i18n/languages';
import { Card, Empty, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * THE OPEN CATALOGUE. `access: 'open'` was enforced everywhere and there was
 * no page on which to find such a course, which made the whole idea of a
 * university publishing internationally true in the rules and invisible in the
 * product.
 *
 * It asks nothing about whoever is reading. It lists what is open and says
 * plainly what is not yet possible — nobody can buy anything here, because no
 * checkout exists, and a catalogue that implied otherwise would be the one
 * page on this platform that lied.
 */
export default async function Catalogue() {
  const store = getStore();
  const actor = await currentActor();
  const reader = actor.workingLanguage;
  const [courses, university] = await Promise.all([catalogue(store), store.university()]);

  return (
    <div>
      <PageHeader
        eyebrow={university.name}
        title={translate(reader, 'catalogue.title')}
        subtitle={translate(reader, 'catalogue.subtitle')}
        lang={reader ?? 'en'}
      />

      <div className="px-6 py-6 md:px-8">
        {courses.length === 0 ? (
          <Empty
            title="Nothing is open yet"
            body="A course becomes visible here when the institution opens it beyond the cohort."
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {courses.map((course) => (
              <Card key={course.id} className="px-5 py-4" lang={course.originalLanguage}>
                {course.where && (
                  <p className="text-[11px] uppercase tracking-wide text-ink-faint">{course.where}</p>
                )}
                <h2 className="mt-0.5 font-medium">
                  <span className="text-brand">{course.code}</span> — {course.title}
                </h2>
                {course.description && (
                  <p className="mt-1 text-sm text-ink-soft">{course.description}</p>
                )}

                <p className="mt-2 text-xs text-ink-faint">
                  {course.lecturers.join(', ')}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen size={13} />
                    {course.lectures} · {translate(reader, 'catalogue.published')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Globe size={13} />
                    {/* THE LANGUAGES SOMEBODY CAN ACTUALLY STUDY IT IN. A
                        language a course is "offered in" with nothing published
                        in it is a promise, and this is not the place for one. */}
                    {course.languages.map((code) => LANGUAGE_BY_CODE[code]?.endonym ?? code).join(' · ')}
                  </span>
                  {course.certifies && (
                    <span className="inline-flex items-center gap-1.5 text-ok">
                      <Award size={13} /> {translate(reader, 'catalogue.certificate')}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {course.access === 'open' ? (
                    <Link
                      href={`/courses/${course.id}`}
                      className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark"
                    >
                      {translate(reader, 'catalogue.open')}
                    </Link>
                  ) : (
                    <>
                      <span className="rounded-md border border-page-line px-3.5 py-2 text-sm text-ink-soft">
                        {course.price
                          ? `${(course.price.amount / 100).toFixed(2)} ${course.price.currency}`
                          : 'Paid course'}
                      </span>
                      {/* NOBODY CAN BUY ANYTHING HERE. There is no checkout, and
                          a catalogue implying otherwise would be the one page on
                          this platform that lied. */}
                      <span className="text-xs text-ink-faint">
                        {translate(reader, 'catalogue.noPayments')}
                      </span>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
