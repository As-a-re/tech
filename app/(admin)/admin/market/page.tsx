import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { getSetting } from '@/server/admin/platform-settings'
import { adminOrders, adminProducts, adminRequests, adminShops, marketStats } from '@/server/market/admin'
import { adminPayouts, waitingForDetails } from '@/server/market/payouts'
import { adminDeliveries, adminRiders } from '@/server/market/riders'
import { PayoutList } from '@/components/market/payout-list'
import { AdminHeading, Chips, SearchBox, Stat, fmtDate } from '@/components/admin/ui'
import { PayoutControls, ProductStatusButton, RiderControls, ShopControls } from '@/components/admin/market-controls'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Market' }
const TABS = ['overview', 'orders', 'requests', 'payouts', 'riders', 'deliveries', 'products', 'shops'] as const
type Tab = (typeof TABS)[number]

export default async function MarketAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; s?: string; page?: string; problems?: string }> }) {
  const [t, sp] = await Promise.all([getT(), searchParams])
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'overview'
  const page = Math.max(1, Number(sp.page) || 1)
  const qs = (o: Record<string, string | undefined>) => '/admin/market?' + new URLSearchParams(Object.entries({ tab, q: sp.q, s: sp.s, problems: sp.problems, ...o }).filter(([, v]) => v) as [string, string][]).toString()
  const pager = (hasMore: boolean) => (page > 1 || hasMore) && (
    <nav className="flex justify-between px-4 py-4 text-sm sm:px-6">
      {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="rounded-md border px-3 py-1.5">{t('admin.pager.prev')}</Link> : <span />}
      {hasMore && <Link href={qs({ page: String(page + 1) })} className="rounded-md border px-3 py-1.5">{t('admin.pager.next')}</Link>}
    </nav>
  )
  const empty = <p className="px-6 py-12 text-center text-muted-foreground">{t('market.admin.none')}</p>
  return (
    <>
      <AdminHeading title={t('admin.tabs.market')} />
      <p className="px-4 text-sm text-muted-foreground sm:px-6">{t('market.admin.lead')}</p>
      <div className="px-4 py-3 sm:px-6"><Chips active={tab} items={TABS.map((k) => ({ key: k, label: t(`market.admin.tabs.${k}`), href: k === 'overview' ? '/admin/market' : `/admin/market?tab=${k}` }))} /></div>

      {tab === 'overview' && await (async () => {
        const [s, fee] = await Promise.all([marketStats(), getSetting('marketFeePercent')])
        return (
          <div className="space-y-4 px-4 pb-6 sm:px-6" data-market-stats>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat value={ghs(s.sales)} label={t('market.admin.sales')} sub={t('market.admin.orders', { n: s.orders })} />
              <Stat value={ghs(s.fees)} label={t('market.admin.fees')} />
              <Stat value={ghs(s.held)} label={t('market.admin.held')} />
              <Stat value={ghs(s.refunded)} label={t('market.admin.refunded')} />
              <Link href="/admin/market?tab=requests"><Stat value={s.open_requests} label={t('market.admin.openRequests')} tone={s.open_requests ? 'red' : undefined} /></Link>
              <Link href="/admin/market?tab=orders&s=paid"><Stat value={s.to_accept} label={t('market.admin.toAccept')} /></Link>
              <Link href="/admin/market?tab=requests&s=escalated"><Stat value={s.disputes} label={t('market.admin.disputes')} tone={s.disputes ? 'red' : undefined} /></Link>
              <Link href="/admin/market?tab=riders&s=pending"><Stat value={s.riders_waiting} label={t('market.admin.tabs.riders')} sub={t('market.ride.status.pending')} tone={s.riders_waiting ? 'red' : undefined} /></Link>
              <Link href="/admin/market?tab=payouts"><Stat value={s.payouts_problem} label={t('market.admin.tabs.payouts')} sub={`${t('market.payout.status.failed')} / ${t('market.payout.status.manual')}`} tone={s.payouts_problem ? 'red' : undefined} /></Link>
              <Link href="/admin/market?tab=orders&problems=1"><Stat value={s.refund_pending} label={t('market.admin.refundPending')} tone={s.refund_pending ? 'red' : undefined} /></Link>
              <Stat value={s.products} label={t('market.admin.products')} sub={`${s.shops} · ${t('market.admin.shops')}`} />
            </div>
            <p className="text-sm text-muted-foreground">{t('market.admin.fee', { n: fee })} · <Link href="/admin/settings" className="text-primary hover:underline">{t('admin.tabs.settings')}</Link></p>
          </div>
        )
      })()}

      {tab === 'orders' && await (async () => {
        const r = await adminOrders({ status: sp.s, q: sp.q, page, problems: sp.problems === '1' })
        return (
          <>
            <div className="space-y-3 px-4 pb-3 sm:px-6">
              <SearchBox value={sp.q} placeholder={t('market.admin.searchOrders')} hidden={{ tab, s: sp.s }} />
              <Chips active={sp.problems === '1' ? 'problems' : sp.s ?? 'all'} items={[{ key: 'all', label: t('market.orders.tabs.all'), href: '/admin/market?tab=orders' },
                ...(['paid', 'accepted', 'shipped', 'delivered', 'cancelled'] as const).map((k) => ({ key: k, label: t(`market.status.${k}`), href: `/admin/market?tab=orders&s=${k}` })),
                { key: 'problems', label: t('market.admin.problems'), href: '/admin/market?tab=orders&problems=1' }]} />
            </div>
            {r.rows.length === 0 ? empty : <ul className="divide-y border-t">{r.rows.map((o) => (
              <li key={o.id}><Link href={`/market/orders/${o.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/50 sm:px-6">
                <b className="font-mono">{o.number}</b><span className="min-w-0 flex-1 truncate">{o.shop_name} · @{o.buyer}</span>
                {o.open_request && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">{t(`market.requestKind.${o.open_request as 'cancel'}`)}</span>}
                <span className={cn('text-xs font-semibold', o.status === 'cancelled' ? 'text-brand-red' : 'text-primary')}>{t(`market.status.${o.status}`)}</span>
                <b className="text-sm">{ghs(o.total_pesewas)}</b>{o.refunded_pesewas > 0 && <span className="text-xs text-brand-red">−{ghs(o.refunded_pesewas)}</span>}
                <span className="w-full text-xs text-muted-foreground sm:w-auto">{fmtDate(new Date(o.created_at), true)}</span>
              </Link></li>))}</ul>}
            {pager(r.hasMore)}
          </>
        )
      })()}

      {tab === 'requests' && await (async () => {
        const st = (['open', 'approved', 'declined', 'withdrawn', 'escalated'] as const).find((x) => x === sp.s) ?? 'open'
        const rows = await adminRequests(st)
        return (
          <>
            <div className="px-4 pb-3 sm:px-6"><Chips active={st} items={(['open', 'escalated', 'approved', 'declined', 'withdrawn'] as const).map((k) => ({ key: k, label: k === 'escalated' ? t('market.admin.disputes') : t(`market.requestStatus.${k}`), href: `/admin/market?tab=requests&s=${k}` }))} /></div>
            {rows.length === 0 ? empty : <ul className="divide-y border-t">{rows.map((r) => (
              <li key={r.id}><Link href={`/market/orders/${r.order_id}`} className="block space-y-1 px-4 py-3 hover:bg-muted/50 sm:px-6">
                <p className="flex flex-wrap gap-x-2"><b>{t(`market.requestKind.${r.kind as 'cancel'}`)}</b><span className="font-mono">{r.number}</span><span className="text-muted-foreground">{r.shop_name} · @{r.buyer} · {ghs(r.total_pesewas)}</span></p>
                <p className="text-sm">{t(`market.reasons.${r.reason}` as MessageKey)}{r.details && ` · “${r.details}”`}</p>
                <p className="text-xs text-muted-foreground">{fmtDate(new Date(r.created_at), true)}</p>
              </Link></li>))}</ul>}
          </>
        )
      })()}

      {tab === 'payouts' && await (async () => {
        const [rows, waiting] = await Promise.all([adminPayouts(sp.s), waitingForDetails()])
        return (
          <div className="space-y-3 px-4 pb-6 sm:px-6">
            <Chips active={sp.s ?? 'all'} items={[{ key: 'all', label: t('market.orders.tabs.all'), href: '/admin/market?tab=payouts' }, ...(['failed', 'manual', 'processing', 'pending', 'paid'] as const).map((k) => ({ key: k, label: t(`market.payout.status.${k}`), href: `/admin/market?tab=payouts&s=${k}` }))]} />
            {rows.length ? <PayoutList rows={rows} t={t} actions={(p) => <PayoutControls id={p.id} status={p.status} />} /> : <p className="py-10 text-center text-muted-foreground">{t('market.admin.noPayouts')}</p>}
            {waiting.length > 0 && <section className="space-y-1 rounded-2xl border p-4"><h2 className="font-bold">{t('market.admin.waiting')}</h2>
              {waiting.map((w) => <p key={w.username + w.kind} className="text-sm">{w.name} (@{w.username}) · {ghs(w.total)}</p>)}</section>}
          </div>
        )
      })()}

      {tab === 'riders' && await (async () => {
        const rows = await adminRiders(sp.s)
        return (
          <>
            <div className="px-4 pb-3 sm:px-6"><Chips active={sp.s ?? 'all'} items={[{ key: 'all', label: t('market.orders.tabs.all'), href: '/admin/market?tab=riders' }, ...(['pending', 'active', 'paused', 'rejected', 'suspended'] as const).map((k) => ({ key: k, label: t(`market.ride.status.${k}`), href: `/admin/market?tab=riders&s=${k}` }))]} /></div>
            {rows.length === 0 ? <p className="px-6 py-12 text-center text-muted-foreground">{t('market.admin.noRiders')}</p> : <ul className="divide-y border-t">{rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6" data-admin-rider={r.status}>
                <span className="min-w-0 flex-1"><Link href={`/admin/accounts/${r.user_id}`} className="font-semibold hover:underline">{r.name}</Link> <span className="text-sm text-muted-foreground">@{r.username}</span>
                  <span className="block text-xs text-muted-foreground">{t(`market.ride.vehicle.${r.vehicle as 'car'}`)}{r.plate && ` · ${r.plate}`} · {r.areas.join(', ')} · {t('market.admin.deliveriesN', { n: r.done })} · {t(`market.ride.status.${r.status as 'active'}`)}</span>
                  {r.about && <span className="block text-xs">“{r.about}”</span>}</span>
                <RiderControls id={r.id} status={r.status} />
              </li>))}</ul>}
          </>
        )
      })()}

      {tab === 'deliveries' && await (async () => {
        const rows = await adminDeliveries(sp.s)
        return (
          <>
            <div className="px-4 pb-3 sm:px-6"><Chips active={sp.s ?? 'all'} items={[{ key: 'all', label: t('market.orders.tabs.all'), href: '/admin/market?tab=deliveries' }, ...(['open', 'accepted', 'picked_up', 'delivered', 'cancelled'] as const).map((k) => ({ key: k, label: k === 'open' ? t('market.order.riderWaiting') : k === 'cancelled' ? t('market.status.cancelled') : t(`market.ride.steps.${k}`), href: `/admin/market?tab=deliveries&s=${k}` }))]} /></div>
            {rows.length === 0 ? empty : <ul className="divide-y border-t">{rows.map((d) => (
              <li key={d.id}><Link href={`/market/orders/${d.orderId}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/50 sm:px-6">
                <b className="font-mono">{d.number}</b><span className="min-w-0 flex-1 truncate text-sm">{d.shopName} → {d.dropoffTown ?? '—'}{d.rider && ` · ${d.rider}`}</span>
                <span className="text-xs font-semibold text-primary">{d.status}</span><b className="text-sm">{ghs(d.feePesewas)}</b>
              </Link></li>))}</ul>}
          </>
        )
      })()}

      {tab === 'products' && await (async () => {
        const r = await adminProducts({ q: sp.q, status: sp.s, page })
        return (
          <>
            <div className="space-y-3 px-4 pb-3 sm:px-6">
              <SearchBox value={sp.q} placeholder={t('market.admin.searchProducts')} hidden={{ tab, s: sp.s }} />
              <Chips active={sp.s ?? 'all'} items={[{ key: 'all', label: t('market.orders.tabs.all'), href: '/admin/market?tab=products' }, ...(['active', 'draft', 'removed'] as const).map((k) => ({ key: k, label: t(`market.admin.status.${k}`), href: `/admin/market?tab=products&s=${k}` }))]} />
            </div>
            {r.rows.length === 0 ? empty : <ul className="divide-y border-t">{r.rows.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <span className="size-12 shrink-0 overflow-hidden rounded-lg border bg-muted">{p.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt="" className="size-full object-cover" />}</span>
                <span className="min-w-0 flex-1"><Link href={`/market/p/${p.id}`} className="line-clamp-1 font-semibold hover:underline">{p.title}</Link>
                  <span className="block text-xs text-muted-foreground">{p.shop_name} · {ghs(p.price_pesewas)} · {t('market.admin.stock', { n: p.stock })} · {t(`market.admin.status.${p.status as 'active'}`)}{p.reports > 0 && <b className="text-brand-red"> · {t('market.admin.reports', { n: p.reports })}</b>}</span></span>
                <ProductStatusButton id={p.id} removed={p.status === 'removed'} />
              </li>))}</ul>}
            {pager(r.hasMore)}
          </>
        )
      })()}

      {tab === 'shops' && await (async () => {
        const r = await adminShops({ q: sp.q, page })
        return (
          <>
            <div className="px-4 pb-3 sm:px-6"><SearchBox value={sp.q} placeholder={t('market.admin.searchShops')} hidden={{ tab }} /></div>
            {r.rows.length === 0 ? empty : <ul className="divide-y border-t">{r.rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
                <span className="min-w-0 flex-1"><Link href={`/market/shop/${s.slug}`} className="font-semibold hover:underline">{s.name}</Link>{s.verified && <span className="ml-1 text-primary">✓</span>}
                  <span className="block text-xs text-muted-foreground">@{s.owner} · {t('market.shop.products', { n: s.products })} · {t('market.admin.orders', { n: s.orders })} · {t(`market.admin.status.${s.status as 'active'}`)}{s.reports > 0 && <b className="text-brand-red"> · {t('market.admin.reports', { n: s.reports })}</b>}</span></span>
                <ShopControls id={s.id} suspended={s.status === 'suspended'} verified={s.verified} />
              </li>))}</ul>}
            {pager(r.hasMore)}
          </>
        )
      })()}
    </>
  )
}
