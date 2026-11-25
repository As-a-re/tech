import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { hit } from '@/server/identity/rate-limit'
import { notify } from '@/server/notifications/notify'
import { isGhanaMobile, normalisePhone } from '@/lib/identity/normalise'
import { iso, isId, orderEvent, type Who } from './shared'
import { deliverWithCode, getOrder, textHandoverCode } from './orders'

export const VEHICLES = ['motorbike', 'car', 'bicycle', 'foot'] as const
export const PAYOUT_NETWORKS = ['mtn', 'telecel', 'airteltigo'] as const
/** A rider can carry this many orders at once. */
export const MAX_ACTIVE = 3
export const MIN_RIDER_FEE = 500
const supabase = () => createSupabaseAdminClient()
const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }

type RiderRow = {
  id: string; user_id: string; phone: string; vehicle: RiderInput['vehicle']; plate: string | null; areas: string[]; about: string | null
  payout_provider: string | null; payout_number: string | null; payout_name: string | null; status: string; available: boolean; note: string | null
  reviewed_by: string | null; reviewed_at: string | null; created_at: string
}
export type Rider = {
  id: string; userId: string; phone: string; vehicle: RiderInput['vehicle']; plate: string | null; areas: string[]; about: string | null
  payoutProvider: string | null; payoutNumber: string | null; payoutName: string | null; status: string; available: boolean; note: string | null
  reviewedBy: string | null; reviewedAt: Date | null; createdAt: Date
}
const toRider = (row: RiderRow): Rider => ({
  id: row.id, userId: row.user_id, phone: row.phone, vehicle: row.vehicle, plate: row.plate, areas: row.areas, about: row.about,
  payoutProvider: row.payout_provider, payoutNumber: row.payout_number, payoutName: row.payout_name, status: row.status,
  available: row.available, note: row.note, reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null, createdAt: new Date(row.created_at),
})

/* ───────── Becoming a rider ───────── */
export type RiderInput = { phone: string; vehicle: string; plate?: string | null; areas: string[]; about?: string | null; payoutProvider: string; payoutNumber: string; payoutName: string; acceptTerms?: boolean }
export type RiderError = 'phone' | 'vehicle' | 'areas' | 'about' | 'payout' | 'terms' | 'exists' | 'not_rider' | 'rate_limited'

export async function myRider(userId: string) {
  const { data, error } = await supabase().from('riders').select('id,user_id,phone,vehicle,plate,areas,about,payout_provider,payout_number,payout_name,status,available,note,reviewed_by,reviewed_at,created_at').eq('user_id', userId).maybeSingle()
  fail(error)
  return data ? toRider(data as RiderRow) : null
}

function checkRider(i: RiderInput): { ok: false; error: RiderError } | { ok: true; values: Omit<RiderRow, 'id' | 'user_id' | 'status' | 'available' | 'note' | 'reviewed_by' | 'reviewed_at' | 'created_at'> } {
  const phone = normalisePhone(i.phone ?? '')
  if (!isGhanaMobile(phone)) return { ok: false, error: 'phone' }
  if (!VEHICLES.includes(i.vehicle as never)) return { ok: false, error: 'vehicle' }
  const areas = [...new Set((i.areas ?? []).map((a) => a.trim()).filter(Boolean).map((a) => a.slice(0, 40)))].slice(0, 20)
  if (!areas.length) return { ok: false, error: 'areas' }
  if ((i.about?.length ?? 0) > 500 || (i.plate?.length ?? 0) > 20) return { ok: false, error: 'about' }
  const num = normalisePhone(i.payoutNumber ?? '')
  if (!PAYOUT_NETWORKS.includes(i.payoutProvider as never) || !isGhanaMobile(num) || (i.payoutName?.trim().length ?? 0) < 3 || i.payoutName.length > 80) return { ok: false, error: 'payout' }
  return { ok: true, values: { phone, vehicle: i.vehicle as (typeof VEHICLES)[number], plate: i.plate?.trim().toUpperCase() || null, areas, about: i.about?.trim() || null,
    payout_provider: i.payoutProvider, payout_number: num, payout_name: i.payoutName.trim() } }
}

/** "Become a rider": the application waits for a Tech Admin. */
export async function applyRider(user: Who, i: RiderInput): Promise<{ ok: true; error?: never } | { ok: false; error: RiderError }> {
  if (!i.acceptTerms) return { ok: false, error: 'terms' }
  const old = await myRider(user.id)
  if (old && old.status !== 'rejected') return { ok: false, error: 'exists' }
  const c = checkRider(i)
  if (!c.ok) return c
  if (!(await hit(`mkt-rider:${user.id}`, 5, 86_400))) return { ok: false, error: 'rate_limited' }
  const payload = { ...c.values, status: 'pending', note: null, reviewed_by: null, reviewed_at: null, created_at: new Date().toISOString() }
  if (old) {
    const { error } = await supabase().from('riders').update(payload).eq('id', old.id)
    fail(error)
  } else {
    const { error } = await supabase().from('riders').insert({ ...payload, user_id: user.id })
    fail(error)
  }
  return { ok: true }
}

export async function updateRider(user: Who, i: RiderInput): Promise<{ ok: true; error?: never } | { ok: false; error: RiderError }> {
  const r = await myRider(user.id)
  if (!r) return { ok: false, error: 'not_rider' }
  const c = checkRider(i)
  if (!c.ok) return c
  const { error } = await supabase().from('riders').update(c.values).eq('id', r.id)
  fail(error)
  return { ok: true }
}

/** "On a break": no new jobs offered (jobs already taken still need finishing). */
export async function setAvailable(user: Who, available: boolean) {
  const r = await myRider(user.id)
  if (!r || r.status !== 'active') return false
  const { error } = await supabase().from('riders').update({ available }).eq('id', r.id)
  fail(error)
  return true
}

/* ───────── Seller asks for a rider ───────── */
type Fail<E extends string> = { ok: false; error: E }

/** The seller offers the delivery to PAPA riders, paying them from their share. Riders who cover the area are told. */
export async function requestRider(user: Who, orderId: string, feeGhs: number, note?: string): Promise<{ ok: true; id: string; error?: never } | Fail<'not_found' | 'state' | 'fee'>> {
  const o = await getOrder(user, orderId)
  if (!o || o.role !== 'seller') return { ok: false, error: 'not_found' }
  if (!o.can.requestRider) return { ok: false, error: 'state' }
  const fee = Math.round(Number(feeGhs) * 100)
  const share = o.totalPesewas - o.refundedPesewas - o.feePesewas
  if (!Number.isInteger(fee) || fee < MIN_RIDER_FEE || fee > Math.min(100_000, share)) return { ok: false, error: 'fee' }
  const { data: shop, error: shopError } = o.shopId
    ? await supabase().from('shops').select('town,pickup_address').eq('id', o.shopId).maybeSingle()
    : { data: null, error: null }
  fail(shopError)
  const { data: delivery, error: deliveryError } = await supabase().from('deliveries').insert({
    order_id: orderId, shop_id: o.shopId, fee_pesewas: fee, pickup_town: shop?.town ?? null,
    pickup_address: shop?.pickup_address || shop?.town || o.shopName, dropoff_town: o.town,
    dropoff_address: [o.address, o.landmark].filter(Boolean).join(' · ') || o.town || '', note: note?.trim().slice(0, 300) || null,
  }).select('id').single()
  fail(deliveryError)
  const orderUpdate = { rider_fee_pesewas: fee, seller_net_pesewas: Math.max(0, share - fee), ...(o.status === 'accepted' ? { status: 'packed', packed_at: new Date().toISOString() } : {}) }
  const { error: orderError } = await supabase().from('market_orders').update(orderUpdate).eq('id', orderId)
  fail(orderError)
  if (o.status === 'accepted') await orderEvent(orderId, 'packed', user.id)
  await orderEvent(orderId, 'rider_requested', user.id)
  // Riders covering the shop's town or the buyer's town (all active riders if none cover them)
  const towns = [shop?.town, o.town].filter(Boolean).map((town) => town!.trim().toLowerCase())
  const { data: availableRiders, error: ridersError } = await supabase().from('riders').select('user_id,areas')
    .eq('status', 'active').eq('available', true).neq('user_id', user.id).limit(200)
  fail(ridersError)
  const matchingRiders = (availableRiders ?? []).filter((rider) => towns.some((town) => (rider.areas ?? []).some((area: string) => area.trim().toLowerCase() === town)))
  const recipients = matchingRiders.length ? matchingRiders : availableRiders ?? []
  for (const rider of recipients) await notify(rider.user_id, 'market_delivery', null, null, { marketOrderId: orderId }).catch(() => {})
  return { ok: true, id: delivery.id }
}

/** The seller calls the rider off (before pick-up): the order goes back to them to ship. */
export async function cancelRider(user: Who, orderId: string) {
  const o = await getOrder(user, orderId)
  if (!o || o.role !== 'seller' || !o.can.cancelRider || !o.delivery) return false
  const { data: delivery, error } = await supabase().from('deliveries').update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', o.delivery.id).in('status', ['open', 'accepted']).select('fee_pesewas,rider_id').maybeSingle()
  fail(error)
  if (!delivery) return false
  const { data: order, error: orderReadError } = await supabase().from('market_orders').select('seller_net_pesewas').eq('id', orderId).single()
  fail(orderReadError)
  const { error: orderUpdateError } = await supabase().from('market_orders').update({ rider_fee_pesewas: 0, seller_net_pesewas: order.seller_net_pesewas + delivery.fee_pesewas }).eq('id', orderId)
  fail(orderUpdateError)
  await orderEvent(orderId, 'rider_cancelled', user.id)
  if (delivery.rider_id) {
    const { data: rider, error: riderError } = await supabase().from('riders').select('user_id').eq('id', delivery.rider_id).maybeSingle()
    fail(riderError)
    if (rider) await notify(rider.user_id, 'market_delivery', null, null, { marketOrderId: orderId }).catch(() => {})
  }
  return true
}

/* ───────── Rider jobs ───────── */
export type Job = {
  id: string; orderId: string; number: string; status: 'open' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled'; feePesewas: number; shopName: string; shopPhone: string | null; sellerName: string | null
  sellerPhone: string | null; pickupTown: string | null; pickupAddress: string; dropoffTown: string | null; dropoffAddress: string; buyerName: string | null; buyerPhone: string | null; note: string | null
  items: number; createdAt: string; acceptedAt: string | null; pickedUpAt: string | null; deliveredAt: string | null; near: boolean; paid: boolean
}
type JobRow = {
  id: string; order_id: string; number: string; status: Job['status']; fee_pesewas: number; shop_name: string; shop_phone: string | null; seller_name: string | null; seller_phone: string | null; seller_id?: string; buyer_id?: string
  pickup_town: string | null; pickup_address: string; dropoff_town: string | null; dropoff_address: string; buyer_name: string | null; buyer_phone: string | null; note: string | null; items: number
  created_at: Date; accepted_at: Date | null; picked_up_at: Date | null; delivered_at: Date | null; rider_id?: string | null; near?: boolean; paid: boolean
}
type DeliveryRow = {
  id: string; order_id: string; status: Job['status']; fee_pesewas: number; shop_id: string | null; rider_id: string | null; payout_id: string | null
  pickup_town: string | null; pickup_address: string; dropoff_town: string | null; dropoff_address: string; note: string | null
  created_at: string; accepted_at: string | null; picked_up_at: string | null; delivered_at: string | null
}
async function hydrateJobs(deliveries: DeliveryRow[]): Promise<JobRow[]> {
  if (!deliveries.length) return []
  const client = supabase()
  const orderIds = [...new Set(deliveries.map((delivery) => delivery.order_id))]
  const shopIds = [...new Set(deliveries.map((delivery) => delivery.shop_id).filter(Boolean))] as string[]
  const payoutIds = [...new Set(deliveries.map((delivery) => delivery.payout_id).filter(Boolean))] as string[]
  const [{ data: orders, error: orderError }, { data: shops, error: shopError }, { data: items, error: itemsError }, { data: payouts, error: payoutError }] = await Promise.all([
    client.from('market_orders').select('id,number,status,shop_name,seller_id,buyer_id,recipient_name,phone').in('id', orderIds),
    shopIds.length ? client.from('shops').select('id,phone').in('id', shopIds) : Promise.resolve({ data: [], error: null }),
    client.from('market_order_items').select('order_id,qty').in('order_id', orderIds),
    payoutIds.length ? client.from('payouts').select('id,status').in('id', payoutIds) : Promise.resolve({ data: [], error: null }),
  ])
  fail(orderError); fail(shopError); fail(itemsError); fail(payoutError)
  const orderRows = orders ?? []
  const userIds = [...new Set(orderRows.flatMap((order) => [order.seller_id, order.buyer_id]).filter(Boolean))] as string[]
  const { data: users, error: usersError } = userIds.length ? await client.from('users').select('id,full_name,phone').in('id', userIds) : { data: [], error: null }
  fail(usersError)
  const orderById = new Map(orderRows.map((order) => [order.id, order]))
  const shopById = new Map((shops ?? []).map((shop) => [shop.id, shop]))
  const userById = new Map((users ?? []).map((user) => [user.id, user]))
  const itemsByOrder = new Map<string, number>()
  for (const item of items ?? []) itemsByOrder.set(item.order_id, (itemsByOrder.get(item.order_id) ?? 0) + item.qty)
  const paidPayouts = new Set((payouts ?? []).filter((payout) => payout.status === 'paid').map((payout) => payout.id))
  return deliveries.flatMap((delivery) => {
    const order = orderById.get(delivery.order_id)
    if (!order) return []
    const seller = userById.get(order.seller_id)
    const buyer = userById.get(order.buyer_id)
    const shop = delivery.shop_id ? shopById.get(delivery.shop_id) : null
    return [{
      id: delivery.id, order_id: order.id, number: order.number, status: delivery.status, fee_pesewas: delivery.fee_pesewas, shop_name: order.shop_name,
      shop_phone: shop?.phone ?? null, seller_name: seller?.full_name ?? null, seller_phone: seller?.phone ?? null, seller_id: order.seller_id, buyer_id: order.buyer_id,
      pickup_town: delivery.pickup_town, pickup_address: delivery.pickup_address, dropoff_town: delivery.dropoff_town, dropoff_address: delivery.dropoff_address,
      buyer_name: order.recipient_name, buyer_phone: order.phone, note: delivery.note, items: itemsByOrder.get(order.id) ?? 0,
      created_at: new Date(delivery.created_at), accepted_at: delivery.accepted_at ? new Date(delivery.accepted_at) : null,
      picked_up_at: delivery.picked_up_at ? new Date(delivery.picked_up_at) : null, delivered_at: delivery.delivered_at ? new Date(delivery.delivered_at) : null,
      rider_id: delivery.rider_id, paid: delivery.payout_id ? paidPayouts.has(delivery.payout_id) : false,
    }]
  })
}
const toJob = (r: JobRow, mine: boolean): Job => ({
  id: r.id, orderId: r.order_id, number: r.number, status: r.status, feePesewas: r.fee_pesewas, shopName: r.shop_name, shopPhone: mine ? r.shop_phone : null, sellerName: r.seller_name,
  sellerPhone: mine ? r.seller_phone : null, pickupTown: r.pickup_town, pickupAddress: mine ? r.pickup_address : (r.pickup_town ?? r.pickup_address), dropoffTown: r.dropoff_town,
  // Before taking the job a rider sees only the towns; the full address and phone numbers come after
  dropoffAddress: mine ? r.dropoff_address : '', buyerName: mine ? r.buyer_name : null, buyerPhone: mine ? r.buyer_phone : null, note: r.note, items: r.items,
  createdAt: iso(r.created_at)!, acceptedAt: iso(r.accepted_at), pickedUpAt: iso(r.picked_up_at), deliveredAt: iso(r.delivered_at), near: !!r.near, paid: r.paid,
})
/** Jobs waiting for a rider: the ones in my areas first. (A rider never sees jobs for their own shop or orders.) */
export async function openJobs(user: Who) {
  const rider = await myRider(user.id)
  if (!rider || rider.status !== 'active') return []
  const { data, error } = await supabase().from('deliveries')
    .select('id,order_id,status,fee_pesewas,shop_id,rider_id,payout_id,pickup_town,pickup_address,dropoff_town,dropoff_address,note,created_at,accepted_at,picked_up_at,delivered_at')
    .eq('status', 'open').order('created_at', { ascending: true }).limit(100)
  fail(error)
  const rows = await hydrateJobs((data ?? []) as DeliveryRow[])
  const orderIds = [...new Set(rows.map((row) => row.order_id))]
  const { data: orders, error: ordersError } = orderIds.length
    ? await supabase().from('market_orders').select('id,status,seller_id,buyer_id').in('id', orderIds)
    : { data: [], error: null }
  fail(ordersError)
  const orderById = new Map((orders ?? []).map((order) => [order.id, order]))
  const areas = rider.areas.map((area) => area.trim().toLowerCase())
  return rows.flatMap((row) => {
    const order = orderById.get(row.order_id)
    if (!order || ['cancelled', 'delivered', 'completed'].includes(order.status) || order.seller_id === user.id || order.buyer_id === user.id) return []
    const near = [row.pickup_town, row.dropoff_town].some((town) => town && areas.includes(town.trim().toLowerCase()))
    return [{ ...toJob({ ...row, near }, false), near }]
  }).sort((a, b) => Number(b.near) - Number(a.near))
}

/** My jobs: in progress, and finished (history). */
export async function myJobs(user: Who, done = false, limit = 100) {
  const rider = await myRider(user.id)
  if (!rider) return []
  const statuses = done ? ['delivered', 'cancelled'] : ['accepted', 'picked_up']
  const { data, error } = await supabase().from('deliveries')
    .select('id,order_id,status,fee_pesewas,shop_id,rider_id,payout_id,pickup_town,pickup_address,dropoff_town,dropoff_address,note,created_at,accepted_at,picked_up_at,delivered_at')
    .eq('rider_id', rider.id).in('status', statuses).order('created_at', { ascending: false }).limit(limit)
  fail(error)
  return (await hydrateJobs((data ?? []) as DeliveryRow[])).map((row) => toJob(row, true))
}

export async function getJob(user: Who, id: string) {
  if (!isId(id)) return null
  const rider = await myRider(user.id)
  const { data, error } = await supabase().from('deliveries')
    .select('id,order_id,status,fee_pesewas,shop_id,rider_id,payout_id,pickup_town,pickup_address,dropoff_town,dropoff_address,note,created_at,accepted_at,picked_up_at,delivered_at')
    .eq('id', id).maybeSingle()
  fail(error)
  if (!data) return null
  const j = (await hydrateJobs([data as DeliveryRow]))[0]
  if (!j) return null
  const mine = !!rider && data.rider_id === rider.id
  if (!mine && !(j.status === 'open' && rider?.status === 'active') && user.role !== 'tech_admin') return null
  return { ...toJob(j, mine || user.role === 'tech_admin'), mine, canAccept: j.status === 'open' && rider?.status === 'active' }
}

/** Take a job (first rider wins). */
export async function acceptJob(user: Who, id: string): Promise<{ ok: true } | Fail<'not_rider' | 'not_found' | 'taken' | 'too_many' | 'own'>> {
  const r = await myRider(user.id)
  if (!r || r.status !== 'active') return { ok: false, error: 'not_rider' }
  if (!isId(id)) return { ok: false, error: 'not_found' }
  const { count, error: countError } = await supabase().from('deliveries').select('id', { count: 'exact', head: true }).eq('rider_id', r.id).in('status', ['accepted', 'picked_up'])
  fail(countError)
  if ((count ?? 0) >= MAX_ACTIVE) return { ok: false, error: 'too_many' }
  const { data: delivery, error: deliveryError } = await supabase().from('deliveries').select('order_id').eq('id', id).maybeSingle()
  fail(deliveryError)
  if (!delivery) return { ok: false, error: 'not_found' }
  const { data: order, error: orderError } = await supabase().from('market_orders').select('seller_id,buyer_id').eq('id', delivery.order_id).single()
  fail(orderError)
  if (order.seller_id === user.id || order.buyer_id === user.id) return { ok: false, error: 'own' }
  const { data: accepted, error } = await supabase().from('deliveries').update({ rider_id: r.id, status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'open').select('order_id').maybeSingle()
  fail(error)
  if (!accepted) return { ok: false, error: 'taken' }
  await orderEvent(accepted.order_id, 'rider_assigned', user.id)
  await tellOrder(accepted.order_id)
  return { ok: true }
}

/** Drop a job before picking it up: it goes back to the list. */
export async function dropJob(user: Who, id: string) {
  const r = await myRider(user.id)
  if (!r || !isId(id)) return false
  const { data, error } = await supabase().from('deliveries').update({ rider_id: null, status: 'open', accepted_at: null })
    .eq('id', id).eq('rider_id', r.id).eq('status', 'accepted').select('order_id').maybeSingle()
  fail(error)
  if (!data) return false
  await orderEvent(data.order_id, 'rider_dropped', user.id)
  await tellOrder(data.order_id, true)
  return true
}

/** Collected from the seller: the order is on its way and the buyer gets their code by SMS. */
export async function pickUp(user: Who, id: string) {
  const r = await myRider(user.id)
  if (!r || !isId(id)) return false
  const { data, error } = await supabase().from('deliveries').update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
    .eq('id', id).eq('rider_id', r.id).eq('status', 'accepted').select('order_id').maybeSingle()
  fail(error)
  if (!data) return false
  const { error: orderError } = await supabase().from('market_orders').update({ status: 'shipped', shipped_at: new Date().toISOString() })
    .eq('id', data.order_id).in('status', ['accepted', 'packed'])
  fail(orderError)
  await orderEvent(data.order_id, 'shipped', user.id, 'rider')
  await tellOrder(data.order_id)
  await textHandoverCode(data.order_id)
  return true
}

/** At the buyer's door: the rider enters the buyer's 6-digit code. */
export async function deliver(user: Who, id: string, code: string): Promise<{ ok: true } | Fail<'not_found' | 'state' | 'code'>> {
  const r = await myRider(user.id)
  if (!r || !isId(id)) return { ok: false, error: 'not_found' }
  const { data: delivery, error } = await supabase().from('deliveries').select('order_id,status').eq('id', id).eq('rider_id', r.id).maybeSingle()
  fail(error)
  if (!delivery) return { ok: false, error: 'not_found' }
  if (delivery.status !== 'picked_up') return { ok: false, error: 'state' }
  const res = await deliverWithCode(delivery.order_id, user.id, code, 'code_checked')
  if (!res.ok) return res
  const { error: updateError } = await supabase().from('deliveries').update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', id).eq('rider_id', r.id).eq('status', 'picked_up')
  fail(updateError)
  await tellOrder(delivery.order_id)
  return { ok: true }
}

/** Seller and buyer follow the delivery. */
async function tellOrder(orderId: string, sellerOnly = false) {
  const { data, error } = await supabase().from('market_orders').select('buyer_id,seller_id').eq('id', orderId).maybeSingle()
  fail(error)
  if (data?.seller_id) await notify(data.seller_id, 'market_sale', null, null, { marketOrderId: orderId }).catch(() => {})
  if (data?.buyer_id && !sellerOnly) await notify(data.buyer_id, 'market_order', null, null, { marketOrderId: orderId }).catch(() => {})
}

/** Rider home numbers. */
export async function riderStats(user: Who) {
  const r = await myRider(user.id)
  if (!r) return null
  const client = supabase()
  const [{ data: delivered, error: deliveredError }, { count: active, error: activeError }, { data: paidPayouts, error: paidError }] = await Promise.all([
    client.from('deliveries').select('fee_pesewas,payout_id,delivered_at').eq('rider_id', r.id).eq('status', 'delivered'),
    client.from('deliveries').select('id', { count: 'exact', head: true }).eq('rider_id', r.id).in('status', ['accepted', 'picked_up']),
    client.from('payouts').select('amount_pesewas').eq('rider_id', r.id).eq('status', 'paid'),
  ])
  fail(deliveredError); fail(activeError); fail(paidError)
  const payoutIds = [...new Set((delivered ?? []).map((delivery) => delivery.payout_id).filter(Boolean))] as string[]
  const { data: payouts, error: payoutError } = payoutIds.length ? await client.from('payouts').select('id,status').in('id', payoutIds) : { data: [], error: null }
  fail(payoutError)
  const paidIds = new Set((payouts ?? []).filter((payout) => payout.status === 'paid').map((payout) => payout.id))
  const rows = delivered ?? []
  return {
    rider: r,
    done: rows.length,
    done30: rows.filter((delivery) => new Date(delivery.delivered_at).getTime() > Date.now() - 30 * 86_400_000).length,
    earned: rows.reduce((sum, delivery) => sum + delivery.fee_pesewas, 0),
    held: rows.filter((delivery) => !delivery.payout_id || !paidIds.has(delivery.payout_id)).reduce((sum, delivery) => sum + delivery.fee_pesewas, 0),
    paid: (paidPayouts ?? []).reduce((sum, payout) => sum + payout.amount_pesewas, 0),
    active: active ?? 0,
  }
}

/* ───────── Tech Admins ───────── */
export async function adminRiders(status?: string) {
  const allowed = ['pending', 'active', 'paused', 'rejected', 'suspended']
  const client = supabase()
  let query = client.from('riders').select('id,user_id,phone,vehicle,plate,areas,status,available,created_at,about')
  if (status && allowed.includes(status)) query = query.eq('status', status)
  const { data: riders, error } = await query.order('created_at', { ascending: false }).limit(300)
  fail(error)
  const rows = riders ?? []
  const userIds = [...new Set(rows.map((rider) => rider.user_id))]
  const riderIds = rows.map((rider) => rider.id)
  const [{ data: users, error: usersError }, { data: completed, error: completedError }] = await Promise.all([
    userIds.length ? client.from('users').select('id,full_name,username').in('id', userIds) : Promise.resolve({ data: [], error: null }),
    riderIds.length ? client.from('deliveries').select('rider_id').in('rider_id', riderIds).eq('status', 'delivered') : Promise.resolve({ data: [], error: null }),
  ])
  fail(usersError); fail(completedError)
  const userById = new Map((users ?? []).map((user) => [user.id, user]))
  const doneByRider = new Map<string, number>()
  for (const delivery of completed ?? []) doneByRider.set(delivery.rider_id, (doneByRider.get(delivery.rider_id) ?? 0) + 1)
  return rows.map((rider) => ({
    id: rider.id, user_id: rider.user_id, name: userById.get(rider.user_id)?.full_name ?? '', username: userById.get(rider.user_id)?.username ?? '',
    phone: rider.phone, vehicle: rider.vehicle, plate: rider.plate, areas: rider.areas, status: rider.status, available: rider.available,
    created_at: iso(new Date(rider.created_at))!, done: doneByRider.get(rider.id) ?? 0, about: rider.about,
  }))
}

/** Approve, pause, reject or suspend a rider (they're told). Riders with jobs in progress keep them. */
export async function setRiderStatus(admin: Who, riderId: string, status: 'active' | 'paused' | 'rejected' | 'suspended', note?: string) {
  if (admin.role !== 'tech_admin' || !isId(riderId)) return false
  const { data: rider, error } = await supabase().from('riders').update({ status, note: note?.trim().slice(0, 300) || null, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq('id', riderId).select('user_id').maybeSingle()
  fail(error)
  if (!rider) return false
  await notify(rider.user_id, 'market_rider', null, null, {}).catch(() => {})
  return true
}

export async function adminDeliveries(status?: string) {
  const allowed = ['open', 'accepted', 'picked_up', 'delivered', 'cancelled']
  let query = supabase().from('deliveries').select('id,order_id,status,fee_pesewas,shop_id,rider_id,payout_id,pickup_town,pickup_address,dropoff_town,dropoff_address,note,created_at,accepted_at,picked_up_at,delivered_at')
  if (status && allowed.includes(status)) query = query.eq('status', status)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200)
  fail(error)
  const deliveries = (data ?? []) as DeliveryRow[]
  const rows = await hydrateJobs(deliveries)
  const riderIds = [...new Set(deliveries.map((delivery) => delivery.rider_id).filter(Boolean))] as string[]
  const { data: riders, error: ridersError } = riderIds.length ? await supabase().from('riders').select('id,user_id').in('id', riderIds) : { data: [], error: null }
  fail(ridersError)
  const userIds = [...new Set((riders ?? []).map((rider) => rider.user_id))]
  const { data: users, error: usersError } = userIds.length ? await supabase().from('users').select('id,full_name').in('id', userIds) : { data: [], error: null }
  fail(usersError)
  const nameByUser = new Map((users ?? []).map((person) => [person.id, person.full_name]))
  const nameByRider = new Map((riders ?? []).map((rider) => [rider.id, nameByUser.get(rider.user_id) ?? null]))
  return rows.map((row) => ({ ...toJob(row, true), rider: nameByRider.get(row.rider_id ?? '') ?? null }))
}

