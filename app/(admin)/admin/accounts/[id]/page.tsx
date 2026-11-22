import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { formatPhone } from '@/lib/identity/normalise'
import { getCurrentUser } from '@/server/identity/session'
import { getAccount } from '@/server/admin/accounts'
import { PageHeader } from '@/components/common/page-header'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { Panel, fmtDate } from '@/components/admin/ui'
import { ActionButton, VerifiedForm } from './controls'

export const metadata = { title: 'Account' }

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const a = await getAccount(id)
  if (!a) notFound()
  const self = me?.id === a.id
  const rows: [string, React.ReactNode][] = [
    ['Church ID', <Link key="c" className="font-mono text-primary hover:underline" href={`/admin/members/${encodeURIComponent(a.churchId)}`}>{a.churchId}</Link>],
    [t('settings.account.phone'), formatPhone(a.phone)], ['Email', a.email ?? '—'],
    [t('settings.account.assembly'), `${a.assemblyName}, ${a.districtName}`],
    [t('admin.accounts.role'), a.role === 'tech_admin' ? 'Tech Admin' : t('settings.account.member')],
    [t('admin.accounts.status'), a.status === 'suspended' ? t('admin.accounts.suspended') : t('admin.members.activeLabel')],
    [t('admin.accounts.joined'), fmtDate(a.createdAt)], [t('admin.accounts.lastSeen'), a.lastSeenAt ? fmtDate(a.lastSeenAt, true) : t('admin.accounts.never')],
    [t('admin.accounts.devices'), String(a.sessions)], [t('admin.accounts.twoFa'), a.totpEnabledAt ? t('admin.accounts.on') : t('admin.accounts.off')],
  ]
  return (
    <>
      <PageHeader title={a.fullName} subtitle={`@${a.username}`} back="/admin/accounts" />
      <div className="space-y-5 p-4 sm:p-6">
        <Panel>
          <div className="flex items-center gap-3">
            <UserAvatar name={a.fullName} src={a.avatarUrl} className="size-14" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-lg font-bold">{a.fullName}{a.verifiedAt && <VerifiedBadge label={a.verifiedLabel} />}</p>
              <Link href={`/u/${a.username}`} className="text-sm text-primary hover:underline">{t('admin.accounts.viewProfile')}</Link>
            </div>
          </div>
          <dl className="mt-4 divide-y rounded-xl bg-muted/50 text-sm">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
          </dl>
        </Panel>
        <Panel title={t('admin.accounts.verifiedTitle')} note={t('admin.accounts.verifiedNote')}>
          <VerifiedForm id={a.id} verified={!!a.verifiedAt} label={a.verifiedLabel ?? ''} />
        </Panel>
        {!self && (
          <Panel title={t('admin.accounts.role')}>
            {a.role === 'tech_admin'
              ? <ActionButton kind="role" id={a.id} value="member" label={t('admin.accounts.removeAdmin')} danger />
              : <ActionButton kind="role" id={a.id} value="tech_admin" label={t('admin.accounts.makeAdmin')} />}
          </Panel>
        )}
        <Panel title={t('admin.accounts.reset2fa')} note={t('admin.accounts.reset2faNote')}>
          <ActionButton kind="reset2fa" id={a.id} label={t('admin.accounts.reset2fa')} disabled={!a.totpEnabledAt} />
        </Panel>
        <Panel title={t('admin.accounts.signOutAll')}>
          <ActionButton kind="signout" id={a.id} label={t('admin.accounts.signOutAll')} disabled={a.sessions === 0} />
        </Panel>
        {!self && (
          <Panel title={a.status === 'suspended' ? t('admin.accounts.restore') : t('admin.accounts.suspend')} note={t('admin.accounts.suspendNote')}>
            {a.status === 'suspended'
              ? <ActionButton kind="status" id={a.id} value="active" label={t('admin.accounts.restore')} />
              : <ActionButton kind="status" id={a.id} value="suspended" label={t('admin.accounts.suspend')} danger />}
          </Panel>
        )}
      </div>
    </>
  )
}
