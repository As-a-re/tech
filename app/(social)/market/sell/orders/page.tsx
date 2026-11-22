import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { dayLabel } from '@/lib/community/dates'
import { requireShop } from '@/server/market/require-shop'
import { shopOrders } from '@/server/market/orders'
import { orderCounts, sellerRequests } from '@/server/market/seller'
import { LinkChips } from '@/components/community/tabs'
import { OrderRow } from '@/components/market/order-row'

export const metadata = { title: 'Orders to my shop' }
const TABS = ['all', 'paid', 'accepted', 'packed', 'shipped', 'requests', 'delivered', 'cancelled'] as const

export default async function SellerOrders({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const [{ me }, t, sp] = await Promise.all([requireShop('/market/sell/orders'), getT(), searchParams])
  const [counts, requests] = await Promise.all([orderCounts(me), sellerRequests(me)])
  const tab = TABS.includes(sp.s as never) ? sp.s! : counts.paid ? 'paid' : requests.length ? 'requests' : 'all'
  const rows = tab === 'requests' ? [] : await shopOrders(me, tab === 'all' ? undefined : tab)
  const label = (k: (typeof TABS)[number]) => {
    const n = k === 'requests' ? requests.length : k === 'all' ? 0 : counts[k] ?? 0
    return `${k === 'requests' ? t('market.sell.orders.requests') : t(`market.sell.orders.tabs.${k}`)}${n && k !== 'delivered' && k !== 'cancelled' ? ` · ${n}` : ''}`
  }
  return (
    <>
      <h1 className="px-4 pt-5 text-xl font-bold">{t('market.sell.orders.title')}</h1>
      <div className="border-b px-4 py-3"><LinkChips active={tab} items={TABS.map((k) => ({ key: k, label: label(k), href: `/market/sell/orders?s=${k}` }))} /></div>
      {tab === 'requests' ? (requests.length === 0 ? <p className="px-8 py-14 text-center text-muted-foreground">{t('market.sell.orders.none')}</p> : (
        <ul className="divide-y" data-seller-requests={requests.length}>{requests.map((r) => (
          <li key={r.id}><Link href={`/market/orders/${r.order_id}`} className="block space-y-1 px-4 py-3 hover:bg-muted/50">
            <p className="flex flex-wrap gap-x-2"><b>{t(`market.requestKind.${r.kind as 'cancel'}`)}</b><span className="font-mono text-sm">{r.number}</span><span className="text-sm text-muted-foreground">{r.buyer} · {ghs(r.total_pesewas)}</span></p>
            <p className="text-sm">{t(`market.reasons.${r.reason}` as MessageKey)}{r.details && ` · “${r.details}”`}</p>
            <p className="text-xs text-muted-foreground">{dayLabel(r.created_at)}</p>
          </Link></li>))}</ul>
      )) : rows.length === 0 ? <p className="px-8 py-14 text-center text-muted-foreground">{t('market.sell.orders.none')}</p>
        : <ul className="divide-y" data-sales={rows.length}>{rows.map((o) => <OrderRow key={o.id} o={o} t={t} seller />)}</ul>}
    </>
  )
}
