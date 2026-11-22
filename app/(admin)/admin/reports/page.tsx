import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { listReports } from '@/server/moderation/reports'
import { AdminHeading, Chips, fmtDate } from '@/components/admin/ui'
import { ReportActions } from '@/components/admin/report-actions'

export const metadata = { title: 'Reports' }
const STATUSES = ['open', 'actioned', 'dismissed'] as const

export default async function Reports({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const [t, sp] = await Promise.all([getT(), searchParams])
  const status = STATUSES.includes(sp.s as never) ? (sp.s as (typeof STATUSES)[number]) : 'open'
  const rows = await listReports(status)
  return (
    <>
      <AdminHeading title={t('admin.tabs.reports')} />
      <div className="px-4 py-3 sm:px-6">
        <Chips active={status} items={STATUSES.map((k) => ({ key: k, label: t(`admin.reports.${k}`), href: k === 'open' ? '/admin/reports' : `/admin/reports?s=${k}` }))} />
      </div>
      {rows.length === 0 ? <p className="px-6 py-12 text-center text-muted-foreground">{t('admin.reports.none')}</p> : (
        <ul className="divide-y border-t">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-brand-red/10 px-2.5 py-0.5 text-xs font-semibold text-brand-red">{t(`report.reasons.${r.reason}`)}</span>
                <span className="font-semibold">{r.postId ? t('admin.reports.post') : r.announcementId ? t('admin.reports.announcement') : r.eventId ? t('admin.reports.event') : r.prayerId ? t('admin.reports.prayer') : r.testimonyId ? t('admin.reports.testimony') : r.conversationId ? t('admin.reports.group') : r.productId ? t('admin.reports.product') : r.shopId ? t('admin.reports.shop') : t('admin.reports.member')}</span>
                {r.targetUsername && <span className="text-muted-foreground">@{r.targetUsername}</span>}
                {r.sameTarget > 1 && <span className="text-xs font-semibold text-brand-red">{t('admin.reports.times', { n: r.sameTarget })}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{fmtDate(r.createdAt, true)}</span>
              </div>
              {r.postId && (r.postDeleted ? <p className="text-sm italic text-muted-foreground">{t('admin.reports.postGone')}</p>
                : <p className="line-clamp-3 rounded-lg border bg-muted/30 px-3 py-2 text-[15px]">{r.postBody}</p>)}
              {(r.announcementId || r.eventId || r.prayerId || r.testimonyId || r.conversationId || r.productId || r.shopId) && (r.itemDeleted ? <p className="text-sm italic text-muted-foreground">{t('admin.reports.itemGone')}</p>
                : <p className="rounded-lg border bg-muted/30 px-3 py-2 text-[15px] font-semibold">{r.itemTitle}</p>)}
              {r.details && <p className="text-sm">“{r.details}”</p>}
              <p className="text-xs text-muted-foreground">{t('admin.reports.reportedBy', { username: r.reporterUsername })}{r.resolution && ` · ${t('admin.reports.resolution', { r: r.resolution })}`}</p>
              <div className="flex flex-wrap gap-2">
                {r.postId && !r.postDeleted && <Link href={`/post/${r.postId}`} className="rounded-full border px-3 py-1 text-sm font-medium hover:bg-muted">{t('admin.reports.viewPost')}</Link>}
                {(r.announcementId || r.eventId || r.prayerId || r.testimonyId) && !r.itemDeleted && <Link href={r.announcementId ? `/announcements/${r.announcementId}` : r.eventId ? `/events/${r.eventId}` : r.prayerId ? `/prayer/${r.prayerId}` : `/testimonies/${r.testimonyId}`} className="rounded-full border px-3 py-1 text-sm font-medium hover:bg-muted">{t('admin.reports.viewItem')}</Link>}
                {(r.productId || r.shopSlug) && <Link href={r.productId ? `/market/p/${r.productId}` : `/market/shop/${r.shopSlug}`} className="rounded-full border px-3 py-1 text-sm font-medium hover:bg-muted">{t('admin.reports.viewItem')}</Link>}
                {r.targetUsername && <Link href={`/admin/accounts/${r.targetId}`} className="rounded-full border px-3 py-1 text-sm font-medium hover:bg-muted">{t('admin.reports.viewProfile')}</Link>}
                {status === 'open' && <ReportActions id={r.id} canRemove={(!!r.postId && !r.postDeleted) || ((!!r.announcementId || !!r.eventId || !!r.prayerId || !!r.testimonyId || !!r.conversationId || !!r.productId || !!r.shopId) && !r.itemDeleted)} removeLabel={r.postId ? undefined : r.conversationId ? t('admin.reports.closeGroup') : r.shopId ? t('admin.reports.suspendShop') : r.productId ? t('admin.reports.removeProduct') : t('admin.reports.removeContent')} canSuspend={!!r.targetId && r.targetStatus !== 'suspended'} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
