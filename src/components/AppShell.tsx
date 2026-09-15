'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, GraduationCap, LayoutDashboard, Settings, Sparkles } from 'lucide-react';
import type { Person } from '@/lib/domain/types';
import { ROLE_LABEL, type Role } from '@/lib/capabilities';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/lectures', label: 'Lectures', icon: BookOpen },
  { href: '/courses', label: 'Courses', icon: GraduationCap },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({
  actor, people, children,
}: {
  actor: { id: string; role: Role; name: string };
  people: Person[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen flex">
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
          {NAV.map(({ href, label, icon: Icon }) => {
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
              </Link>
            );
          })}
        </nav>

        {/* NOT A LOGIN. The demonstration lets you look through each person's
            eyes, because the ownership rules are only convincing when you can
            watch them refuse you something. */}
        <div className="border-t border-page-line p-3">
          <label className="block text-[11px] uppercase tracking-wide text-ink-faint mb-1">
            Viewing as
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
