import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { attendees, getEvent } from '@/server/community/events'
import { PageHeader } from '@/components/common/page-header'
import { PersonRow } from '@/components/people/person-row'
import { LinkTabs } from '@/components/community/tabs'

export const metadata = { title: "Who's coming" }

export default async function Attendees({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab }, t, me] = await Promise.all([params, searchParams, getT(), getCurrentUser()])
  const e = await getEvent(id, me?.id ?? null)
  if (!e) notFound()
  const status = tab === 'interested' ? 'interested' : 'going'
  const people = await attendees(id, status)
  return (
    <>
      <PageHeader title={e.title} subtitle={t('events.attendees')} back={`/events/${id}`} />
      <LinkTabs active={status} items={[
        { key: 'going', label: t('events.rsvp.goingCount', { n: e.goingCount }), href: `/events/${id}/attendees` },
        { key: 'interested', label: t('events.rsvp.interestedCount', { n: e.interestedCount }), href: `/events/${id}/attendees?tab=interested` },
      ]} />
      <div className="divide-y">{people.map((p) => <PersonRow key={p.id} username={p.username} fullName={p.fullName} avatarUrl={p.avatarUrl} verified={p.verified} sub={p.assemblyName} bio={p.bio} />)}</div>
    </>
  )
}
