import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { env } from '@/lib/env'
import { getMember } from '@/server/admin/register'
import { PageHeader } from '@/components/common/page-header'
import { Notice } from '@/components/common/notice'
import { MemberForm } from '@/components/admin/member-form'
import { ActiveToggle } from './active-toggle'
import { Panel, fmtDate } from '@/components/admin/ui'

export const metadata = { title: 'Member' }

export default async function MemberPage({ params, searchParams }: { params: Promise<{ churchId: string }>; searchParams: Promise<{ notice?: string }> }) {
  const [{ churchId }, { notice }, t] = await Promise.all([params, searchParams, getT()])
  const m = await getMember(decodeURIComponent(churchId))
  if (!m) notFound()
  const readOnly = env.churchDbMode === 'api'
  return (
    <>
      {notice === 'added' && <Notice message={t('admin.members.added')} />}
      <PageHeader title={m.fullName} subtitle={m.churchId} back="/admin/members" />
      <div className="space-y-5 p-4 sm:p-6">
        {readOnly && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{t('admin.apiMode')}</p>}
        <Panel>
          <MemberForm existing={m.churchId} readOnly={readOnly} values={{
            churchId: m.churchId, fullName: m.fullName, phone: `0${m.phone.slice(3)}`, dateOfBirth: m.dateOfBirth ?? '',
            assembly: { id: m.assemblyId, name: m.assemblyName, town: null, districtName: m.districtName },
          }} />
        </Panel>
        <Panel title={t('admin.members.linked')}>
          {m.userId ? <Link href={`/admin/accounts/${m.userId}`} className="font-medium text-primary hover:underline">@{m.username}</Link> : <p className="text-sm text-muted-foreground">{t('admin.members.notYet')}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{fmtDate(m.syncedAt, true)}</p>
        </Panel>
        {!readOnly && <Panel title={m.active ? t('admin.members.deactivate') : t('admin.members.activate')} note={t('admin.members.deactivateNote')}><ActiveToggle churchId={m.churchId} active={m.active} /></Panel>}
      </div>
    </>
  )
}
