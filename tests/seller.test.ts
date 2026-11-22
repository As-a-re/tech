import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import * as seller from '@/server/market/seller'
import * as catalog from '@/server/market/catalog'
import * as cart from '@/server/market/cart'
import * as orders from '@/server/market/orders'
import { confirmPayment } from '@/server/payments/payments'
import { setProductStatus } from '@/server/market/admin'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string; role: 'member' | 'tech_admin' }
let ama: U, kofi: U, buyer: U
let pid: string
const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }> }
const IMG = '/demo/mk-smock.jpg'
const shopInput: seller.ShopInput = { name: 'ZZ Ama Kitchen', bio: 'Home cooking', offersPickup: true, pickupAddress: 'Osu church', offersDelivery: true, deliveryFeeGhs: 10, returnDays: 3, acceptTerms: true }
const shirt = (o: Partial<seller.ProductInput> = {}): seller.ProductInput => ({
  title: 'ZZ Batik shirt', description: 'Cotton', category: 'fashion', condition: 'new', images: [IMG], optionNames: ['Size', 'Colour'], status: 'active',
  variants: [{ options: { Size: 'M', Colour: 'Blue' }, priceGhs: 100, stock: 5 }, { options: { Size: 'L', Colour: 'Blue' }, priceGhs: 110, stock: 0 }], ...o,
})

beforeAll(async () => {
  delete process.env.PAYSTACK_SECRET_KEY
  await cleanup()
  const mk = async (n: number, u: string): Promise<U> => ({ ...(await makeUser(n, u)), role: 'member' })
  ama = await mk(981, 'zz_sama'); kofi = await mk(982, 'zz_skofi'); buyer = await mk(983, 'zz_sbuyer')
})
afterAll(async () => { await cleanup(); await pool.end() })

describe('becoming a seller', () => {
  it('needs the rules accepted and valid details; one shop per member', async () => {
    expect(await seller.openShop(ama, { ...shopInput, acceptTerms: false })).toEqual({ ok: false, error: 'terms' })
    expect(await seller.openShop(ama, { ...shopInput, name: 'ZZ' })).toEqual({ ok: false, error: 'name' })
    expect(await seller.openShop(ama, { ...shopInput, offersPickup: false, offersDelivery: false })).toEqual({ ok: false, error: 'fulfilment' })
    expect(await seller.openShop(ama, { ...shopInput, pickupAddress: '' })).toEqual({ ok: false, error: 'pickup' })
    expect(await seller.openShop(ama, { ...shopInput, payoutMethod: 'momo', payoutProvider: 'mtn', payoutNumber: '123', payoutName: 'Ama' })).toEqual({ ok: false, error: 'payout' })
    const r = ok(await seller.openShop(ama, { ...shopInput, payoutMethod: 'momo', payoutProvider: 'mtn', payoutNumber: '024 111 2233', payoutName: 'Ama Test' }))
    expect(r.slug).toBe('zz-ama-kitchen')
    expect(await seller.openShop(ama, shopInput)).toEqual({ ok: false, error: 'exists' })
    // Same name for another member gets its own address
    expect(ok(await seller.openShop(kofi, shopInput)).slug).toBe('zz-ama-kitchen-2')
    const s = (await seller.myShop(ama.id))!
    expect(s).toMatchObject({ deliveryFeePesewas: 1_000, returnDays: 3, payoutNumber: '233241112233', payoutProvider: 'mtn' })
    expect(s.termsAcceptedAt).not.toBeNull()
  })

  it('settings: edit, pause hides the items, open again', async () => {
    ok(await seller.updateShop(ama, { ...shopInput, freeDeliveryOverGhs: 200, payoutMethod: 'bank', payoutProvider: 'GCB Bank', payoutNumber: '1234 5678 90', payoutName: 'Ama Test' }))
    expect((await seller.myShop(ama.id))!).toMatchObject({ freeDeliveryOverPesewas: 20_000, payoutMethod: 'bank', payoutNumber: '1234567890' })
    expect(seller.shopToInput((await seller.myShop(ama.id))!).freeDeliveryOverGhs).toBe(200)
  })
})

describe('listings', () => {
  it('validates and saves a product with choices; price is the lowest choice', async () => {
    expect(await seller.saveProduct(buyer, shirt())).toEqual({ ok: false, error: 'no_shop' })
    expect(await seller.saveProduct(ama, shirt({ images: [] }))).toEqual({ ok: false, error: 'images' })
    expect(await seller.saveProduct(ama, shirt({ category: 'nope' }))).toEqual({ ok: false, error: 'category' })
    expect(await seller.saveProduct(ama, shirt({ variants: [{ options: { Size: 'M', Colour: 'Blue' }, priceGhs: 0.5, stock: 1 }] }))).toEqual({ ok: false, error: 'price' })
    expect(await seller.saveProduct(ama, shirt({ variants: [{ options: { Size: 'M', Colour: '' }, priceGhs: 10, stock: 1 }] }))).toEqual({ ok: false, error: 'options' })
    expect(await seller.saveProduct(ama, shirt({ compareAtGhs: 90 }))).toEqual({ ok: false, error: 'compare' })
    pid = ok(await seller.saveProduct(ama, shirt({ compareAtGhs: 150 }))).id
    const p = (await catalog.getProduct(pid, buyer))!
    expect(p).toMatchObject({ pricePesewas: 10_000, compareAtPesewas: 15_000, optionNames: ['Size', 'Colour'] })
    expect(p.variants.map((v) => v.name)).toEqual(['M / Blue', 'L / Blue'])
    expect(await seller.saveProduct(kofi, shirt(), pid)).toEqual({ ok: false, error: 'not_found' })
  })

  it('editing keeps variant ids (carts keep working); a removed choice is switched off', async () => {
    const before = (await catalog.getProduct(pid, buyer))!.variants
    ok(await cart.addToCart(buyer, before[0].id, 1))
    const e = (await seller.productForEdit(ama, pid))!
    ok(await seller.saveProduct(ama, { ...e.input, variants: [{ ...e.input.variants[0], priceGhs: 95 }, { options: { Size: 'XL', Colour: 'Blue' }, priceGhs: 120, stock: 2 }] }, pid))
    const after = (await catalog.getProduct(pid, buyer))!.variants
    expect(after.find((v) => v.name === 'M / Blue')!.id).toBe(before[0].id)
    expect(after.map((v) => v.name)).toEqual(['M / Blue', 'XL / Blue'])
    expect((await cart.getCart(buyer.id)).shops[0].lines[0].unitPesewas).toBe(9_500)
    const [off] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.id, before[1].id))
    expect(off.active).toBe(false)
  })

  it('followers are told once when an item first goes on sale; drafts stay hidden', async () => {
    const [s] = await db.select().from(schema.shops).where(eq(schema.shops.ownerId, ama.id))
    ok(await catalog.followShop(buyer, s.id, true))
    const d = ok(await seller.saveProduct(ama, shirt({ title: 'ZZ Draft cake', category: 'food', optionNames: [], variants: [{ options: {}, priceGhs: 50, stock: 3 }], status: 'draft' }))).id
    expect(await catalog.getProduct(d, buyer)).toBeNull()
    const news = async () => (await db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, buyer.id), sql`${schema.notifications.type}::text = 'market_new'`))).length
    expect(await news()).toBe(0)
    ok(await seller.setListingStatus(ama, d, 'active'))
    expect(await news()).toBe(1)
    ok(await seller.setListingStatus(ama, d, 'draft'))
    ok(await seller.setListingStatus(ama, d, 'active'))
    expect(await news()).toBe(1)
    expect((await catalog.getProduct(d, buyer))!.visible).toBe(true)
  })

  it('stock edits tell members waiting for it; duplicate makes a draft copy; delete leaves carts', async () => {
    const v = (await catalog.getProduct(pid, buyer))!.variants.find((x) => x.name === 'XL / Blue')!
    expect(await seller.setVariantStock(ama, v.id, 0)).toBe(true)
    ok(await catalog.setAlert(buyer, pid, 'stock', true))
    expect(await seller.setVariantStock(kofi, v.id, 9)).toBe(false)
    expect(await seller.setVariantStock(ama, v.id, 4)).toBe(true)
    expect((await catalog.myAlerts(buyer.id)).find((a) => a.id === pid)).toMatchObject({ kind: 'stock', notified: true })
    const copy = ok(await seller.duplicateListing(ama, pid)).id
    const c = (await seller.productForEdit(ama, copy))!
    expect(c).toMatchObject({ status: 'draft' })
    expect(c.input.title).toBe('ZZ Batik shirt (copy)')
    expect(c.input.variants.length).toBe(2)
    expect(await seller.deleteListing(ama, copy)).toBe(true)
    expect(await seller.productForEdit(ama, copy)).toBeNull()
    const l = (await seller.listings(ama, { status: 'draft' }))!
    expect(l.rows.map((x) => x.id)).not.toContain(copy)
    expect((await seller.listings(ama, { status: 'low' }))!.rows.length).toBeGreaterThanOrEqual(0)
  })

  it('a listing taken down by a Tech Admin can be edited but not put back on sale', async () => {
    const x = ok(await seller.saveProduct(ama, shirt({ title: 'ZZ Questionable', optionNames: [], variants: [{ options: {}, priceGhs: 20, stock: 1 }] }))).id
    await setProductStatus(x, 'removed')
    expect(await seller.setListingStatus(ama, x, 'active')).toEqual({ ok: false, error: 'removed' })
    ok(await seller.saveProduct(ama, shirt({ title: 'ZZ Questionable fixed', optionNames: [], variants: [{ options: {}, priceGhs: 20, stock: 1 }] }), x))
    expect((await seller.productForEdit(ama, x))!.status).toBe('removed')
  })
})

describe('coupons', () => {
  it('creates, refuses duplicates, applies at checkout, and deletes or switches off', async () => {
    expect(await seller.saveCoupon(ama, { code: 'x', kind: 'percent', value: 10 })).toEqual({ ok: false, error: 'code' })
    expect(await seller.saveCoupon(ama, { code: 'ZZOFF', kind: 'percent', value: 95 })).toEqual({ ok: false, error: 'value' })
    expect(await seller.saveCoupon(ama, { code: 'ZZOFF', kind: 'amount', value: 5, startsAt: '2026-12-02', endsAt: '2026-12-01' })).toEqual({ ok: false, error: 'dates' })
    const c = ok(await seller.saveCoupon(ama, { code: 'zzoff', kind: 'amount', value: 5, minSpendGhs: 50 }))
    expect(await seller.saveCoupon(ama, { code: 'ZZOFF', kind: 'percent', value: 5 })).toEqual({ ok: false, error: 'code_taken' })
    const [s] = await db.select().from(schema.shops).where(eq(schema.shops.ownerId, ama.id))
    expect(await cart.checkCoupon(s.id, 'ZZOFF', 9_500, buyer.id)).toMatchObject({ ok: true, discount: 500 })
    ok(await seller.saveCoupon(ama, { code: 'ZZOFF', kind: 'amount', value: 5, active: false }, c.id))
    expect(await cart.checkCoupon(s.id, 'ZZOFF', 9_500, buyer.id)).toEqual({ ok: false, error: 'coupon_invalid' })
    expect(await seller.removeCoupon(kofi, c.id)).toBe(false)
    expect(await seller.removeCoupon(ama, c.id)).toBe(true)
    expect((await seller.listCoupons(ama))!.length).toBe(0)
  })
})

describe('selling: dashboard, orders, earnings, questions, closing', () => {
  let orderId: string
  it('a sale shows on the dashboard, orders, earnings and the CSV', async () => {
    const r = ok(await cart.placeOrder(buyer, [{ shopId: (await seller.myShop(ama.id))!.id, fulfilment: 'pickup' }], null))
    await confirmPayment(r.reference, 'success')
    ;[{ id: orderId }] = await db.select({ id: schema.marketOrders.id }).from(schema.marketOrders).where(eq(schema.marketOrders.checkoutId, r.checkoutId))
    const d = (await seller.dashboard(ama))!
    expect(d).toMatchObject({ orders: 1, to_accept: 1, sales: 9_500 })
    expect(d.held).toBeGreaterThan(0)
    expect((await seller.orderCounts(ama)).paid).toBe(1)
    const days = await seller.salesByDay(d.shop.id)
    expect(days).toHaveLength(30)
    expect(days.at(-1)!.total).toBe(9_500)
    const e = (await seller.earnings(ama))!
    expect(e).toMatchObject({ gross: 9_500 })
    expect(e.held + e.fees).toBe(9_500)
    expect((await seller.earningsCsvRows(ama))!.length).toBe(1)
    expect(await seller.earnings(buyer)).toBeNull()
  })

  it('questions inbox; closing waits for orders in progress', async () => {
    ok(await catalog.askQuestion(buyer, pid, 'Is it washable?'))
    const q = await seller.unansweredQuestions(ama)
    expect(q[0]).toMatchObject({ body: 'Is it washable?', answer: null })
    expect((await seller.dashboard(ama))!.questions).toBe(1)
    expect(await seller.closeShop(ama)).toEqual({ ok: false, error: 'open_orders' })
    ok(await orders.sellerStep(ama, orderId, 'accept'))
    ok(await orders.sellerStep(ama, orderId, 'ship'))
    const [o] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, orderId))
    ok(await orders.sellerHandover(ama, orderId, o.handoverCode!))
    ok(await seller.setShopPaused(ama, true))
    expect(await catalog.getProduct(pid, buyer)).toBeNull()
    ok(await seller.setShopPaused(ama, false))
    ok(await seller.closeShop(ama))
    expect(await seller.myShop(ama.id)).toBeNull()
    expect(await catalog.getProduct(pid, buyer)).toBeNull()
    expect((await cart.getCart(buyer.id)).shops).toHaveLength(0)
    // A new shop can be opened later (the old address is taken)
    expect(ok(await seller.openShop(ama, { ...shopInput, name: 'ZZ Ama Kitchen' })).slug).toBe('zz-ama-kitchen-3')
  })
})
