import Link from 'next/link'
import { Store } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { myOrders, ORDER_TABS, type OrderTab } from '@/server/market/orders'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/common/page-header'
import { LinkTabs } from '@/components/community/tabs'
import { OrderRow } from '@/components/market/order-row'

export const metadata = { title: 'My orders' }

export default async function MyOrders({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [me, t, sp] = await Promise.all([requireUser('/market/orders'), getT(), searchParams])
  const tab: OrderTab = ORDER_TABS.includes(sp.tab as OrderTab) ? (sp.tab as OrderTab) : 'all'
  const [rows, sellerResult] = await Promise.all([myOrders(me.id, tab), createSupabaseAdminClient().from('shops').select('id', { count: 'exact', head: true }).eq('owner_id', me.id).is('deleted_at', null)])
  if (sellerResult.error) throw new Error(`Unable to check seller status: ${sellerResult.error.message}`)
  const seller = sellerResult.count ?? 0
  return (
    <>
      <PageHeader title={t('market.orders.title')} back="/market" action={seller > 0 && <Link href="/market/sell/orders" className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><Store className="size-4" />{t('market.orders.shopOrders')}</Link>} />
      <LinkTabs active={tab} items={ORDER_TABS.map((k) => ({ key: k, label: t(`market.orders.tabs.${k}`), href: k === 'all' ? '/market/orders' : `/market/orders?tab=${k}` }))} />
      {rows.length === 0 ? <div className="space-y-4 px-8 py-14 text-center"><p className="text-muted-foreground">{t('market.orders.none')}</p>
        <Link href="/market" className="inline-block rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-foreground">{t('market.cart.browse')}</Link></div>
        : <ul className="divide-y" data-orders={rows.length}>{rows.map((o) => <OrderRow key={o.id} o={o} t={t} />)}</ul>}
    </>
  )
}
