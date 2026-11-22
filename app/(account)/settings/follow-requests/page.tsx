import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { listPeople } from '@/server/social/relationships'
import { PageHeader } from '@/components/common/page-header'
import { PersonRow } from '@/components/people/person-row'
import { RequestActions } from '@/components/people/row-actions'

export const metadata = { title: 'Follow requests' }

export default async function Page() {
  const [me, t] = await Promise.all([requireUser('/settings/follow-requests'), getT()])
  const rows = await listPeople('requests', me.id)
  return (
    <>
      <PageHeader title={t('profile.requestsTitle')} back="/settings" />
      {rows.length === 0 ? <p className="px-8 py-14 text-center text-muted-foreground">{t('profile.noRequests')}</p> : (
        <div className="divide-y">{rows.map((r) => <PersonRow key={r.id} username={r.username} fullName={r.fullName} avatarUrl={r.avatarUrl} verified={r.verified} sub={r.assemblyName} bio={r.bio} action={<RequestActions id={r.id} />} />)}</div>
      )}
    </>
  )
}
