import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import * as seller from '@/server/market/seller'
import * as cart from '@/server/market/cart'
import * as orders from '@/server/market/orders'
import * as riders from '@/server/market/riders'
import * as payouts from '@/server/market/payouts'
import { confirmPayment } from '@/server/payments/payments'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string; role: 'member' | 'tech_admin' }
let sel: U, buyer: U, rider: U, rider2: U, admin: U
let variant: string, shopId: string
const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }> }
const addr = { name: 'Buyer', phone: '024 555 0000', town: 'Osu', address: 'House 1, Oxford St' }
const order = async (id: string) => (await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, id)))[0]
const riderInput: riders.RiderInput = { phone: '024 700 1111', vehicle: 'motorbike', plate: 'gr 123-24', areas: ['Osu', ' Labone '], payoutProvider: 'mtn', payoutNumber: '024 700 1111', payoutName: 'Rider One', acceptTerms: true }
async function buy(f: 'delivery' | 'pickup' = 'delivery') {
  await db.delete(schema.cartItems).where(eq(schema.cartItems.userId, buyer.id))
  ok(await cart.addToCart(buyer, variant, 1))
  const r = ok(await cart.placeOrder(buyer, [{ shopId, fulfilment: f }], f === 'delivery' ? addr : null))
  await confirmPayment(r.reference, 'success')
  const [o] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.checkoutId, r.checkoutId))
  ok(await orders.sellerStep(sel, o.id, 'accept'))
  return o.id
}

beforeAll(async () => {
  delete process.env.PAYSTACK_SECRET_KEY
  await cleanup()
  const mk = async (n: number, u: string, role: U['role'] = 'member'): Promise<U> => ({ ...(await makeUser(n, u)), role })
  sel = await mk(991, 'zz_rsel'); buyer = await mk(992, 'zz_rbuyer'); rider = await mk(993, 'zz_rider1'); rider2 = await mk(994, 'zz_rider2'); admin = await mk(995, 'zz_radm', 'tech_admin')
  await db.update(schema.users).set({ role: 'tech_admin' }).where(eq(schema.users.id, admin.id))
  ok(await seller.openShop(sel, { name: 'ZZ Rider Shop', offersPickup: true, pickupAddress: 'Osu market', offersDelivery: true, deliveryFeeGhs: 20, town: 'Osu', returnDays: 2, acceptTerms: true,
    payoutMethod: 'momo', payoutProvider: 'mtn', payoutNumber: '024 111 9999', payoutName: 'Shop Owner' }))
  shopId = (await seller.myShop(sel.id))!.id
  const p = ok(await seller.saveProduct(sel, { title: 'ZZ Rider item', category: 'food', condition: 'new', images: ['/demo/mk-chin-chin.jpg'], optionNames: [], status: 'active', variants: [{ options: {}, priceGhs: 100, stock: 50 }] }))
  variant = (await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, p.id)))[0].id
})
afterAll(async () => { await cleanup(); await pool.end() })

describe('becoming a rider', () => {
  it('applies with valid details and waits for a Tech Admin', async () => {
    expect(await riders.applyRider(rider, { ...riderInput, acceptTerms: false })).toEqual({ ok: false, error: 'terms' })
    expect(await riders.applyRider(rider, { ...riderInput, areas: [] })).toEqual({ ok: false, error: 'areas' })
    expect(await riders.applyRider(rider, { ...riderInput, payoutNumber: '12' })).toEqual({ ok: false, error: 'payout' })
    ok(await riders.applyRider(rider, riderInput))
    expect(await riders.applyRider(rider, riderInput)).toEqual({ ok: false, error: 'exists' })
    const r = (await riders.myRider(rider.id))!
    expect(r).toMatchObject({ status: 'pending', areas: ['Osu', 'Labone'], plate: 'GR 123-24', payoutNumber: '233247001111' })
    expect(await riders.openJobs(rider)).toEqual([])
    expect(await riders.setRiderStatus(rider, r.id, 'active')).toBe(false)
    expect(await riders.setRiderStatus(admin, r.id, 'active')).toBe(true)
    ok(await riders.applyRider(rider2, { ...riderInput, areas: ['Kumasi'] }))
    await riders.setRiderStatus(admin, (await riders.myRider(rider2.id))!.id, 'active')
    expect((await db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, rider.id), sql`${schema.notifications.type}::text = 'market_rider'`))).length).toBe(1)
  })
})

describe('a delivery by a PAPA rider', () => {
  let orderId: string, jobId: string
  it('the seller offers the job, paying the rider from their share; riders in the area are told', async () => {
    orderId = await buy()
    const before = await order(orderId)
    expect(await riders.requestRider(sel, orderId, 2)).toEqual({ ok: false, error: 'fee' })
    jobId = ok(await riders.requestRider(sel, orderId, 25, 'Fragile')).id
    const o = await order(orderId)
    expect(o).toMatchObject({ status: 'packed', riderFeePesewas: 2_500, sellerNetPesewas: before.sellerNetPesewas - 2_500 })
    const told = async (u: string) => (await db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, u), sql`${schema.notifications.type}::text = 'market_delivery'`))).length
    expect(await told(rider.id)).toBe(1)
    expect(await told(rider2.id)).toBe(0)
    expect(await riders.requestRider(sel, orderId, 25)).toEqual({ ok: false, error: 'state' })
    expect((await orders.getOrder(sel, orderId))!.can).toMatchObject({ ship: false, cancelRider: true })
  })

  it('riders see the towns first, the address only after taking it; first rider wins', async () => {
    const list = await riders.openJobs(rider)
    const j = list.find((x) => x.id === jobId)!
    expect(j).toMatchObject({ near: true, dropoffTown: 'Osu', dropoffAddress: '', buyerPhone: null, feePesewas: 2_500 })
    expect((await riders.openJobs(rider2)).find((x) => x.id === jobId)!.near).toBe(false)
    expect(await riders.acceptJob(sel, jobId)).toEqual({ ok: false, error: 'not_rider' })
    ok(await riders.acceptJob(rider, jobId))
    expect(await riders.acceptJob(rider2, jobId)).toEqual({ ok: false, error: 'taken' })
    const mine = (await riders.getJob(rider, jobId))!
    expect(mine).toMatchObject({ mine: true, dropoffAddress: 'House 1, Oxford St', buyerPhone: '233245550000' })
    expect((await orders.getOrder(buyer, orderId))!.delivery!.rider!.name).toBe('Test Member 993')
  })

  it('drop puts it back; pick up ships it; the seller can no longer hand it over; delivered with the code', async () => {
    expect(await riders.dropJob(rider, jobId)).toBe(true)
    expect((await riders.getJob(rider, jobId))!.status).toBe('open')
    ok(await riders.acceptJob(rider, jobId))
    expect(await riders.pickUp(rider2, jobId)).toBe(false)
    expect(await riders.pickUp(rider, jobId)).toBe(true)
    const o = await order(orderId)
    expect(o.status).toBe('shipped')
    expect(await orders.sellerHandover(sel, orderId, o.handoverCode!)).toEqual({ ok: false, error: 'state' })
    expect(await riders.deliver(rider, jobId, '000000')).toEqual({ ok: false, error: 'code' })
    ok(await riders.deliver(rider, jobId, o.handoverCode!))
    expect((await order(orderId)).status).toBe('delivered')
    expect((await riders.getJob(rider, jobId))!.status).toBe('delivered')
    expect((await riders.riderStats(rider))!).toMatchObject({ done: 1, held: 2_500, paid: 0 })
  })

  it('money is released after the return period, then paid out to the seller and the rider', async () => {
    await payouts.releaseDueOrders()
    expect((await order(orderId)).escrow).toBe('held')
    await db.update(schema.marketOrders).set({ deliveredAt: sql`now() - interval '3 days'` }).where(eq(schema.marketOrders.id, orderId))
    expect(await payouts.releaseDueOrders()).toBeGreaterThanOrEqual(1)
    const o = await order(orderId)
    expect(o).toMatchObject({ status: 'completed', escrow: 'released' })
    expect(await payouts.createPayouts()).toBeGreaterThanOrEqual(2)
    await payouts.sendPayouts()
    const mine = await payouts.myPayouts(sel.id)
    expect(mine[0]).toMatchObject({ kind: 'seller', status: 'paid', amountPesewas: o.sellerNetPesewas })
    expect(mine[0].number).toMatch(/^•+9999$/)
    const rp = await payouts.myPayouts(rider.id)
    expect(rp[0]).toMatchObject({ kind: 'rider', status: 'paid', amountPesewas: 2_500 })
    expect((await riders.riderStats(rider))!).toMatchObject({ held: 0, paid: 2_500 })
    // Nothing is paid twice
    expect(await payouts.createPayouts()).toBe(0)
  })

  it('the seller can call the rider off before pick-up (their share comes back)', async () => {
    const id = await buy()
    const before = await order(id)
    ok(await riders.requestRider(sel, id, 15))
    expect(await riders.cancelRider(sel, id)).toBe(true)
    const after = await order(id)
    expect(after).toMatchObject({ riderFeePesewas: 0, sellerNetPesewas: before.sellerNetPesewas })
    expect((await orders.getOrder(sel, id))!.can.ship).toBe(true)
    // A cancelled order calls off its delivery too
    const j = ok(await riders.requestRider(sel, id, 15)).id
    ok(await riders.acceptJob(rider, j))
    expect(await orders.adminCancel(admin, id, 'test')).toBe(true)
    expect((await riders.getJob(rider, j))!.status).toBe('cancelled')
  })
})

describe('disputes and payout problems', () => {
  it('a declined return can go to a Tech Admin, who can order a refund; the money is not released meanwhile', async () => {
    const id = await buy('pickup')
    ok(await orders.sellerStep(sel, id, 'ship'))
    ok(await orders.sellerHandover(sel, id, (await order(id)).handoverCode!))
    ok(await orders.requestReturn(buyer, id, 'return', 'damaged', 'Crushed'))
    const [rq] = await db.select().from(schema.marketRequests).where(eq(schema.marketRequests.orderId, id))
    expect(await orders.escalateRequest(buyer, id, 'Help')).toEqual({ ok: false, error: 'state' })
    ok(await orders.answerRequest(sel, rq.id, false, 'Was fine when it left'))
    ok(await orders.escalateRequest(buyer, id, 'Box was crushed, photos sent'))
    expect((await db.select().from(schema.marketRequests).where(eq(schema.marketRequests.id, rq.id)))[0].status).toBe('escalated')
    expect(await orders.answerRequest(sel, rq.id, true, 'ok')).toEqual({ ok: false, error: 'state' })
    await db.update(schema.marketOrders).set({ deliveredAt: sql`now() - interval '10 days'` }).where(eq(schema.marketOrders.id, id))
    await payouts.releaseDueOrders()
    expect((await order(id)).escrow).toBe('held')
    ok(await orders.answerRequest(admin, rq.id, true, 'Refund half', 5_000))
    expect((await order(id)).refundedPesewas).toBe(5_000)
    expect((await orders.getOrder(buyer, id))!.events.map((e) => e.kind)).toContain('dispute_buyer')
  })

  it('a bank payout is marked manual and a Tech Admin records it; account deletion waits for open Market business', async () => {
    await db.update(schema.shops).set({ payoutMethod: 'bank', payoutProvider: 'GCB', payoutNumber: '1234567890' }).where(eq(schema.shops.id, shopId))
    const id = await buy('pickup')
    ok(await orders.sellerStep(sel, id, 'ship'))
    ok(await orders.sellerHandover(sel, id, (await order(id)).handoverCode!))
    expect(await payouts.marketBlockers(sel.id)).not.toBeNull()
    await db.update(schema.marketOrders).set({ deliveredAt: sql`now() - interval '3 days'` }).where(eq(schema.marketOrders.id, id))
    await payouts.settleMarket()
    const p = (await payouts.adminPayouts('manual')).find((x) => x.payee === 'ZZ Rider Shop')!
    expect(p).toBeTruthy()
    expect(await payouts.markPaid(sel, p.id, 'x')).toBe(false)
    expect(await payouts.markPaid(admin, p.id, 'GCB-REF-1')).toBe(true)
    expect((await payouts.myPayouts(sel.id)).find((x) => x.id === p.id)!.status).toBe('paid')
    expect(await payouts.marketBlockers(rider2.id)).toBeNull()
  })

  it('a webhook result updates a payout', async () => {
    const [p] = await db.insert(schema.payouts).values({ reference: 'PAPA-PO-ZZTEST1', kind: 'rider', userId: rider.id, amountPesewas: 100, method: 'momo', status: 'processing' }).returning()
    expect(await payouts.payoutResult('PAPA-PO-ZZTEST1-2', 'failed', 'transfer.failed')).toBe(true)
    expect((await db.select().from(schema.payouts).where(eq(schema.payouts.id, p.id)))[0].status).toBe('failed')
  })
})
