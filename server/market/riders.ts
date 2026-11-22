import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
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

/* ───────── Becoming a rider ───────── */
export type RiderInput = { phone: string; vehicle: string; plate?: string | null; areas: string[]; about?: string | null; payoutProvider: string; payoutNumber: string; payoutName: string; acceptTerms?: boolean }
export type RiderError = 'phone' | 'vehicle' | 'areas' | 'about' | 'payout' | 'terms' | 'exists' | 'not_rider' | 'rate_limited'

export async function myRider(userId: string) {
  const [r] = await db.select().from(schema.riders).where(eq(schema.riders.userId, userId))
  return r ?? null
}
export type Rider = NonNullable<Awaited<ReturnType<typeof myRider>>>

function checkRider(i: RiderInput): { ok: false; error: RiderError } | { ok: true; values: Omit<typeof schema.riders.$inferInsert, 'userId'> } {
  const phone = normalisePhone(i.phone ?? '')
  if (!isGhanaMobile(phone)) return { ok: false, error: 'phone' }
  if (!VEHICLES.includes(i.vehicle as never)) return { ok: false, error: 'vehicle' }
  const areas = [...new Set((i.areas ?? []).map((a) => a.trim()).filter(Boolean).map((a) => a.slice(0, 40)))].slice(0, 20)
  if (!areas.length) return { ok: false, error: 'areas' }
  if ((i.about?.length ?? 0) > 500 || (i.plate?.length ?? 0) > 20) return { ok: false, error: 'about' }
  const num = normalisePhone(i.payoutNumber ?? '')
  if (!PAYOUT_NETWORKS.includes(i.payoutProvider as never) || !isGhanaMobile(num) || (i.payoutName?.trim().length ?? 0) < 3 || i.payoutName.length > 80) return { ok: false, error: 'payout' }
  return { ok: true, values: { phone, vehicle: i.vehicle as (typeof VEHICLES)[number], plate: i.plate?.trim().toUpperCase() || null, areas, about: i.about?.trim() || null,
    payoutProvider: i.payoutProvider, payoutNumber: num, payoutName: i.payoutName.trim() } }
}

/** "Become a rider": the application waits for a Tech Admin. */
export async function applyRider(user: Who, i: RiderInput): Promise<{ ok: true; error?: never } | { ok: false; error: RiderError }> {
  if (!i.acceptTerms) return { ok: false, error: 'terms' }
  const old = await myRider(user.id)
  if (old && old.status !== 'rejected') return { ok: false, error: 'exists' }
  const c = checkRider(i)
  if (!c.ok) return c
  if (!(await hit(`mkt-rider:${user.id}`, 5, 86_400))) return { ok: false, error: 'rate_limited' }
  if (old) await db.update(schema.riders).set({ ...c.values, status: 'pending', note: null, reviewedAt: null, reviewedBy: null, createdAt: sql`now()` }).where(eq(schema.riders.id, old.id))
  else await db.insert(schema.riders).values({ ...c.values, userId: user.id })
  return { ok: true }
}

export async function updateRider(user: Who, i: RiderInput): Promise<{ ok: true; error?: never } | { ok: false; error: RiderError }> {
  const r = await myRider(user.id)
  if (!r) return { ok: false, error: 'not_rider' }
  const c = checkRider(i)
  if (!c.ok) return c
  await db.update(schema.riders).set(c.values).where(eq(schema.riders.id, r.id))
  return { ok: true }
}

/** "On a break": no new jobs offered (jobs already taken still need finishing). */
export async function setAvailable(user: Who, available: boolean) {
  const r = await myRider(user.id)
  if (!r || r.status !== 'active') return false
  await db.update(schema.riders).set({ available }).where(eq(schema.riders.id, r.id))
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
  const [shop] = o.shopId ? await db.select().from(schema.shops).where(eq(schema.shops.id, o.shopId)) : []
  const [d] = await db.insert(schema.deliveries).values({
    orderId, shopId: o.shopId, feePesewas: fee, pickupTown: shop?.town ?? null, pickupAddress: shop?.pickupAddress || shop?.town || o.shopName,
    dropoffTown: o.town, dropoffAddress: [o.address, o.landmark].filter(Boolean).join(' · ') || o.town || '', note: note?.trim().slice(0, 300) || null,
  }).returning()
  await db.update(schema.marketOrders).set({ riderFeePesewas: fee, sellerNetPesewas: Math.max(0, share - fee), ...(o.status === 'accepted' ? { status: 'packed' as const, packedAt: sql`now()` } : {}) })
    .where(eq(schema.marketOrders.id, orderId))
  if (o.status === 'accepted') await orderEvent(orderId, 'packed', user.id)
  await orderEvent(orderId, 'rider_requested', user.id)
  // Riders covering the shop's town or the buyer's town (all active riders if none cover them)
  const towns = [shop?.town, o.town].filter(Boolean).map((t) => t!.trim().toLowerCase())
  const near = towns.length ? await db.execute<{ user_id: string }>(sql`select r.user_id from riders r where r.status = 'active' and r.available and r.user_id <> ${user.id}
    and exists (select 1 from jsonb_array_elements_text(r.areas) a where lower(a) in ${towns}) limit 200`) : { rows: [] }
  const to = near.rows.length ? near.rows : (await db.execute<{ user_id: string }>(sql`select user_id from riders where status = 'active' and available and user_id <> ${user.id} limit 200`)).rows
  for (const r of to) await notify(r.user_id, 'market_delivery', null, null, { marketOrderId: orderId }).catch(() => {})
  return { ok: true, id: d.id }
}

/** The seller calls the rider off (before pick-up): the order goes back to them to ship. */
export async function cancelRider(user: Who, orderId: string) {
  const o = await getOrder(user, orderId)
  if (!o || o.role !== 'seller' || !o.can.cancelRider || !o.delivery) return false
  const [d] = await db.update(schema.deliveries).set({ status: 'cancelled', cancelledAt: sql`now()` })
    .where(and(eq(schema.deliveries.id, o.delivery.id), sql`${schema.deliveries.status} in ('open', 'accepted')`)).returning()
  if (!d) return false
  await db.update(schema.marketOrders).set({ riderFeePesewas: 0, sellerNetPesewas: sql`${schema.marketOrders.sellerNetPesewas} + ${d.feePesewas}` }).where(eq(schema.marketOrders.id, orderId))
  await orderEvent(orderId, 'rider_cancelled', user.id)
  if (d.riderId) {
    const [r] = await db.select({ u: schema.riders.userId }).from(schema.riders).where(eq(schema.riders.id, d.riderId))
    if (r) await notify(r.u, 'market_delivery', null, null, { marketOrderId: orderId }).catch(() => {})
  }
  return true
}

/* ───────── Rider jobs ───────── */
export type Job = {
  id: string; orderId: string; number: string; status: 'open' | 'accepted' | 'picked_up' | 'delivered' | 'cancelled'; feePesewas: number; shopName: string; shopPhone: string | null; sellerName: string | null
  sellerPhone: string | null; pickupTown: string | null; pickupAddress: string; dropoffTown: string | null; dropoffAddress: string; buyerName: string | null; buyerPhone: string | null; note: string | null
  items: number; createdAt: string; acceptedAt: string | null; pickedUpAt: string | null; deliveredAt: string | null; near: boolean; paid: boolean
}
const JOB_SQL = sql.raw(`d.id, d.order_id, o.number, d.status, d.fee_pesewas, o.shop_name, s.phone as shop_phone, su.full_name as seller_name, su.phone as seller_phone,
  d.pickup_town, d.pickup_address, d.dropoff_town, d.dropoff_address, o.recipient_name as buyer_name, o.phone as buyer_phone, d.note,
  (select coalesce(sum(i.qty), 0)::int from market_order_items i where i.order_id = o.id) as items, d.created_at, d.accepted_at, d.picked_up_at, d.delivered_at,
  coalesce((select p.status = 'paid' from payouts p where p.id = d.payout_id), false) as paid`)
type JobRow = {
  id: string; order_id: string; number: string; status: Job['status']; fee_pesewas: number; shop_name: string; shop_phone: string | null; seller_name: string | null; seller_phone: string | null
  pickup_town: string | null; pickup_address: string; dropoff_town: string | null; dropoff_address: string; buyer_name: string | null; buyer_phone: string | null; note: string | null; items: number
  created_at: Date; accepted_at: Date | null; picked_up_at: Date | null; delivered_at: Date | null; near?: boolean; paid: boolean
}
const toJob = (r: JobRow, mine: boolean): Job => ({
  id: r.id, orderId: r.order_id, number: r.number, status: r.status, feePesewas: r.fee_pesewas, shopName: r.shop_name, shopPhone: mine ? r.shop_phone : null, sellerName: r.seller_name,
  sellerPhone: mine ? r.seller_phone : null, pickupTown: r.pickup_town, pickupAddress: mine ? r.pickup_address : (r.pickup_town ?? r.pickup_address), dropoffTown: r.dropoff_town,
  // Before taking the job a rider sees only the towns; the full address and phone numbers come after
  dropoffAddress: mine ? r.dropoff_address : '', buyerName: mine ? r.buyer_name : null, buyerPhone: mine ? r.buyer_phone : null, note: r.note, items: r.items,
  createdAt: iso(r.created_at)!, acceptedAt: iso(r.accepted_at), pickedUpAt: iso(r.picked_up_at), deliveredAt: iso(r.delivered_at), near: !!r.near, paid: r.paid,
})
const FROM = sql.raw(`from deliveries d join market_orders o on o.id = d.order_id left join shops s on s.id = d.shop_id left join users su on su.id = o.seller_id`)

/** Jobs waiting for a rider: the ones in my areas first. (A rider never sees jobs for their own shop or orders.) */
export async function openJobs(user: Who) {
  const r = await myRider(user.id)
  if (!r || r.status !== 'active') return []
  // Riders always have at least one area (checked when they apply)
  const areas = r.areas.length ? r.areas.map((a) => a.trim().toLowerCase()) : ['-']
  const rows = await db.execute<JobRow>(sql`select ${JOB_SQL}, (lower(coalesce(d.pickup_town, '')) in ${areas} or lower(coalesce(d.dropoff_town, '')) in ${areas}) as near
    ${FROM} where d.status = 'open' and o.status not in ('cancelled', 'delivered', 'completed') and o.seller_id <> ${user.id} and o.buyer_id is distinct from ${user.id}
    order by near desc, d.created_at limit 100`)
  return rows.rows.map((x) => toJob(x, false))
}

/** My jobs: in progress, and finished (history). */
export async function myJobs(user: Who, done = false, limit = 100) {
  const r = await myRider(user.id)
  if (!r) return []
  const rows = await db.execute<JobRow>(sql`select ${JOB_SQL} ${FROM} where d.rider_id = ${r.id} and d.status ${done ? sql`in ('delivered', 'cancelled')` : sql`in ('accepted', 'picked_up')`}
    order by coalesce(d.delivered_at, d.cancelled_at, d.accepted_at) desc limit ${limit}`)
  return rows.rows.map((x) => toJob(x, true))
}

export async function getJob(user: Who, id: string) {
  if (!isId(id)) return null
  const r = await myRider(user.id)
  const rows = await db.execute<JobRow & { rider_id: string | null }>(sql`select ${JOB_SQL}, d.rider_id ${FROM} where d.id = ${id}`)
  const j = rows.rows[0]
  if (!j) return null
  const mine = !!r && j.rider_id === r.id
  if (!mine && !(j.status === 'open' && r?.status === 'active') && user.role !== 'tech_admin') return null
  return { ...toJob(j, mine || user.role === 'tech_admin'), mine, canAccept: j.status === 'open' && r?.status === 'active' }
}

/** Take a job (first rider wins). */
export async function acceptJob(user: Who, id: string): Promise<{ ok: true } | Fail<'not_rider' | 'not_found' | 'taken' | 'too_many' | 'own'>> {
  const r = await myRider(user.id)
  if (!r || r.status !== 'active') return { ok: false, error: 'not_rider' }
  if (!isId(id)) return { ok: false, error: 'not_found' }
  if ((await db.$count(schema.deliveries, and(eq(schema.deliveries.riderId, r.id), sql`${schema.deliveries.status} in ('accepted', 'picked_up')`))) >= MAX_ACTIVE) return { ok: false, error: 'too_many' }
  const own = await db.execute(sql`select 1 from deliveries d join market_orders o on o.id = d.order_id where d.id = ${id} and (o.seller_id = ${user.id} or o.buyer_id = ${user.id})`)
  if (own.rows.length) return { ok: false, error: 'own' }
  const [d] = await db.update(schema.deliveries).set({ riderId: r.id, status: 'accepted', acceptedAt: sql`now()` }).where(and(eq(schema.deliveries.id, id), eq(schema.deliveries.status, 'open'))).returning()
  if (!d) return { ok: false, error: 'taken' }
  await orderEvent(d.orderId, 'rider_assigned', user.id)
  await tellOrder(d.orderId)
  return { ok: true }
}

/** Drop a job before picking it up: it goes back to the list. */
export async function dropJob(user: Who, id: string) {
  const r = await myRider(user.id)
  if (!r || !isId(id)) return false
  const [d] = await db.update(schema.deliveries).set({ riderId: null, status: 'open', acceptedAt: null }).where(and(eq(schema.deliveries.id, id), eq(schema.deliveries.riderId, r.id), eq(schema.deliveries.status, 'accepted'))).returning()
  if (!d) return false
  await orderEvent(d.orderId, 'rider_dropped', user.id)
  await tellOrder(d.orderId, true)
  return true
}

/** Collected from the seller: the order is on its way and the buyer gets their code by SMS. */
export async function pickUp(user: Who, id: string) {
  const r = await myRider(user.id)
  if (!r || !isId(id)) return false
  const [d] = await db.update(schema.deliveries).set({ status: 'picked_up', pickedUpAt: sql`now()` }).where(and(eq(schema.deliveries.id, id), eq(schema.deliveries.riderId, r.id), eq(schema.deliveries.status, 'accepted'))).returning()
  if (!d) return false
  await db.update(schema.marketOrders).set({ status: 'shipped', shippedAt: sql`now()` }).where(and(eq(schema.marketOrders.id, d.orderId), sql`${schema.marketOrders.status} in ('accepted', 'packed')`))
  await orderEvent(d.orderId, 'shipped', user.id, 'rider')
  await tellOrder(d.orderId)
  await textHandoverCode(d.orderId)
  return true
}

/** At the buyer's door: the rider enters the buyer's 6-digit code. */
export async function deliver(user: Who, id: string, code: string): Promise<{ ok: true } | Fail<'not_found' | 'state' | 'code'>> {
  const r = await myRider(user.id)
  if (!r || !isId(id)) return { ok: false, error: 'not_found' }
  const [d] = await db.select().from(schema.deliveries).where(and(eq(schema.deliveries.id, id), eq(schema.deliveries.riderId, r.id)))
  if (!d) return { ok: false, error: 'not_found' }
  if (d.status !== 'picked_up') return { ok: false, error: 'state' }
  const res = await deliverWithCode(d.orderId, user.id, code, 'code_checked')
  if (!res.ok) return res
  await db.update(schema.deliveries).set({ status: 'delivered', deliveredAt: sql`now()` }).where(eq(schema.deliveries.id, id))
  await tellOrder(d.orderId)
  return { ok: true }
}

/** Seller and buyer follow the delivery. */
async function tellOrder(orderId: string, sellerOnly = false) {
  const [o] = await db.select({ b: schema.marketOrders.buyerId, s: schema.marketOrders.sellerId }).from(schema.marketOrders).where(eq(schema.marketOrders.id, orderId))
  if (o?.s) await notify(o.s, 'market_sale', null, null, { marketOrderId: orderId }).catch(() => {})
  if (o?.b && !sellerOnly) await notify(o.b, 'market_order', null, null, { marketOrderId: orderId }).catch(() => {})
}

/** Rider home numbers. */
export async function riderStats(user: Who) {
  const r = await myRider(user.id)
  if (!r) return null
  const [s] = (await db.execute<{ done: number; done30: number; earned: number; held: number; paid: number; active: number }>(sql`select
    (select count(*)::int from deliveries where rider_id = ${r.id} and status = 'delivered') as done,
    (select count(*)::int from deliveries where rider_id = ${r.id} and status = 'delivered' and delivered_at > now() - interval '30 days') as done30,
    (select coalesce(sum(fee_pesewas), 0)::int from deliveries where rider_id = ${r.id} and status = 'delivered') as earned,
    (select coalesce(sum(d.fee_pesewas), 0)::int from deliveries d left join payouts p on p.id = d.payout_id where d.rider_id = ${r.id} and d.status = 'delivered' and (p.id is null or p.status <> 'paid')) as held,
    (select coalesce(sum(amount_pesewas), 0)::int from payouts where rider_id = ${r.id} and status = 'paid') as paid,
    (select count(*)::int from deliveries where rider_id = ${r.id} and status in ('accepted', 'picked_up')) as active`)).rows
  return { rider: r, ...s }
}

/* ───────── Tech Admins ───────── */
export async function adminRiders(status?: string) {
  const st = (['pending', 'active', 'paused', 'rejected', 'suspended'] as const).find((x) => x === status)
  const r = await db.execute<{ id: string; user_id: string; name: string; username: string; phone: string; vehicle: string; plate: string | null; areas: string[]; status: string; available: boolean; created_at: Date; done: number; about: string | null }>(sql`
    select r.id, r.user_id, u.full_name as name, u.username, r.phone, r.vehicle, r.plate, r.areas, r.status, r.available, r.created_at, r.about,
      (select count(*)::int from deliveries d where d.rider_id = r.id and d.status = 'delivered') as done
    from riders r join users u on u.id = r.user_id ${st ? sql`where r.status = ${st}` : sql``} order by (r.status = 'pending') desc, r.created_at desc limit 300`)
  return r.rows.map((x) => ({ ...x, created_at: iso(x.created_at)! }))
}

/** Approve, pause, reject or suspend a rider (they're told). Riders with jobs in progress keep them. */
export async function setRiderStatus(admin: Who, riderId: string, status: 'active' | 'paused' | 'rejected' | 'suspended', note?: string) {
  if (admin.role !== 'tech_admin' || !isId(riderId)) return false
  const [r] = await db.update(schema.riders).set({ status, note: note?.trim().slice(0, 300) || null, reviewedBy: admin.id, reviewedAt: sql`now()` }).where(eq(schema.riders.id, riderId)).returning()
  if (!r) return false
  await notify(r.userId, 'market_rider', null, null, {}).catch(() => {})
  return true
}

export async function adminDeliveries(status?: string) {
  const st = (['open', 'accepted', 'picked_up', 'delivered', 'cancelled'] as const).find((x) => x === status)
  const r = await db.execute<JobRow & { rider: string | null }>(sql`select ${JOB_SQL}, (select u.full_name from riders r join users u on u.id = r.user_id where r.id = d.rider_id) as rider
    ${FROM} ${st ? sql`where d.status = ${st}` : sql``} order by d.created_at desc limit 200`)
  return r.rows.map((x) => ({ ...toJob(x, true), rider: x.rider }))
}

