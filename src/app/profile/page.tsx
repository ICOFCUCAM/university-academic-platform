import { notFound } from 'next/navigation';
import { getStore } from '@/lib/data';
import { currentActor } from '@/lib/session';
import { LearningProfile } from '@/components/LearningProfile';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Profile() {
  const actor = await currentActor();
  const person = await getStore().person(actor.id);
  if (!person) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="My learning profile"
        title={person.name}
        subtitle="One working language, and a voice you choose. The first is your academic environment; the second is only how it sounds."
      />
      <div className="px-6 py-6 md:px-8">
        <LearningProfile person={person} isStudent={person.role === 'student'} />
      </div>
    </div>
  );
}
