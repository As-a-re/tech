import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { stats, topAssemblies, failedSignInsToday } from '@/server/admin/dashboard'
import { listAudit } from '@/server/admin/audit-log'
import { openReportCount } from '@/server/moderation/reports'
import { contentStats } from '@/server/admin/content'
import { AdminHeading, Panel, Stat, fmtDate } from '@/components/admin/ui'
import { env } from '@/lib/env'
import { nativePushEnabled, pushEnabled } from '@/integrations/push'
import { storageDriver } from '@/integrations/storage'
import { churchSyncStatus } from '@/server/identity/church-sync'
import { livekitEnabled } from '@/integrations/livekit'
import { paymentProvider, paymentsLive } from '@/integrations/payments'
import { monthTotal } from '@/server/admin/dashboard'
import { ghs } from '@/lib/give/money'
import { callsToday } from '@/server/admin/dashboard'

export const metadata = { title: 'Dashboard' }

export default async function Dashboard() {
  const [t, s, top, failed, recent, openReports, content, calls, given] = await Promise.all([getT(), stats(), topAssemblies(), failedSignInsToday(), listAudit({ page: 1 }), openReportCount(), contentStats(), callsToday(), monthTotal()])
  const sync = await churchSyncStatus()
  const services = [
    { name: t('admin.services.sms'), on: env.smsProvider === 'arkesel', note: env.smsProvider === 'arkesel' ? 'Arkesel' : t('admin.services.smsConsole') },
    { name: t('admin.services.push'), on: pushEnabled(), note: pushEnabled() ? t('admin.services.on') : t('admin.services.pushOff') },
    { name: t('admin.services.calls'), on: livekitEnabled(), note: livekitEnabled() ? t('admin.services.callsToday', { n: calls }) : t('admin.services.callsOff') },
    { name: t('admin.services.apps'), on: nativePushEnabled(), note: nativePushEnabled() ? t('admin.services.on') : t('admin.services.appsOff') },
    { name: t('admin.services.storage'), on: storageDriver() === 's3', note: storageDriver() === 's3' ? t('admin.services.storageS3', { bucket: process.env.S3_BUCKET ?? '' }) : t('admin.services.storageLocal') },
    { name: t('admin.services.church'), on: env.churchDbMode === 'api' && !sync?.lastError, note: env.churchDbMode !== 'api' ? t('admin.services.churchLocal')
      : sync?.lastError ? t('admin.services.churchError', { error: sync.lastError }) : sync?.lastRunAt ? t('admin.services.churchSynced', { date: fmtDate(new Date(sync.lastRunAt), true), n: sync.lastCount }) : t('admin.services.churchWaiting') },
    { name: t('admin.services.payments'), on: paymentsLive(), note: paymentProvider() === 'sandbox' ? t('admin.services.paymentsSandbox') : paymentsLive() ? t('admin.services.paymentsLive', { amount: ghs(given) }) : t('admin.services.paymentsTest') },
  ]
  const max = Math.max(1, ...top.map((x) => x.n))
  return (
    <>
      <AdminHeading title={t('admin.tabs.dashboard')} />
      <div className="space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat value={s.register} label={t('admin.dash.register')} sub={`${s.active.toLocaleString()} ${t('admin.dash.active').toLowerCase()}`} />
          <Stat value={s.accounts} label={t('admin.dash.accounts')} sub={t('admin.dash.uptake', { n: s.uptake })} />
          <Stat value={s.newAccounts} label={t('admin.dash.newWeek')} />
          <Stat value={s.activeWeek} label={t('admin.dash.activeWeek')} />
          <Stat value={s.districts} label={t('admin.dash.districts')} />
          <Stat value={s.assemblies} label={t('admin.dash.assemblies')} />
          <Stat value={s.twoFa} label={t('admin.dash.twoFa')} sub={`${s.admins} ${t('admin.dash.admins').toLowerCase()}`} />
          <Link href="/admin/content" className="contents"><Stat value={content.announcements} label={t('admin.dash.announcements')} sub={`${content.events} ${t('admin.dash.events').toLowerCase()}`} /></Link>
          <Link href="/admin/reports" className="contents"><Stat value={openReports} label={t('admin.dash.openReports')} tone={openReports > 0 ? 'red' : undefined} /></Link>
          <Stat value={failed} label={t('admin.dash.failed')} sub={s.suspended ? `${s.suspended} ${t('admin.dash.suspended').toLowerCase()}` : undefined} tone={failed > 20 ? 'red' : undefined} />
        </div>
        <Panel title={t('admin.services.title')}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-services>
            {services.map((x) => (
              <li key={x.name} className="flex items-start gap-3 rounded-xl border p-3">
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${x.on ? 'bg-green-500' : 'bg-amber-500'}`} />
                <span><b className="block text-sm">{x.name}</b><span className="text-xs text-muted-foreground">{x.note}</span></span>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title={t('admin.dash.topAssemblies')}>
            <ul className="space-y-2.5">
              {top.map((a) => (
                <li key={a.name} className="text-sm">
                  <div className="flex justify-between"><span className="truncate">{a.name}</span><span className="tabular-nums text-muted-foreground">{a.n}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(a.n / max) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={t('admin.dash.recent')}>
            <ul className="divide-y text-sm">
              {recent.rows.slice(0, 8).map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0"><span className="font-mono text-xs">{r.action}</span>{r.username && <span className="text-muted-foreground"> · @{r.username}</span>}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(r.createdAt, true)}</span>
                </li>
              ))}
            </ul>
            <Link href="/admin/audit" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">{t('admin.dash.viewAll')}</Link>
          </Panel>
        </div>
      </div>
    </>
  )
}
