import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/server/identity/session'
import { myShop } from '@/server/market/seller'
import { SellerNav } from '@/components/market/seller-nav'

/** Seller area. Members without a shop see "Become a seller" (the pages check on the server too). */
export default async function SellLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser()
  const shop = me ? await myShop(me.id) : null
  if (!shop) return <>{children}</>
  const sb = createSupabaseAdminClient()
  const [{ count: paidCount, error: pe }, { data: requests, error: re }, { data: products, error: pr }] = await Promise.all([
    sb.from('market_orders').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('status', 'paid'),
    sb.from('market_requests').select('order_id').eq('status', 'open'),
    sb.from('products').select('id').eq('shop_id', shop.id).is('deleted_at', null),
  ])
  if (pe || re || pr) throw new Error(`Unable to load seller navigation counts: ${(pe || re || pr)?.message}`)
  const orderIds = (requests ?? []).map((r: any) => r.order_id)
  const { count: openRequests, error: ore } = orderIds.length ? await sb.from('market_orders').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).in('id', orderIds) : { count: 0, error: null }
  if (ore) throw new Error(`Unable to load seller requests: ${ore.message}`)
  const productIds = (products ?? []).map((p: any) => p.id)
  const { count: questions, error: qe } = productIds.length ? await sb.from('product_questions').select('id', { count: 'exact', head: true }).in('product_id', productIds).is('answer', null).is('hidden_at', null) : { count: 0, error: null }
  if (qe) throw new Error(`Unable to load seller questions: ${qe.message}`)
  const c = { orders: (paidCount ?? 0) + (openRequests ?? 0), questions: questions ?? 0 }
  return <><SellerNav badges={{ orders: c.orders, questions: c.questions }} />{children}</>
}
