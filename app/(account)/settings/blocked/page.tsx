import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { listPeople } from '@/server/social/relationships'
import { PageHeader } from '@/components/common/page-header'
import { PersonRow } from '@/components/people/person-row'
import { UndoButton } from '@/components/people/row-actions'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Blocked & muted' }

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [me, t, { tab }] = await Promise.all([requireUser('/settings/blocked'), getT(), searchParams])
  const kind = tab === 'muted' ? 'muted' : 'blocked'
  const rows = await listPeople(kind, me.id)
  return (
    <>
      <PageHeader title={t('settings.sections.blocked')} back="/settings" />
      <nav className="flex border-b">
        {(['blocked', 'muted'] as const).map((k) => (
          <Link key={k} href={`/settings/blocked?tab=${k}`} className={cn('relative flex-1 py-3.5 text-center text-sm font-medium hover:bg-muted', k === kind ? 'text-foreground' : 'text-muted-foreground')}>
            {t(`settings.blocked.${k}`)}{k === kind && <span className="absolute inset-x-1/2 bottom-0 h-1 w-14 -translate-x-1/2 rounded-full bg-primary" />}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? <p className="px-8 py-14 text-center text-muted-foreground">{kind === 'blocked' ? t('settings.blocked.noneBlocked') : t('settings.blocked.noneMuted')}</p> : (
        <div className="divide-y">{rows.map((r) => <PersonRow key={r.id} username={r.username} fullName={r.fullName} avatarUrl={r.avatarUrl} verified={r.verified} sub={r.assemblyName}
          action={<UndoButton id={r.id} kind={kind === 'blocked' ? 'unblock' : 'unmute'} />} />)}</div>
      )}
    </>
  )
}
