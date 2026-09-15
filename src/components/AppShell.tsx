'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, BookOpen, GraduationCap, LayoutDashboard, ScrollText, Settings, Sparkles, UserRound } from 'lucide-react';
import type { Person } from '@/lib/domain/types';
import { ROLE_LABEL, type Role } from '@/lib/capabilities';
import { direction } from '@/lib/i18n/languages';
import { translator, type UIKey } from '@/lib/i18n/ui';

const NAV = [
  { href: '/', key: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/lectures', key: 'nav.lectures', icon: BookOpen },
  { href: '/courses', key: 'nav.courses', icon: GraduationCap },
  { href: '/notifications', key: 'nav.notifications', icon: Bell },
  { href: '/profile', key: 'nav.profile', icon: UserRound },
  { href: '/settings', key: 'nav.settings', icon: Settings },
] as const;

export function AppShell({
  actor, people, unread = 0, canReadRecord = false, children,
}: {
  actor: { id: string; role: Role; name: string; workingLanguage?: string };
  people: Person[];
  /** How many notifications are waiting. Shown on the bell, nowhere else. */
  unread?: number;
  /**
   * Whether "Who did what" is offered at all. A student who cannot read the
   * record is not shown a door that refuses them: the refusal exists in the
   * service, and the navigation should not advertise a room they may not
   * enter.
   */
  canReadRecord?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // THE CHROME IN THEIR LANGUAGE TOO. French notes under a navigation bar
  // reading "Lectures · Courses · Settings" is a strange thing to hand
  // somebody and call multilingual.
  const t = translator(actor.workingLanguage);
  const dir = direction(actor.workingLanguage ?? 'en');

  return (
    <div className="min-h-screen flex" dir={dir}>
      <aside className="w-60 shrink-0 border-r border-page-line bg-page-card hidden md:flex md:flex-col">
        <div className="px-5 py-5 border-b border-page-line">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand" />
            <span className="font-semibold tracking-tight">Lecture Studio</span>
          </div>
          {/* THE POSITIONING, AND IT IS ALSO THE ARCHITECTURE. Each clause is
              enforced somewhere: the lecturer owns the material, the model only
              transforms it, and what a student receives has a name on it. */}
          <p className="mt-1 text-[11px] leading-4 text-ink-faint">
            Lecturers teach. AI transforms. Students learn.
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {[...NAV, ...(canReadRecord
            ? [{ href: '/audit', key: 'nav.record' as const, icon: ScrollText }] : [])
          ].map(({ href, key, icon: Icon }) => {
            const label = t(key as UIKey);
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${
                  active ? 'bg-brand-tint text-brand-dark font-medium' : 'text-ink-soft hover:bg-page'
                }`}
              >
                <Icon size={16} />
                {label}
                {href === '/notifications' && unread > 0 && (
                  <span className="ml-auto rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* NOT A LOGIN. The demonstration lets you look through each person's
            eyes, because the ownership rules are only convincing when you can
            watch them refuse you something. */}
        <div className="border-t border-page-line p-3">
          <label className="block text-[11px] uppercase tracking-wide text-ink-faint mb-1">
            {t('nav.viewingAs')}
          </label>
          <select
            className="w-full rounded-md border border-page-line bg-white px-2 py-1.5 text-sm"
            value={actor.id}
            onChange={(event) => {
              document.cookie = `academic_actor=${event.target.value}; path=/; max-age=31536000`;
              router.refresh();
            }}
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} — {ROLE_LABEL[person.role]}
              </option>
            ))}
          </select>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
