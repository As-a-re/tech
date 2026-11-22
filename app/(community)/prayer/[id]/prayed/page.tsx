import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { getPrayer, prayedBy } from '@/server/devotion/prayer'
import { PageHeader } from '@/components/common/page-header'
import { PersonRow } from '@/components/people/person-row'

export const metadata = { title: 'Who prayed' }

export default async function Prayed({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const p = await getPrayer(id, me ? { id: me.id, assemblyId: me.assemblyId, isAdmin: me.role === 'tech_admin' } : null)
  if (!p) notFound()
  const people = await prayedBy(id)
  return (
    <>
      <PageHeader title={t('prayer.prayedBy')} subtitle={t('prayer.prayedCount', { n: p.prayedCount })} back={`/prayer/${id}`} />
      <div className="divide-y">{people.map((u) => <PersonRow key={u.id} username={u.username} fullName={u.fullName} avatarUrl={u.avatarUrl} verified={u.verified} sub={u.assemblyName} bio={u.bio} />)}</div>
    </>
  )
}
