import 'server-only'
import { schema } from '@/db'
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
type RawRow = { id: string; number: string; shop_name: string; shop_slug: string | null; status: OrderStatus; fulfilment: 'delivery' | 'pickup'; total_pesewas: number; created_at: Date; item_count: number; first_title: string | null; images: string[]; buyer_name: string | null; open_request: string | null }
const toRow = (r: RawRow): OrderRow => ({ id: r.id, number: r.number, shopName: r.shop_name, shopSlug: r.shop_slug, status: r.status, fulfilment: r.fulfilment, totalPesewas: r.total_pesewas,
  createdAt: iso(r.created_at)!, itemCount: r.item_count, firstTitle: r.first_title ?? '', images: r.images ?? [], buyerName: r.buyer_name, openRequest: r.open_request })

export const ORDER_TABS = ['all', 'active', 'delivered', 'cancelled'] as const
export type OrderTab = (typeof ORDER_TABS)[number]

/** My orders as a buyer. Unpaid (or failed) checkouts show for 2 hours only. */
export async function myOrders(userId: string, tab: OrderTab = 'all') {
  const { data, error } = await createSupabaseAdminClient().rpc('papa_market_order_list', {
    p_user_id: userId,
    p_seller: false,
    p_filter: tab,
  })
  if (error) throw new Error(`Unable to load market orders: ${error.message}`)
  return ((data ?? []) as RawRow[]).map(toRow)
}

/** Orders to a shop (the seller's list; the full seller dashboard comes in Batch 17). */
export async function shopOrders(user: Who, status?: string) {
  const st = (['paid', 'accepted', 'packed', 'shipped', 'delivered', 'completed', 'cancelled'] as const).find((s) => s === status) ?? null
  const { data, error } = await createSupabaseAdminClient().rpc('papa_market_order_list', {
    p_user_id: user.id,
    p_seller: true,
    p_filter: st,
  })
  if (error) throw new Error(`Unable to load shop orders: ${error.message}`)
  return ((data ?? []) as RawRow[]).map(toRow)
}

/* ───────── One order ───────── */
export async function getOrder(user: Who, id: string) {
  if (!isId(id)) return null
  const { data, error } = await createSupabaseAdminClient().rpc('papa_market_order_detail', {
    p_order_id: id, p_viewer_id: user.id, p_viewer_role: user.role,
  })
  if (error) throw new Error(`Unable to load market order: ${error.message}`)
  if (!data) return null
  type DetailPayload = {
    order: Record<string, unknown>
    items: { id: string; product_id: string | null; title: string; variant_name: string; image: string | null; unit_pesewas: number; qty: number; total_pesewas: number; my_rating: number | null }[]
    events: { id: string; kind: string; note: string | null; created_at: string; actor: string | null }[]
    requests: { id: string; kind: 'cancel' | 'return' | 'refund'; reason: string; details: string | null; status: 'open' | 'approved' | 'declined' | 'withdrawn' | 'escalated'; response: string | null; refund_pesewas: number | null; created_at: string; resolved_at: string | null; escalated_at: string | null; escalation_note: string | null }[]
    shop: { slug: string; logo_url: string | null; phone: string | null; return_days: number } | null
    people: { id: string; full_name: string; username: string; avatar_url: string | null }[]
    payment: { reference: string; status: string; channel: string } | null
    delivery: { id: string; status: 'open' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled'; fee_pesewas: number; created_at: string; accepted_at: string | null; picked_up_at: string | null; delivered_at: string | null; rider_name: string | null; rider_username: string | null; rider_phone: string | null; rider_vehicle: string | null; rider_user_id: string | null } | null
    role: 'buyer' | 'seller' | 'admin' | null
  }
  const payload = data as DetailPayload
  const camelize = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), item]))
  const o = camelize(payload.order) as unknown as typeof schema.marketOrders.$inferSelect
  for (const key of ['createdAt', 'paidAt', 'acceptedAt', 'packedAt', 'shippedAt', 'deliveredAt', 'completedAt', 'cancelledAt'] as const) {
    const value = o[key]
    if (typeof value === 'string') (o as unknown as Record<string, unknown>)[key] = new Date(value)
  }
  const role = payload.role
  if (!role) return null
  const requests = payload.requests.map((r) => ({
    id: r.id, kind: r.kind, reason: r.reason, details: r.details, status: r.status, response: r.response, refundPesewas: r.refund_pesewas,
    createdAt: new Date(r.created_at), resolvedAt: r.resolved_at ? new Date(r.resolved_at) : null,
    escalatedAt: r.escalated_at ? new Date(r.escalated_at) : null, escalationNote: r.escalation_note,
  }))
  const shop = payload.shop
  const person = (pid: string | null) => { const p = payload.people.find((x) => x.id === pid); return p ? { id: p.id, fullName: p.full_name, username: p.username, avatarUrl: p.avatar_url } : null }
  const pay = payload.payment
  const open = requests.find((r) => r.status === 'open' || r.status === 'escalated') ?? null
  const declined = requests.find((r) => r.status === 'declined' && r.resolvedAt && Date.now() - r.resolvedAt.getTime() < ESCALATE_DAYS * 86_400_000) ?? null
  const d = payload.delivery
  const delivery = d ? { id: d.id, status: d.status, feePesewas: d.fee_pesewas, createdAt: iso(d.created_at)!, acceptedAt: iso(d.accepted_at), pickedUpAt: iso(d.picked_up_at), deliveredAt: iso(d.delivered_at),
    rider: d.rider_name ? { name: d.rider_name, username: d.rider_username!, phone: d.rider_phone, vehicle: d.rider_vehicle, userId: d.rider_user_id! } : null } : null
  const riderBusy = !!delivery && delivery.status !== 'delivered'
  const returnDays = shop?.return_days ?? 0
  const withinReturn = !!o.deliveredAt && returnDays > 0 && Date.now() - o.deliveredAt.getTime() < returnDays * 86_400_000
  const buyer = role === 'buyer'
  return {
    ...o, createdAt: iso(o.createdAt)!, paidAt: iso(o.paidAt), acceptedAt: iso(o.acceptedAt), packedAt: iso(o.packedAt), shippedAt: iso(o.shippedAt), deliveredAt: iso(o.deliveredAt),
    completedAt: iso(o.completedAt), cancelledAt: iso(o.cancelledAt),
    role, shopSlug: shop?.slug ?? null, shopLogo: shop?.logo_url ?? null, shopPhone: shop?.phone ?? null, returnDays, buyer: person(o.buyerId), seller: person(o.sellerId),
    handoverCode: buyer ? o.handoverCode : null,
    items: payload.items.map((i) => ({ id: i.id, productId: i.product_id, title: i.title, variantName: i.variant_name, image: i.image, unitPesewas: i.unit_pesewas, qty: i.qty, totalPesewas: i.total_pesewas, myRating: i.my_rating })),
    events: payload.events.map((e) => ({ id: e.id, kind: e.kind, note: e.note, at: iso(e.created_at)!, actor: e.actor })),
    requests: requests.map((r) => ({ ...r, createdAt: iso(r.createdAt)!, resolvedAt: iso(r.resolvedAt), escalatedAt: iso(r.escalatedAt) })),
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
  const client = createSupabaseAdminClient()
  const { data: o, error: orderError } = await client.from('market_orders').select('*').eq('id', orderId).maybeSingle()
  if (orderError) throw new Error(`Unable to load order for refund: ${orderError.message}`)
  if (!o?.paid_at || !o.checkout_id) return { ok: false, error: 'not_paid' }
  const left = o.total_pesewas - o.refunded_pesewas
  if (!Number.isInteger(amountPesewas) || amountPesewas < 1 || amountPesewas > left || o.escrow === 'released') return { ok: false, error: 'amount' }
  const { data: p, error: paymentError } = await client.from('payments').select('id,reference').eq('market_checkout_id', o.checkout_id).in('status', ['success', 'refunded']).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (paymentError) throw new Error(`Unable to load order payment: ${paymentError.message}`)
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
  const { data: checkoutOrders, error: checkoutError } = await client.from('market_orders').select('total_pesewas,refunded_pesewas').eq('checkout_id', o.checkout_id).not('paid_at', 'is', null)
  if (checkoutError) throw new Error(`Unable to check checkout refund status: ${checkoutError.message}`)
  if ((checkoutOrders ?? []).reduce((sum, item) => sum + item.total_pesewas - item.refunded_pesewas, 0) === 0) {
    const { error } = await client.from('payments').update({ status: 'refunded' }).eq('id', p.id)
    if (error) throw new Error(`Unable to update refunded payment: ${error.message}`)
  }
  if (o.buyer_id) {
    await notify(o.buyer_id, 'market_order', null, null, { marketOrderId: orderId }).catch(() => {})
    const { data: b, error: buyerError } = await client.from('users').select('phone').eq('id', o.buyer_id).maybeSingle()
    if (buyerError) throw new Error(`Unable to load buyer phone: ${buyerError.message}`)
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
  const { data: r, error } = await createSupabaseAdminClient().from('market_requests').insert({
    order_id: o.id, buyer_id: o.buyerId, kind, reason, details: details?.trim().slice(0, 1000) || null,
  }).select('id').single()
  if (error) throw new Error(`Unable to open market request: ${error.message}`)
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
  const { data: r, error } = await createSupabaseAdminClient().from('market_requests').update({ status: 'withdrawn', resolved_at: new Date().toISOString() })
    .eq('id', requestId).eq('buyer_id', user.id).eq('status', 'open').select('order_id,kind').maybeSingle()
  if (error) throw new Error(`Unable to withdraw market request: ${error.message}`)
  if (r) await orderEvent(r.order_id, 'request_withdrawn', user.id, r.kind)
  return !!r
}

/** The seller said no: the buyer asks a Tech Admin to decide (within 7 days, while the money is still held). */
export async function escalateRequest(user: Who, orderId: string, note: string): Promise<{ ok: true; error?: never } | Fail<'not_found' | 'state' | 'reason'>> {
  const o = await getOrder(user, orderId)
  if (!o || o.role !== 'buyer') return { ok: false, error: 'not_found' }
  if (!note?.trim() || note.length > 1000) return { ok: false, error: 'reason' }
  if (!o.can.escalate || !o.declinedRequest) return { ok: false, error: 'state' }
  const { data: r, error } = await createSupabaseAdminClient().from('market_requests').update({ status: 'escalated', escalated_at: new Date().toISOString(), escalation_note: note.trim() })
    .eq('id', o.declinedRequest.id).eq('status', 'declined').select('id').maybeSingle()
  if (error) throw new Error(`Unable to escalate market request: ${error.message}`)
  if (!r) return { ok: false, error: 'state' }
  await orderEvent(orderId, 'dispute_opened', user.id, null)
  if (o.sellerId) await notify(o.sellerId, 'market_sale', user.id, null, { marketOrderId: orderId }).catch(() => {})
  return { ok: true }
}

/** "I received it": the buyer confirms delivery (the seller is paid after the return window, Batch 18). */
export async function confirmReceived(user: Who, orderId: string) {
  if (!isId(orderId)) return false
  const client = createSupabaseAdminClient()
  const { data: o, error } = await client.from('market_orders').update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', orderId).eq('buyer_id', user.id).eq('status', 'shipped').select('seller_id').maybeSingle()
  if (error) throw new Error(`Unable to confirm market delivery: ${error.message}`)
  if (!o) return false
  await orderEvent(orderId, 'delivered', user.id, 'confirmed_by_buyer')
  const { error: deliveryError } = await client.from('deliveries').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('order_id', orderId).eq('status', 'picked_up')
  if (deliveryError) throw new Error(`Unable to complete market delivery: ${deliveryError.message}`)
  if (o.seller_id) await notify(o.seller_id, 'market_sale', user.id, null, { marketOrderId: orderId }).catch(() => {})
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
  const client = createSupabaseAdminClient()
  const { data: old, error: oldError } = await client.from('product_reviews').select('id,rating,hidden_at').eq('product_id', productId).eq('user_id', user.id).maybeSingle()
  if (oldError) throw new Error(`Unable to load existing product review: ${oldError.message}`)
  if (old) {
    const { error } = await client.from('product_reviews').update({ rating, body: body.trim(), order_id: orderId, updated_at: new Date().toISOString() }).eq('id', old.id)
    if (error) throw new Error(`Unable to update product review: ${error.message}`)
    if (!old.hidden_at) {
      const { error: totalsError } = await client.rpc('papa_market_adjust_product_rating', { p_product_id: productId, p_rating_delta: rating - old.rating, p_count_delta: 0 })
      if (totalsError) throw new Error(`Unable to update product rating: ${totalsError.message}`)
    }
  } else {
    const { error } = await client.from('product_reviews').insert({ product_id: productId, user_id: user.id, order_id: orderId, rating, body: body.trim() })
    if (error) throw new Error(`Unable to save product review: ${error.message}`)
    const { error: totalsError } = await client.rpc('papa_market_adjust_product_rating', { p_product_id: productId, p_rating_delta: rating, p_count_delta: 1 })
    if (totalsError) throw new Error(`Unable to update product rating: ${totalsError.message}`)
    if (o.sellerId) await notify(o.sellerId, 'market_review', user.id, null, { productId }).catch(() => {})
  }
  return { ok: true }
}

/** The shop owner replies to a review (once; replying again changes it). */
export async function replyToReview(user: Who, reviewId: string, reply: string) {
  if (!isId(reviewId) || !reply?.trim() || reply.length > 1000) return false
  const { data, error } = await createSupabaseAdminClient().rpc('papa_market_reply_review', {
    p_review_id: reviewId, p_user_id: user.id, p_reply: reply.trim(),
  })
  if (error) throw new Error(`Unable to reply to product review: ${error.message}`)
  return !!data
}

/** A Tech Admin hides a review (it stops counting in the rating). */
export async function hideReview(reviewId: string) {
  if (!isId(reviewId)) return false
  const { data, error } = await createSupabaseAdminClient().rpc('papa_market_hide_review', { p_review_id: reviewId })
  if (error) throw new Error(`Unable to hide product review: ${error.message}`)
  return !!data
}

/* ───────── Seller ───────── */
/** accept → pack → ship (pickup: ready for pickup). The buyer is told at each step. */
export async function sellerStep(user: Who, orderId: string, step: 'accept' | 'pack' | 'ship', note?: string): Promise<{ ok: true; error?: never } | Fail<'not_found' | 'state'>> {
  const o = await getOrder(user, orderId)
  if (!o || o.role !== 'seller') return { ok: false, error: 'not_found' }
  if (!o.can[step]) return { ok: false, error: 'state' }
  const timestamp = new Date().toISOString()
  const set = step === 'accept' ? { status: 'accepted', accepted_at: timestamp } : step === 'pack' ? { status: 'packed', packed_at: timestamp } : { status: 'shipped', shipped_at: timestamp }
  const from = step === 'accept' ? ['paid'] : step === 'pack' ? ['accepted'] : ['accepted', 'packed']
  const { data: changed, error } = await createSupabaseAdminClient().from('market_orders').update(set).eq('id', orderId).in('status', from).select('id').maybeSingle()
  if (error) throw new Error(`Unable to update order status: ${error.message}`)
  if (!changed) return { ok: false, error: 'state' }
  const kind = step === 'accept' ? 'accepted' : step === 'pack' ? 'packed' : o.fulfilment === 'pickup' ? 'ready_for_pickup' : 'shipped'
  await orderEvent(orderId, kind, user.id, note?.trim().slice(0, 300) || null)
  if (o.buyerId) await notify(o.buyerId, 'market_order', null, null, { marketOrderId: orderId }).catch(() => {})
  if (step === 'ship') await textHandoverCode(orderId)
  return { ok: true }
}

/** Texts the buyer their hand-over code when the order leaves the shop (or is ready to collect). */
export async function textHandoverCode(orderId: string) {
  const client = createSupabaseAdminClient()
  const { data: o, error } = await client.from('market_orders').select('buyer_id,number,fulfilment,pickup_address,shop_name,handover_code').eq('id', orderId).maybeSingle()
  if (error) throw new Error(`Unable to load handover order: ${error.message}`)
  if (!o?.buyer_id) return
  const { data: b, error: buyerError } = await client.from('users').select('phone').eq('id', o.buyer_id).maybeSingle()
  if (buyerError) throw new Error(`Unable to load buyer contact: ${buyerError.message}`)
  if (b?.phone) await sendSms(b.phone, o.fulfilment === 'pickup'
    ? `PAPA Market: Order ${o.number} is ready for pickup at ${o.pickup_address ?? o.shop_name}. Show code ${o.handover_code} when you collect.`
    : `PAPA Market: Order ${o.number} is on its way. Give code ${o.handover_code} to the person who delivers it, only when you have your items.`).catch(() => {})
}

/** Checks the buyer's code and marks the order delivered (seller or rider at hand-over). */
export async function deliverWithCode(orderId: string, actorId: string, code: string, note: string): Promise<{ ok: true } | Fail<'state' | 'code'>> {
  const client = createSupabaseAdminClient()
  const { data: o, error } = await client.from('market_orders').select('status,handover_code,buyer_id').eq('id', orderId).maybeSingle()
  if (error) throw new Error(`Unable to load handover order: ${error.message}`)
  if (!o || o.status !== 'shipped') return { ok: false, error: 'state' }
  if (!(await hit(`mkt-code:${orderId}`, 10, 3600))) return { ok: false, error: 'code' }
  if (!code || code.trim() !== o.handover_code) return { ok: false, error: 'code' }
  const { data: changed, error: updateError } = await client.from('market_orders').update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', orderId).eq('status', 'shipped').select('id').maybeSingle()
  if (updateError) throw new Error(`Unable to complete market handover: ${updateError.message}`)
  if (!changed) return { ok: false, error: 'state' }
  await orderEvent(orderId, 'delivered', actorId, note)
  if (o.buyer_id) await notify(o.buyer_id, 'market_order', null, null, { marketOrderId: orderId }).catch(() => {})
  return { ok: true }
}

/** At hand-over the seller enters the buyer's code: the order is delivered. */
export async function sellerHandover(user: Who, orderId: string, code: string): Promise<{ ok: true; error?: never } | Fail<'not_found' | 'state' | 'code'>> {
  if (!isId(orderId)) return { ok: false, error: 'not_found' }
  const client = createSupabaseAdminClient()
  const { data: o, error } = await client.from('market_orders').select('seller_id,status').eq('id', orderId).maybeSingle()
  if (error) throw new Error(`Unable to load seller handover order: ${error.message}`)
  if (!o || o.seller_id !== user.id) return { ok: false, error: 'not_found' }
  const { data: activeDeliveries, error: deliveryError } = await client.from('deliveries').select('id').eq('order_id', orderId).in('status', ['open', 'accepted', 'picked_up']).limit(1)
  if (deliveryError) throw new Error(`Unable to check active deliveries: ${deliveryError.message}`)
  if (o.status !== 'shipped' || !!activeDeliveries?.length) return { ok: false, error: 'state' }
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
  const { data: rawRequest, error: requestError } = await createSupabaseAdminClient().from('market_requests').select('id,order_id,kind,reason,status').eq('id', requestId).maybeSingle()
  if (requestError) throw new Error(`Unable to load market request: ${requestError.message}`)
  if (!rawRequest) return { ok: false, error: 'not_found' }
  const r = { id: rawRequest.id, orderId: rawRequest.order_id, kind: rawRequest.kind as 'cancel' | 'return' | 'refund', reason: rawRequest.reason, status: rawRequest.status as 'open' | 'escalated' }
  const o = await getOrder(user, r.orderId)
  if (!o || (o.role !== 'seller' && o.role !== 'admin')) return { ok: false, error: 'not_found' }
  if (r.status !== 'open' && !(r.status === 'escalated' && o.role === 'admin')) return { ok: false, error: 'state' }
  const left = o.totalPesewas - o.refundedPesewas
  let amount = 0
  if (approve && r.kind !== 'cancel') {
    amount = refundPesewas ?? Math.min(left, r.kind === 'refund' ? left : o.subtotalPesewas - o.discountPesewas - o.refundedPesewas)
    if (!Number.isInteger(amount) || amount < 1 || amount > left) return { ok: false, error: 'amount' }
  }
  const { data: claimed, error: claimError } = await createSupabaseAdminClient().from('market_requests').update({
    status: approve ? 'approved' : 'declined', response: response?.trim().slice(0, 1000) || null, handled_by: user.id,
    resolved_at: new Date().toISOString(), refund_pesewas: approve ? (r.kind === 'cancel' ? left : amount) : null,
  }).eq('id', requestId).eq('status', r.status).select('id').maybeSingle()
  if (claimError) throw new Error(`Unable to answer market request: ${claimError.message}`)
  if (!claimed) return { ok: false, error: 'state' }
  await orderEvent(o.id, r.status === 'escalated' ? `dispute_${approve ? 'buyer' : 'seller'}` : `${r.kind}_${approve ? 'approved' : 'declined'}`, user.id, response?.trim().slice(0, 300) || null)
  if (r.status === 'escalated' && o.sellerId) await notify(o.sellerId, 'market_sale', null, null, { marketOrderId: o.id }).catch(() => {})
  // A cancel that can no longer cancel (already delivered) becomes a full refund
  if (approve && r.kind === 'cancel' && (await cancelPaid(o.id, o.role === 'admin' ? 'admin' : 'seller', user.id, r.reason))) { /* done */ }
  else if (approve) {
    if (r.kind === 'cancel') amount = left
    const done = await refundOrder(o.id, amount, user.id, `${r.kind} approved`)
    if (!done.ok) {
      const { error: rollbackError } = await createSupabaseAdminClient().from('market_requests').update({ status: r.status, handled_by: null, resolved_at: null, refund_pesewas: null }).eq('id', requestId)
      if (rollbackError) throw new Error(`Unable to restore market request: ${rollbackError.message}`)
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
  const cutoff = new Date(Date.now() - ACCEPT_WITHIN_HOURS * 3_600_000).toISOString()
  const { data: due, error } = await createSupabaseAdminClient().from('market_orders').select('id').eq('status', 'paid').lt('paid_at', cutoff).limit(50)
  if (error) throw new Error(`Unable to find unaccepted market orders: ${error.message}`)
  let n = 0
  for (const o of due ?? []) if (await cancelPaid(o.id, 'system', null, 'not_accepted_in_time')) n++
  return n
}
