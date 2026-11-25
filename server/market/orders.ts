import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { hit } from '@/server/identity/rate-limit'
import { notify } from '@/server/notifications/notify'
import { refundPayment } from '@/integrations/payments'
import { sendSms } from '@/integrations/sms'
import { ghs } from '@/lib/give/money'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { iso, isId, orderEvent, type Who } from './shared'
import { fireStockAlerts } from './catalog'

export type OrderStatus = (typeof schema.marketOrderStatus.enumValues)[number]
export const ACTIVE: OrderStatus[] = ['paid', 'accepted', 'packed', 'shipped']
/** A paid order the seller hasn't accepted after this long is cancelled and refunded. */
export const ACCEPT_WITHIN_HOURS = 72
/** After a seller declines, the buyer has this long to ask a Tech Admin to decide. */
export const ESCALATE_DAYS = 7
export const REQUEST_REASONS = ['changed_mind', 'wrong_item', 'damaged', 'not_as_described', 'not_received', 'late', 'other'] as const
export type RequestReason = (typeof REQUEST_REASONS)[number]

/* ───────── Lists ───────── */
export type OrderRow = {
  id: string; number: string; shopName: string; shopSlug: string | null; status: OrderStatus; fulfilment: 'delivery' | 'pickup'; totalPesewas: number; createdAt: string
  itemCount: number; firstTitle: string; images: string[]; buyerName: string | null; openRequest: string | null
}
const ROW_SQL = sql.raw(`o.id, o.number, o.shop_name, (select s.slug from shops s where s.id = o.shop_id) as shop_slug, o.status, o.fulfilment, o.total_pesewas, o.created_at,
  (select coalesce(sum(i.qty), 0)::int from market_order_items i where i.order_id = o.id) as item_count,
  (select i.title from market_order_items i where i.order_id = o.id order by i.total_pesewas desc limit 1) as first_title,
  (select coalesce(json_agg(x.image), '[]'::json) from (select i.image from market_order_items i where i.order_id = o.id and i.image is not null limit 3) x) as images,
  (select u.full_name from users u where u.id = o.buyer_id) as buyer_name,
  (select r.kind::text from market_requests r where r.order_id = o.id and r.status = 'open' limit 1) as open_request`)
type RawRow = { id: string; number: string; shop_name: string; shop_slug: string | null; status: OrderStatus; fulfilment: 'delivery' | 'pickup'; total_pesewas: number; created_at: Date; item_count: number; first_title: string; images: string[]; buyer_name: string | null; open_request: string | null }
const toRow = (r: RawRow): OrderRow => ({ id: r.id, number: r.number, shopName: r.shop_name, shopSlug: r.shop_slug, status: r.status, fulfilment: r.fulfilment, totalPesewas: r.total_pesewas,
  createdAt: iso(r.created_at)!, itemCount: r.item_count, firstTitle: r.first_title ?? '', images: r.images ?? [], buyerName: r.buyer_name, openRequest: r.open_request })

export const ORDER_TABS = ['all', 'active', 'delivered', 'cancelled'] as const
export type OrderTab = (typeof ORDER_TABS)[number]

/** My orders as a buyer. Unpaid (or failed) checkouts show for 2 hours only. */
export async function myOrders(userId: string, tab: OrderTab = 'all') {
  const f = { all: sql`true`, active: sql`o.status in ('paid', 'accepted', 'packed', 'shipped')`, delivered: sql`o.status in ('delivered', 'completed')`, cancelled: sql`o.status = 'cancelled'` }[tab]
  const r = await db.execute<RawRow>(sql`select ${ROW_SQL} from market_orders o where o.buyer_id = ${userId}
    and (o.paid_at is not null or o.created_at > now() - interval '2 hours') and ${f} order by o.created_at desc limit 200`)
  return r.rows.map(toRow)
}

/** Orders to a shop (the seller's list; the full seller dashboard comes in Batch 17). */
export async function shopOrders(user: Who, status?: string) {
  const st = (['paid', 'accepted', 'packed', 'shipped', 'delivered', 'completed', 'cancelled'] as const).find((s) => s === status)
  const r = await db.execute<RawRow>(sql`select ${ROW_SQL} from market_orders o where o.seller_id = ${user.id} and o.paid_at is not null
    ${st ? sql`and o.status = ${st}` : sql``} order by o.created_at desc limit 200`)
  return r.rows.map(toRow)
}

/* ───────── One order ───────── */
export async function getOrder(user: Who, id: string) {
  if (!isId(id)) return null
  const [o] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, id))
  if (!o) return null
  const role = o.buyerId === user.id ? 'buyer' : o.sellerId === user.id ? 'seller' : user.role === 'tech_admin' ? 'admin' : null
  // Sellers only see orders that were paid
  if (!role || (!o.paidAt && role === 'seller')) return null
  const items = await db.execute<{ id: string; product_id: string | null; title: string; variant_name: string; image: string | null; unit_pesewas: number; qty: number; total_pesewas: number; my_rating: number | null }>(sql`
    select i.id, i.product_id, i.title, i.variant_name, i.image, i.unit_pesewas, i.qty, i.total_pesewas,
      (select r.rating from product_reviews r where r.product_id = i.product_id and r.user_id = ${o.buyerId ?? '00000000-0000-0000-0000-000000000000'}) as my_rating
    from market_order_items i where i.order_id = ${id} order by i.total_pesewas desc`)
  const events = await db.execute<{ id: string; kind: string; note: string | null; created_at: Date; actor: string | null }>(sql`
    select e.id, e.kind, e.note, e.created_at, (select u.full_name from users u where u.id = e.actor_id) as actor from market_order_events e where e.order_id = ${id} order by e.created_at, e.id`)
  const requests = await db.select().from(schema.marketRequests).where(eq(schema.marketRequests.orderId, id)).orderBy(desc(schema.marketRequests.createdAt))
  const [shop] = o.shopId ? await db.select({ slug: schema.shops.slug, logoUrl: schema.shops.logoUrl, phone: schema.shops.phone, returnDays: schema.shops.returnDays }).from(schema.shops).where(eq(schema.shops.id, o.shopId)) : []
  const people = await db.execute<{ id: string; full_name: string; username: string; avatar_url: string | null }>(sql`select id, full_name, username, avatar_url from users where id in (${o.buyerId ?? o.id}, ${o.sellerId ?? o.id})`)
  const person = (pid: string | null) => { const p = people.rows.find((x) => x.id === pid); return p ? { id: p.id, fullName: p.full_name, username: p.username, avatarUrl: p.avatar_url } : null }
  const [pay] = o.checkoutId ? await db.select({ reference: schema.payments.reference, status: schema.payments.status, channel: schema.payments.channel })
    .from(schema.payments).where(eq(schema.payments.marketCheckoutId, o.checkoutId)).orderBy(desc(schema.payments.createdAt)).limit(1) : []
  const open = requests.find((r) => r.status === 'open' || r.status === 'escalated') ?? null
  const declined = requests.find((r) => r.status === 'declined' && r.resolvedAt && Date.now() - r.resolvedAt.getTime() < ESCALATE_DAYS * 86_400_000) ?? null
  const dRows = await db.execute<{ id: string; status: 'open' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled'; fee_pesewas: number; created_at: Date; accepted_at: Date | null; picked_up_at: Date | null; delivered_at: Date | null
    rider_name: string | null; rider_username: string | null; rider_phone: string | null; rider_vehicle: string | null; rider_user_id: string | null }>(sql`
    select d.id, d.status, d.fee_pesewas, d.created_at, d.accepted_at, d.picked_up_at, d.delivered_at, u.full_name as rider_name, u.username as rider_username, r.phone as rider_phone, r.vehicle as rider_vehicle, r.user_id as rider_user_id
    from deliveries d left join riders r on r.id = d.rider_id left join users u on u.id = r.user_id where d.order_id = ${id} and d.status <> 'cancelled' order by d.created_at desc limit 1`)
  const d = dRows.rows[0]
  const delivery = d ? { id: d.id, status: d.status, feePesewas: d.fee_pesewas, createdAt: iso(d.created_at)!, acceptedAt: iso(d.accepted_at), pickedUpAt: iso(d.picked_up_at), deliveredAt: iso(d.delivered_at),
    rider: d.rider_name ? { name: d.rider_name, username: d.rider_username!, phone: d.rider_phone, vehicle: d.rider_vehicle, userId: d.rider_user_id! } : null } : null
  const riderBusy = !!delivery && delivery.status !== 'delivered'
  const returnDays = shop?.returnDays ?? 0
  const withinReturn = !!o.deliveredAt && returnDays > 0 && Date.now() - o.deliveredAt.getTime() < returnDays * 86_400_000
  const buyer = role === 'buyer'
  return {
    ...o, createdAt: iso(o.createdAt)!, paidAt: iso(o.paidAt), acceptedAt: iso(o.acceptedAt), packedAt: iso(o.packedAt), shippedAt: iso(o.shippedAt), deliveredAt: iso(o.deliveredAt),
    completedAt: iso(o.completedAt), cancelledAt: iso(o.cancelledAt),
    role, shopSlug: shop?.slug ?? null, shopLogo: shop?.logoUrl ?? null, shopPhone: shop?.phone ?? null, returnDays, buyer: person(o.buyerId), seller: person(o.sellerId),
    // The hand-over code is the buyer's to show; the seller enters it
    handoverCode: buyer ? o.handoverCode : null,
    items: items.rows.map((i) => ({ id: i.id, productId: i.product_id, title: i.title, variantName: i.variant_name, image: i.image, unitPesewas: i.unit_pesewas, qty: i.qty, totalPesewas: i.total_pesewas, myRating: i.my_rating })),
    events: events.rows.map((e) => ({ id: e.id, kind: e.kind, note: e.note, at: iso(e.created_at)!, actor: e.actor })),
    requests: requests.map((r) => ({ id: r.id, kind: r.kind, reason: r.reason, details: r.details, status: r.status, response: r.response, refundPesewas: r.refundPesewas, createdAt: iso(r.createdAt)!, resolvedAt: iso(r.resolvedAt),
      escalatedAt: iso(r.escalatedAt), escalationNote: r.escalationNote })),
    payment: pay ?? null, delivery,
    can: {
      cancel: buyer && o.status === 'paid',
      requestCancel: buyer && (o.status === 'accepted' || o.status === 'packed') && !open,
      confirm: buyer && o.status === 'shipped',
      notReceived: buyer && o.status === 'shipped' && !open && !!o.shippedAt && Date.now() - o.shippedAt.getTime() > 3 * 86_400_000,
      return: buyer && (o.status === 'delivered' || o.status === 'completed') && withinReturn && !open && o.refundedPesewas < o.totalPesewas,
      review: buyer && (o.status === 'delivered' || o.status === 'completed'),
      withdraw: buyer && open?.status === 'open',
      accept: role === 'seller' && o.status === 'paid',
      pack: role === 'seller' && o.status === 'accepted',
      ship: role === 'seller' && (o.status === 'accepted' || o.status === 'packed') && !riderBusy,
      handover: role === 'seller' && o.status === 'shipped' && !riderBusy,
      requestRider: role === 'seller' && o.fulfilment === 'delivery' && (o.status === 'accepted' || o.status === 'packed') && !riderBusy,
      cancelRider: role === 'seller' && !!delivery && (delivery.status === 'open' || delivery.status === 'accepted'),
      escalate: buyer && !open && !!declined && o.escrow === 'held',
      sellerCancel: role === 'seller' && (o.status === 'paid' || o.status === 'accepted' || o.status === 'packed'),
      answer: (role === 'seller' && open?.status === 'open') || (role === 'admin' && !!open),
      refund: role === 'admin' && !!o.paidAt && o.refundedPesewas < o.totalPesewas && o.escrow !== 'released',
      adminCancel: role === 'admin' && ['paid', 'accepted', 'packed', 'shipped'].includes(o.status),
    },
    openRequest: open ? { id: open.id, kind: open.kind, status: open.status } : null,
    declinedRequest: declined ? { id: declined.id, kind: declined.kind } : null,
  }
}
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>

/* ───────── Money back ───────── */
/**
 * Gives money back to the buyer through the payment provider and records it on the order.
 * When everything in a checkout has been refunded, the payment itself is marked refunded.
 */
export async function refundOrder(orderId: string, amountPesewas: number, actorId: string | null, note: string): Promise<{ ok: true } | { ok: false; error: 'amount' | 'not_paid' | 'refund_failed' }> {
  const [o] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, orderId))
  if (!o?.paidAt || !o.checkoutId) return { ok: false, error: 'not_paid' }
  const left = o.totalPesewas - o.refundedPesewas
  if (!Number.isInteger(amountPesewas) || amountPesewas < 1 || amountPesewas > left || o.escrow === 'released') return { ok: false, error: 'amount' }
  const [p] = await db.select().from(schema.payments).where(and(eq(schema.payments.marketCheckoutId, o.checkoutId), sql`${schema.payments.status} in ('success', 'refunded')`))
  if (!p) return { ok: false, error: 'not_paid' }
  const r = await refundPayment(p.reference, amountPesewas, `${o.number}: ${note}`)
  if (!r.ok) return { ok: false, error: 'refund_failed' }
  const { data: recorded, error: recordError } = await createSupabaseAdminClient().rpc('papa_market_record_refund', {
    p_order_id: orderId,
    p_amount: amountPesewas,
  })
  if (recordError) throw new Error(`Unable to record market refund: ${recordError.message}`)
  if (!recorded?.length) return { ok: false, error: 'amount' }
  await orderEvent(orderId, 'refunded', actorId, ghs(amountPesewas))
  const all = await db.execute<{ left: number }>(sql`select coalesce(sum(total_pesewas - refunded_pesewas), 0)::int as left from market_orders where checkout_id = ${o.checkoutId} and paid_at is not null`)
  if (all.rows[0].left === 0) await db.update(schema.payments).set({ status: 'refunded' }).where(eq(schema.payments.id, p.id))
  if (o.buyerId) {
    await notify(o.buyerId, 'market_order', null, null, { marketOrderId: orderId }).catch(() => {})
    const [b] = await db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, o.buyerId))
    if (b?.phone) await sendSms(b.phone, `PAPA Market: ${ghs(amountPesewas)} for order ${o.number} is being refunded to the account you paid with.`).catch(() => {})
  }
  return { ok: true }
}

/** Cancels a paid order: full refund, stock back, everyone told. */
async function cancelPaid(orderId: string, by: 'buyer' | 'seller' | 'admin' | 'system', actorId: string | null, reason: string) {
  const client = createSupabaseAdminClient()
  const [{ data: itemRows, error: itemError }, { data: deliveryRows, error: deliveryError }] = await Promise.all([
    client.from('market_order_items').select('product_id').eq('order_id', orderId),
    client.from('deliveries').select('rider_id').eq('order_id', orderId).in('status', ['open', 'accepted', 'picked_up']),
  ])
  if (itemError) throw new Error(`Unable to load cancellation items: ${itemError.message}`)
  if (deliveryError) throw new Error(`Unable to load cancellation deliveries: ${deliveryError.message}`)
  const { data, error } = await client.rpc('papa_market_cancel_order', {
    p_order_id: orderId, p_by: by, p_actor_id: actorId, p_reason: reason,
  })
  if (error) throw new Error(`Unable to cancel market order: ${error.message}`)
  const o = data?.[0]
  if (!o) return false
  for (const delivery of deliveryRows ?? []) {
    if (!delivery.rider_id) continue
    const { data: rider, error: riderError } = await client.from('riders').select('user_id').eq('id', delivery.rider_id).maybeSingle()
    if (riderError) throw new Error(`Unable to load delivery rider: ${riderError.message}`)
    if (rider?.user_id) await notify(rider.user_id, 'market_delivery', null, null, { marketOrderId: orderId }).catch(() => {})
  }
  const productIds = new Set((itemRows ?? []).map((item) => item.product_id).filter((id): id is string => typeof id === 'string'))
  for (const productId of productIds) {
    await fireStockAlerts(productId).catch(() => {})
  }
  const left = o.total_pesewas - o.refunded_pesewas
  if (left > 0) {
    const refund = await refundOrder(orderId, left, actorId, `cancelled (${reason})`)
    if (!refund.ok) await orderEvent(orderId, 'refund_pending', null, ghs(left))
  }
  if (by !== 'buyer' && o.buyer_id) await notify(o.buyer_id, 'market_order', null, null, { marketOrderId: orderId }).catch(() => {})
  if (by !== 'seller' && o.seller_id) await notify(o.seller_id, 'market_sale', by === 'buyer' ? o.buyer_id : null, null, { marketOrderId: orderId }).catch(() => {})
  return true
}

/* ───────── Buyer ───────── */
type Fail<E extends string> = { ok: false; error: E }

/** Before the seller accepts, the buyer cancels at once (full refund). After that, it becomes a request to the seller. */
export async function cancelOrder(user: Who, orderId: string, reason: string, details?: string): Promise<{ ok: true; requested: boolean } | Fail<'not_found' | 'state' | 'reason'>> {
  const o = await getOrder(user, orderId)
  if (!o || o.role !== 'buyer') return { ok: false, error: 'not_found' }
  if (!REQUEST_REASONS.includes(reason as RequestReason)) return { ok: false, error: 'reason' }
  if (o.can.cancel) { await cancelPaid(orderId, 'buyer', user.id, reason); return { ok: true, requested: false } }
  if (o.can.requestCancel) { await openRequest(o, 'cancel', reason, details); return { ok: true, requested: true } }
  return { ok: false, error: 'state' }
}

async function openRequest(o: OrderDetail, kind: 'cancel' | 'return' | 'refund', reason: string, details?: string) {
  const [r] = await db.insert(schema.marketRequests).values({ orderId: o.id, buyerId: o.buyerId, kind, reason, details: details?.trim().slice(0, 1000) || null }).returning()
  await orderEvent(o.id, `${kind}_requested`, o.buyerId, reason)
  if (o.sellerId) await notify(o.sellerId, 'market_sale', o.buyerId, null, { marketOrderId: o.id }).catch(() => {})
  return r
}

/** Return (after delivery, within the shop's return days) or refund (item never came, or came wrong). */
export async function requestReturn(user: Who, orderId: string, kind: 'return' | 'refund', reason: string, details?: string): Promise<{ ok: true; error?: never } | Fail<'not_found' | 'state' | 'reason' | 'rate_limited'>> {
  const o = await getOrder(user, orderId)
  if (!o || o.role !== 'buyer') return { ok: false, error: 'not_found' }
  if (!REQUEST_REASONS.includes(reason as RequestReason)) return { ok: false, error: 'reason' }
  if (!(await hit(`mkt-req:${user.id}`, 20, 3600))) return { ok: false, error: 'rate_limited' }
  const allowed = kind === 'return' ? o.can.return : (o.can.return || (o.can.notReceived && reason === 'not_received'))
  if (!allowed) return { ok: false, error: 'state' }
  await openRequest(o, kind, reason, details)
  return { ok: true }
}

export async function withdrawRequest(user: Who, requestId: string) {
  if (!isId(requestId)) return false
  const [r] = await db.update(schema.marketRequests).set({ status: 'withdrawn', resolvedAt: sql`now()` })
    .where(and(eq(schema.marketRequests.id, requestId), eq(schema.marketRequests.buyerId, user.id), eq(schema.marketRequests.status, 'open'))).returning()
  if (r) await orderEvent(r.orderId, 'request_withdrawn', user.id, r.kind)
  return !!r
}

/** The seller said no: the buyer asks a Tech Admin to decide (within 7 days, while the money is still held). */
export async function escalateRequest(user: Who, orderId: string, note: string): Promise<{ ok: true; error?: never } | Fail<'not_found' | 'state' | 'reason'>> {
  const o = await getOrder(user, orderId)
  if (!o || o.role !== 'buyer') return { ok: false, error: 'not_found' }
  if (!note?.trim() || note.length > 1000) return { ok: false, error: 'reason' }
  if (!o.can.escalate || !o.declinedRequest) return { ok: false, error: 'state' }
  const [r] = await db.update(schema.marketRequests).set({ status: 'escalated', escalatedAt: sql`now()`, escalationNote: note.trim() })
    .where(and(eq(schema.marketRequests.id, o.declinedRequest.id), eq(schema.marketRequests.status, 'declined'))).returning()
  if (!r) return { ok: false, error: 'state' }
  await orderEvent(orderId, 'dispute_opened', user.id, null)
  if (o.sellerId) await notify(o.sellerId, 'market_sale', user.id, null, { marketOrderId: orderId }).catch(() => {})
  return { ok: true }
}

/** "I received it": the buyer confirms delivery (the seller is paid after the return window, Batch 18). */
export async function confirmReceived(user: Who, orderId: string) {
  if (!isId(orderId)) return false
  const [o] = await db.update(schema.marketOrders).set({ status: 'delivered', deliveredAt: sql`now()` })
    .where(and(eq(schema.marketOrders.id, orderId), eq(schema.marketOrders.buyerId, user.id), eq(schema.marketOrders.status, 'shipped'))).returning()
  if (!o) return false
  await orderEvent(orderId, 'delivered', user.id, 'confirmed_by_buyer')
  // The rider carrying it is done too (and gets paid with the order)
  await db.update(schema.deliveries).set({ status: 'delivered', deliveredAt: sql`now()` }).where(and(eq(schema.deliveries.orderId, orderId), eq(schema.deliveries.status, 'picked_up')))
  if (o.sellerId) await notify(o.sellerId, 'market_sale', user.id, null, { marketOrderId: orderId }).catch(() => {})
  return true
}

/** One review per product per buyer, after delivery; writing again changes it. */
export async function writeReview(user: Who, orderId: string, productId: string, rating: number, body: string): Promise<{ ok: true; error?: never } | Fail<'not_found' | 'state' | 'rating' | 'body'>> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: 'rating' }
  if ((body?.length ?? 0) > 2000) return { ok: false, error: 'body' }
  const o = await getOrder(user, orderId)
  if (!o || o.role !== 'buyer') return { ok: false, error: 'not_found' }
  if (!o.can.review) return { ok: false, error: 'state' }
  if (!isId(productId) || !o.items.some((i) => i.productId === productId)) return { ok: false, error: 'not_found' }
  const [old] = await db.select().from(schema.productReviews).where(and(eq(schema.productReviews.productId, productId), eq(schema.productReviews.userId, user.id)))
  if (old) {
    await db.update(schema.productReviews).set({ rating, body: body.trim(), orderId, updatedAt: sql`now()` }).where(eq(schema.productReviews.id, old.id))
    if (!old.hiddenAt) await db.execute(sql`update products set rating_sum = rating_sum - ${old.rating} + ${rating} where id = ${productId}`)
  } else {
    await db.insert(schema.productReviews).values({ productId, userId: user.id, orderId, rating, body: body.trim() })
    await db.execute(sql`update products set rating_sum = rating_sum + ${rating}, rating_count = rating_count + 1 where id = ${productId}`)
    if (o.sellerId) await notify(o.sellerId, 'market_review', user.id, null, { productId }).catch(() => {})
  }
  return { ok: true }
}

/** The shop owner replies to a review (once; replying again changes it). */
export async function replyToReview(user: Who, reviewId: string, reply: string) {
  if (!isId(reviewId) || !reply?.trim() || reply.length > 1000) return false
  const r = await db.execute(sql`update product_reviews r set seller_reply = ${reply.trim()}, seller_reply_at = now() from products p join shops s on s.id = p.shop_id
    where r.id = ${reviewId} and p.id = r.product_id and s.owner_id = ${user.id} returning r.id`)
  return r.rows.length > 0
}

/** A Tech Admin hides a review (it stops counting in the rating). */
export async function hideReview(reviewId: string) {
  if (!isId(reviewId)) return false
  const [r] = await db.update(schema.productReviews).set({ hiddenAt: sql`now()` }).where(and(eq(schema.productReviews.id, reviewId), sql`${schema.productReviews.hiddenAt} is null`)).returning()
  if (r) await db.execute(sql`update products set rating_sum = greatest(rating_sum - ${r.rating}, 0), rating_count = greatest(rating_count - 1, 0) where id = ${r.productId}`)
  return !!r
}

/* ───────── Seller ───────── */
/** accept → pack → ship (pickup: ready for pickup). The buyer is told at each step. */
export async function sellerStep(user: Who, orderId: string, step: 'accept' | 'pack' | 'ship', note?: string): Promise<{ ok: true; error?: never } | Fail<'not_found' | 'state'>> {
  const o = await getOrder(user, orderId)
  if (!o || o.role !== 'seller') return { ok: false, error: 'not_found' }
  if (!o.can[step]) return { ok: false, error: 'state' }
  const set = step === 'accept' ? { status: 'accepted' as const, acceptedAt: sql`now()` } : step === 'pack' ? { status: 'packed' as const, packedAt: sql`now()` } : { status: 'shipped' as const, shippedAt: sql`now()` }
  const from = step === 'accept' ? ['paid'] : step === 'pack' ? ['accepted'] : ['accepted', 'packed']
  const r = await db.update(schema.marketOrders).set(set).where(and(eq(schema.marketOrders.id, orderId), sql`${schema.marketOrders.status} in ${from}`)).returning()
  if (!r.length) return { ok: false, error: 'state' }
  const kind = step === 'accept' ? 'accepted' : step === 'pack' ? 'packed' : o.fulfilment === 'pickup' ? 'ready_for_pickup' : 'shipped'
  await orderEvent(orderId, kind, user.id, note?.trim().slice(0, 300) || null)
  if (o.buyerId) await notify(o.buyerId, 'market_order', null, null, { marketOrderId: orderId }).catch(() => {})
  if (step === 'ship') await textHandoverCode(orderId)
  return { ok: true }
}

/** Texts the buyer their hand-over code when the order leaves the shop (or is ready to collect). */
export async function textHandoverCode(orderId: string) {
  const [o] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, orderId))
  if (!o?.buyerId) return
  const [b] = await db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, o.buyerId))
  if (b?.phone) await sendSms(b.phone, o.fulfilment === 'pickup'
    ? `PAPA Market: Order ${o.number} is ready for pickup at ${o.pickupAddress ?? o.shopName}. Show code ${o.handoverCode} when you collect.`
    : `PAPA Market: Order ${o.number} is on its way. Give code ${o.handoverCode} to the person who delivers it, only when you have your items.`).catch(() => {})
}

/** Checks the buyer's code and marks the order delivered (seller or rider at hand-over). */
export async function deliverWithCode(orderId: string, actorId: string, code: string, note: string): Promise<{ ok: true } | Fail<'state' | 'code'>> {
  const [o] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, orderId))
  if (!o || o.status !== 'shipped') return { ok: false, error: 'state' }
  if (!(await hit(`mkt-code:${orderId}`, 10, 3600))) return { ok: false, error: 'code' }
  if (!code || code.trim() !== o.handoverCode) return { ok: false, error: 'code' }
  const r = await db.update(schema.marketOrders).set({ status: 'delivered', deliveredAt: sql`now()` }).where(and(eq(schema.marketOrders.id, orderId), eq(schema.marketOrders.status, 'shipped'))).returning()
  if (!r.length) return { ok: false, error: 'state' }
  await orderEvent(orderId, 'delivered', actorId, note)
  if (o.buyerId) await notify(o.buyerId, 'market_order', null, null, { marketOrderId: orderId }).catch(() => {})
  return { ok: true }
}

/** At hand-over the seller enters the buyer's code: the order is delivered. */
export async function sellerHandover(user: Who, orderId: string, code: string): Promise<{ ok: true; error?: never } | Fail<'not_found' | 'state' | 'code'>> {
  if (!isId(orderId)) return { ok: false, error: 'not_found' }
  const [o] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, orderId))
  if (!o || o.sellerId !== user.id) return { ok: false, error: 'not_found' }
  // A PAPA rider carrying the order hands it over themself
  const busy = await db.$count(schema.deliveries, and(eq(schema.deliveries.orderId, orderId), sql`${schema.deliveries.status} in ('open', 'accepted', 'picked_up')`))
  if (o.status !== 'shipped' || busy) return { ok: false, error: 'state' }
  return deliverWithCode(orderId, user.id, code, 'code_checked')
}

/** The seller can't fill the order: it is cancelled and the buyer refunded in full. */
export async function sellerCancel(user: Who, orderId: string, reason: string): Promise<{ ok: true; error?: never } | Fail<'not_found' | 'state' | 'reason'>> {
  const o = await getOrder(user, orderId)
  if (!o || o.role !== 'seller') return { ok: false, error: 'not_found' }
  if (!reason?.trim() || reason.length > 300) return { ok: false, error: 'reason' }
  if (!o.can.sellerCancel) return { ok: false, error: 'state' }
  return (await cancelPaid(orderId, 'seller', user.id, reason.trim())) ? { ok: true } : { ok: false, error: 'state' }
}

/**
 * The seller (or a Tech Admin) answers a cancel / return / refund request.
 * Approving a cancel cancels and refunds everything; approving a return or refund gives back the amount set (by default the items' price).
 */
export async function answerRequest(user: Who, requestId: string, approve: boolean, response: string, refundPesewas?: number | null): Promise<{ ok: true } | Fail<'not_found' | 'state' | 'amount' | 'refund_failed' | 'not_paid'>> {
  if (!isId(requestId)) return { ok: false, error: 'not_found' }
  const [r] = await db.select().from(schema.marketRequests).where(eq(schema.marketRequests.id, requestId))
  if (!r) return { ok: false, error: 'not_found' }
  const o = await getOrder(user, r.orderId)
  if (!o || (o.role !== 'seller' && o.role !== 'admin')) return { ok: false, error: 'not_found' }
  if (r.status !== 'open' && !(r.status === 'escalated' && o.role === 'admin')) return { ok: false, error: 'state' }
  const left = o.totalPesewas - o.refundedPesewas
  let amount = 0
  if (approve && r.kind !== 'cancel') {
    amount = refundPesewas ?? Math.min(left, r.kind === 'refund' ? left : o.subtotalPesewas - o.discountPesewas - o.refundedPesewas)
    if (!Number.isInteger(amount) || amount < 1 || amount > left) return { ok: false, error: 'amount' }
  }
  const [claimed] = await db.update(schema.marketRequests).set({ status: approve ? 'approved' : 'declined', response: response?.trim().slice(0, 1000) || null, handledBy: user.id,
    resolvedAt: sql`now()`, refundPesewas: approve ? (r.kind === 'cancel' ? left : amount) : null }).where(and(eq(schema.marketRequests.id, requestId), eq(schema.marketRequests.status, r.status))).returning()
  if (!claimed) return { ok: false, error: 'state' }
  await orderEvent(o.id, r.status === 'escalated' ? `dispute_${approve ? 'buyer' : 'seller'}` : `${r.kind}_${approve ? 'approved' : 'declined'}`, user.id, response?.trim().slice(0, 300) || null)
  if (r.status === 'escalated' && o.sellerId) await notify(o.sellerId, 'market_sale', null, null, { marketOrderId: o.id }).catch(() => {})
  // A cancel that can no longer cancel (already delivered) becomes a full refund
  if (approve && r.kind === 'cancel' && (await cancelPaid(o.id, o.role === 'admin' ? 'admin' : 'seller', user.id, r.reason))) { /* done */ }
  else if (approve) {
    if (r.kind === 'cancel') amount = left
    const done = await refundOrder(o.id, amount, user.id, `${r.kind} approved`)
    if (!done.ok) {
      await db.update(schema.marketRequests).set({ status: r.status, handledBy: null, resolvedAt: null, refundPesewas: null }).where(eq(schema.marketRequests.id, requestId))
      return done
    }
  } else if (o.buyerId) await notify(o.buyerId, 'market_order', null, null, { marketOrderId: o.id }).catch(() => {})
  return { ok: true }
}

/* ───────── Tech Admins ───────── */
export async function adminCancel(admin: Who, orderId: string, reason: string) {
  if (admin.role !== 'tech_admin' || !isId(orderId)) return false
  return cancelPaid(orderId, 'admin', admin.id, reason.trim().slice(0, 300) || 'admin')
}

export async function adminRefund(admin: Who, orderId: string, amountPesewas: number, note: string) {
  if (admin.role !== 'tech_admin' || !isId(orderId)) return { ok: false as const, error: 'not_found' as const }
  return refundOrder(orderId, amountPesewas, admin.id, note.trim().slice(0, 200) || 'admin refund')
}

/* ───────── Background job ───────── */
/** Paid orders the seller never accepted are cancelled and refunded, so buyers' money is never stuck. */
export async function cancelUnacceptedOrders() {
  const due = await db.select({ id: schema.marketOrders.id }).from(schema.marketOrders)
    .where(and(eq(schema.marketOrders.status, 'paid'), sql`${schema.marketOrders.paidAt} < now() - make_interval(hours => ${ACCEPT_WITHIN_HOURS})`)).limit(50)
  let n = 0
  for (const o of due) if (await cancelPaid(o.id, 'system', null, 'not_accepted_in_time')) n++
  return n
}
