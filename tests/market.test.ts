import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import * as catalog from '@/server/market/catalog'
import * as cart from '@/server/market/cart'
import * as orders from '@/server/market/orders'
import * as madmin from '@/server/market/admin'
import { confirmPayment, givingReport, myGiving, settleStalePayments } from '@/server/payments/payments'
import { fileReport, resolveReports } from '@/server/moderation/reports'
import { setSetting } from '@/server/admin/platform-settings'
import { exportData } from '@/server/account/account'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string; role: 'member' | 'tech_admin' }
let seller: U, seller2: U, buyer: U, buyer2: U, admin: U
let shopA: string, shopB: string
let shirt: string, shirtM: string, shirtL: string, cake: string, cakeV: string, phone: string, phoneV: string, draft: string, gone: string, goneV: string
const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }> }
const stock = async (variantId: string) => (await db.select({ s: schema.productVariants.stock }).from(schema.productVariants).where(eq(schema.productVariants.id, variantId)))[0].s
const addr = { name: 'Ama Test', phone: '024 555 1234', town: 'Osu', address: 'House 12, Oxford Street', landmark: 'Near the church' }
const notes = async (userId: string, type: string) => db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, userId), sql`${schema.notifications.type}::text = ${type}`))
const payFor = async (checkoutId: string) => (await db.select().from(schema.payments).where(eq(schema.payments.marketCheckoutId, checkoutId)))[0]
const ordersOf = (checkoutId: string) => db.select().from(schema.marketOrders).where(eq(schema.marketOrders.checkoutId, checkoutId)).orderBy(schema.marketOrders.shopName)

async function product(shopId: string, title: string, o: { category?: string; price: number; was?: number; condition?: 'new' | 'used'; status?: 'active' | 'draft'; variants?: [string, Record<string, string>, number, number][]; stock?: number }) {
  const [p] = await db.insert(schema.products).values({ shopId, title, category: o.category ?? 'fashion', condition: o.condition ?? 'new', pricePesewas: o.price, compareAtPesewas: o.was ?? null,
    status: o.status ?? 'active', optionNames: o.variants ? ['Size'] : [], images: ['/demo/res-men-shirt.jpg'], description: `ZZ ${title}` }).returning()
  const vs = o.variants ?? [['', {}, o.price, o.stock ?? 10]]
  const ids: string[] = []
  for (const [i, [name, options, price, st]] of vs.entries()) {
    const [v] = await db.insert(schema.productVariants).values({ productId: p.id, name, options, pricePesewas: price, stock: st, position: i }).returning()
    ids.push(v.id)
  }
  return { id: p.id, variants: ids }
}

beforeAll(async () => {
  delete process.env.PAYSTACK_SECRET_KEY
  await cleanup()
  const mk = async (n: number, u: string, role: U['role'] = 'member') => ({ ...(await makeUser(n, u)), role })
  seller = await mk(971, 'zz_mseller'); seller2 = await mk(972, 'zz_mseller2'); buyer = await mk(973, 'zz_mbuyer'); buyer2 = await mk(974, 'zz_mbuyer2'); admin = await mk(975, 'zz_madmin', 'tech_admin')
  await db.update(schema.users).set({ role: 'tech_admin' }).where(eq(schema.users.id, admin.id))
  await setSetting('marketFeePercent', 5)
  const [a] = await db.select({ a: schema.users.assemblyId }).from(schema.users).where(eq(schema.users.id, seller.id))
  ;[{ id: shopA }] = await db.insert(schema.shops).values({ ownerId: seller.id, slug: 'zz-shop-a', name: 'ZZ Tailors', assemblyId: a.a, town: 'Osu', deliveryFeePesewas: 1_500,
    freeDeliveryOverPesewas: 50_000, pickupAddress: 'Osu shop', returnDays: 7 }).returning()
  ;[{ id: shopB }] = await db.insert(schema.shops).values({ ownerId: seller2.id, slug: 'zz-shop-b', name: 'ZZ Bakes', offersDelivery: false, pickupAddress: 'Kasoa bakery' }).returning()
  const s = await product(shopA, 'ZZ Kente Shirt', { price: 12_000, was: 15_000, variants: [['M', { Size: 'M' }, 12_000, 3], ['L', { Size: 'L' }, 13_000, 0]] })
  shirt = s.id; [shirtM, shirtL] = s.variants
  const c = await product(shopB, 'ZZ Chin Chin', { category: 'food', price: 2_000, stock: 50 })
  cake = c.id; cakeV = c.variants[0]
  const ph = await product(shopA, 'ZZ Used Phone', { category: 'phones', price: 80_000, condition: 'used', stock: 1 })
  phone = ph.id; phoneV = ph.variants[0]
  draft = (await product(shopA, 'ZZ Secret Draft', { price: 5_000, status: 'draft' })).id
  const g = await product(shopA, 'ZZ Sold Out Bag', { category: 'shoes', price: 9_000, stock: 0 })
  gone = g.id; goneV = g.variants[0]
  await db.insert(schema.coupons).values([{ shopId: shopA, code: 'ZZTEN', kind: 'percent', value: 10, minSpendPesewas: 10_000 }, { shopId: shopB, code: 'ZZFIVE', kind: 'amount', value: 500, maxUses: 1 }])
})
afterAll(async () => { await setSetting('marketFeePercent', 2.5); await cleanup(); await pool.end() })

describe('browsing', () => {
  it('lists only products members may see, with filters and sorting', async () => {
    const all = (await catalog.listProducts({ q: 'zz', limit: 60 })).items.map((x) => x.title)
    expect(all).toEqual(expect.arrayContaining(['ZZ Kente Shirt', 'ZZ Chin Chin', 'ZZ Used Phone', 'ZZ Sold Out Bag']))
    expect(all).not.toContain('ZZ Secret Draft')
    expect((await catalog.listProducts({ q: 'zz', category: 'food' })).items.map((x) => x.title)).toEqual(['ZZ Chin Chin'])
    expect((await catalog.listProducts({ q: 'zz', deals: true })).items.map((x) => x.title)).toEqual(['ZZ Kente Shirt'])
    expect((await catalog.listProducts({ q: 'zz', condition: 'used' })).items.map((x) => x.title)).toEqual(['ZZ Used Phone'])
    expect((await catalog.listProducts({ q: 'zz', inStock: true })).items.map((x) => x.title)).not.toContain('ZZ Sold Out Bag')
    expect((await catalog.listProducts({ q: 'zz', minPesewas: 10_000, maxPesewas: 20_000 })).items.map((x) => x.title)).toEqual(['ZZ Kente Shirt'])
    const cheap = (await catalog.listProducts({ q: 'zz', sort: 'price_asc' })).items
    expect(cheap[0].title).toBe('ZZ Chin Chin')
    expect(cheap.find((x) => x.title === 'ZZ Kente Shirt')!.compareAtPesewas).toBe(15_000)
    expect((await catalog.suggestProducts('kente shirt')).map((x) => x.id)).toContain(shirt)
    // Best match with no words (filters only) still sorts
    expect((await catalog.listProducts({ deals: true, sort: 'best', shopId: shopA })).items.map((x) => x.id)).toEqual([shirt])
  })

  it('a draft is seen only by its seller and Tech Admins; a suspended shop disappears', async () => {
    expect(await catalog.getProduct(draft, buyer)).toBeNull()
    expect((await catalog.getProduct(draft, seller))!.visible).toBe(false)
    expect((await catalog.getProduct(draft, admin))!.status).toBe('draft')
    ok(await madmin.setShopStatus(shopB, 'suspended') ? { ok: true } : { ok: false })
    expect(await catalog.getProduct(cake, buyer)).toBeNull()
    expect((await catalog.listProducts({ q: 'zz chin' })).items).toHaveLength(0)
    await madmin.setShopStatus(shopB, 'active')
    const p = (await catalog.getProduct(shirt, buyer))!
    expect(p.variants.map((v) => v.name)).toEqual(['M', 'L'])
    expect(p.shop.slug).toBe('zz-shop-a')
  })

  it('records views and recently viewed (not the seller’s own)', async () => {
    await catalog.recordView(shirt, buyer, seller.id)
    await catalog.recordView(shirt, seller, seller.id)
    expect((await catalog.recentlyViewedCards(buyer.id)).map((x) => x.id)).toEqual([shirt])
    expect((await catalog.recentlyViewedCards(seller.id))).toHaveLength(0)
    const home = await catalog.marketHome({ id: buyer.id, districtId: null })
    expect(home.recent.map((x) => x.id)).toContain(shirt)
  })

  it('wishlist, follow a shop, and the shop page', async () => {
    ok(await catalog.setWishlist(buyer, shirt, true))
    expect((await catalog.wishlist(buyer.id)).map((x) => x.id)).toEqual([shirt])
    expect(await catalog.followShop(seller, shopA, true)).toEqual({ ok: false, error: 'own_shop' })
    ok(await catalog.followShop(buyer, shopA, true))
    const s = (await catalog.getShop('zz-shop-a', buyer))!
    expect(s.following).toBe(true)
    expect(s.followers).toBe(1)
    expect((await catalog.followedShops(buyer.id)).map((x) => x.slug)).toEqual(['zz-shop-a'])
  })
})

describe('questions and alerts', () => {
  it('members ask, the seller answers, both are told', async () => {
    expect(await catalog.askQuestion(seller, shirt, 'Is this mine?')).toEqual({ ok: false, error: 'own_shop' })
    expect(await catalog.askQuestion(buyer, shirt, 'hi')).toEqual({ ok: false, error: 'question' })
    const q = ok(await catalog.askQuestion(buyer, shirt, 'Does it come in XL?'))
    expect((await notes(seller.id, 'market_question')).length).toBe(1)
    expect(await catalog.answerQuestion(buyer2, q.id, 'yes')).toEqual({ ok: false, error: 'not_found' })
    ok(await catalog.answerQuestion(seller, q.id, 'Not yet, next week!'))
    expect((await notes(buyer.id, 'market_question')).length).toBe(1)
    expect((await catalog.listQuestions(shirt, buyer.id))[0]).toMatchObject({ answer: 'Not yet, next week!', mine: true })
  })

  it('back-in-stock and price-drop alerts fire once', async () => {
    ok(await catalog.setAlert(buyer, gone, 'stock', true))
    ok(await catalog.setAlert(buyer2, shirt, 'price', true))
    expect(await catalog.fireStockAlerts(gone)).toBe(0)
    await db.update(schema.productVariants).set({ stock: 4 }).where(eq(schema.productVariants.id, goneV))
    expect(await catalog.fireStockAlerts(gone)).toBe(1)
    expect(await catalog.fireStockAlerts(gone)).toBe(0)
    expect((await notes(buyer.id, 'market_alert')).some((n) => n.productId === gone)).toBe(true)
    expect(await catalog.firePriceAlerts(shirt)).toBe(0)
    await db.update(schema.products).set({ pricePesewas: 11_000 }).where(eq(schema.products.id, shirt))
    expect(await catalog.firePriceAlerts(shirt)).toBe(1)
    await db.update(schema.products).set({ pricePesewas: 12_000 }).where(eq(schema.products.id, shirt))
    expect((await catalog.myAlerts(buyer2.id))[0]).toMatchObject({ kind: 'price', notified: true })
  })
})

describe('cart', () => {
  it('adds within stock, never from your own shop, and counts what will be checked out', async () => {
    expect(await cart.addToCart(seller, shirtM, 1)).toEqual({ ok: false, error: 'own_shop' })
    expect(await cart.addToCart(buyer, shirtL, 1)).toEqual({ ok: false, error: 'stock' })
    expect(await cart.addToCart(buyer, shirtM, 0)).toEqual({ ok: false, error: 'qty' })
    expect(ok(await cart.addToCart(buyer, shirtM, 5)).count).toBe(3) // capped at stock
    expect(ok(await cart.addToCart(buyer, cakeV, 2)).count).toBe(5)
    const c = await cart.getCart(buyer.id)
    expect(c.shops.map((s) => s.name).sort()).toEqual(['ZZ Bakes', 'ZZ Tailors'])
    expect(c.subtotalPesewas).toBe(3 * 12_000 + 2 * 2_000)
    const line = c.shops.find((s) => s.name === 'ZZ Tailors')!.lines[0]
    ok(await cart.setCartQty(buyer, line.id, 2))
    // Saved for later: kept, but not counted or checked out
    const ph = ok(await cart.addToCart(buyer, phoneV, 1))
    expect(ph.count).toBe(5)
    const phLine = (await cart.getCart(buyer.id)).shops.find((s) => s.name === 'ZZ Tailors')!.lines.find((l) => l.variantId === phoneV)!
    expect(ok(await cart.saveForLater(buyer, phLine.id, true)).count).toBe(4)
    expect((await cart.getCart(buyer.id)).saved).toHaveLength(1)
  })

  it('coupons: unknown, minimum spend, percent and amount', async () => {
    expect(await cart.checkCoupon(shopA, 'NOPE', 50_000, buyer.id)).toEqual({ ok: false, error: 'coupon_invalid' })
    expect(await cart.checkCoupon(shopA, 'zzten', 5_000, buyer.id)).toEqual({ ok: false, error: 'coupon_min' })
    expect(await cart.checkCoupon(shopA, 'zzten', 24_000, buyer.id)).toMatchObject({ ok: true, discount: 2_400 })
    expect(await cart.checkCoupon(shopB, 'ZZFIVE', 4_000, buyer.id)).toMatchObject({ ok: true, discount: 500 })
    expect(await cart.checkCoupon(shopA, 'ZZFIVE', 4_000, buyer.id)).toEqual({ ok: false, error: 'coupon_invalid' })
  })

  it('quotes delivery fees, free delivery over the threshold and pickup', async () => {
    const q = await cart.quoteCheckout(buyer, [{ shopId: shopA, fulfilment: 'delivery', coupon: 'ZZTEN' }, { shopId: shopB, fulfilment: 'delivery' }])
    const a = q.groups.find((g) => g.shopId === shopA)!, b = q.groups.find((g) => g.shopId === shopB)!
    expect(a).toMatchObject({ fulfilment: 'delivery', subtotalPesewas: 24_000, deliveryFeePesewas: 1_500, discountPesewas: 2_400, totalPesewas: 23_100 })
    expect(b).toMatchObject({ fulfilment: 'pickup', deliveryFeePesewas: 0, totalPesewas: 4_000 }) // shop B only does pickup
    const pick = await cart.quoteCheckout(buyer, [{ shopId: shopA, fulfilment: 'pickup' }])
    expect(pick.groups.find((g) => g.shopId === shopA)!.deliveryFeePesewas).toBe(0)
  })
})

describe('checkout, payment and escrow', () => {
  let first: string
  it('needs a delivery address with a Ghana mobile number', async () => {
    expect(await cart.placeOrder(buyer, [{ shopId: shopA, fulfilment: 'delivery' }], null)).toMatchObject({ ok: false, error: 'address' })
    expect(await cart.placeOrder(buyer, [{ shopId: shopA, fulfilment: 'delivery' }], { ...addr, phone: '12345' })).toMatchObject({ ok: false, error: 'phone' })
  })

  it('one payment, one order per shop; stock and coupons are held; a failed payment gives them back', async () => {
    const r = ok(await cart.placeOrder(buyer, [{ shopId: shopA, fulfilment: 'delivery', coupon: 'ZZTEN' }, { shopId: shopB, fulfilment: 'pickup', coupon: 'ZZFIVE' }], addr))
    first = r.checkoutId
    const os = await ordersOf(r.checkoutId)
    expect(os.map((o) => o.shopName)).toEqual(['ZZ Bakes', 'ZZ Tailors'])
    const a = os.find((o) => o.shopId === shopA)!
    expect(a).toMatchObject({ status: 'pending_payment', fulfilment: 'delivery', subtotalPesewas: 24_000, deliveryFeePesewas: 1_500, discountPesewas: 2_400, totalPesewas: 23_100, feeBps: 500,
      feePesewas: 1_080, sellerNetPesewas: 22_020, town: 'Osu', phone: '233245551234' })
    const p = await payFor(r.checkoutId)
    expect(p).toMatchObject({ purpose: 'order', amountPesewas: 23_100 + 3_500, status: 'pending', level: 'national' })
    expect(await stock(shirtM)).toBe(1)
    expect((await db.select().from(schema.coupons).where(eq(schema.coupons.code, 'ZZFIVE')))[0].usedCount).toBe(1)
    // Someone else can't take the last of the held stock
    expect(await cart.addToCart(buyer2, shirtM, 2)).toMatchObject({ ok: true, count: 1 })
    await confirmPayment(r.reference, 'failed')
    expect((await ordersOf(r.checkoutId)).every((o) => o.status === 'cancelled')).toBe(true)
    expect(await stock(shirtM)).toBe(3)
    expect((await db.select().from(schema.coupons).where(eq(schema.coupons.code, 'ZZFIVE')))[0].usedCount).toBe(0)
    expect((await cart.getCart(buyer.id)).count).toBe(4) // cart kept for another try
  })

  let orderA: string, orderB: string
  it('paid: money held, codes made, sellers and buyer told, bought items leave the cart', async () => {
    const r = ok(await cart.placeOrder(buyer, [{ shopId: shopA, fulfilment: 'delivery', coupon: 'ZZTEN' }, { shopId: shopB, fulfilment: 'pickup' }], addr))
    expect(first).not.toBe(r.checkoutId)
    await confirmPayment(r.reference, 'success')
    const os = await ordersOf(r.checkoutId)
    orderA = os.find((o) => o.shopId === shopA)!.id; orderB = os.find((o) => o.shopId === shopB)!.id
    for (const o of os) {
      expect(o).toMatchObject({ status: 'paid', escrow: 'held' })
      expect(o.handoverCode).toMatch(/^\d{6}$/)
    }
    expect((await notes(seller.id, 'market_sale')).some((n) => n.marketOrderId === orderA)).toBe(true)
    expect((await notes(seller2.id, 'market_sale')).some((n) => n.marketOrderId === orderB)).toBe(true)
    expect((await notes(buyer.id, 'market_order')).length).toBe(2)
    expect((await notes(buyer.id, 'payment')).length).toBe(0) // no "thank you for your gift"
    const c = await cart.getCart(buyer.id)
    expect(c.count).toBe(0)
    expect(c.saved).toHaveLength(1)
    expect((await db.select().from(schema.products).where(eq(schema.products.id, shirt)))[0].soldCount).toBe(2)
    // Market money isn't church giving
    const year = new Date().getUTCFullYear()
    expect((await myGiving(buyer.id, year)).items).toHaveLength(0)
    const report = await givingReport(admin, { from: new Date(Date.now() - 86_400_000), to: new Date(Date.now() + 86_400_000) })
    expect(report!.items.some((i) => i.userId === buyer.id)).toBe(false)
    const placed = (await cart.checkoutSummary(buyer.id, r.checkoutId))!
    expect(placed.orders).toHaveLength(2)
    expect(await cart.checkoutSummary(buyer2.id, r.checkoutId)).toBeNull()
  })

  it('who can see an order; the code is only shown to the buyer', async () => {
    expect(await orders.getOrder(buyer2, orderA)).toBeNull()
    expect(await orders.getOrder(seller2, orderA)).toBeNull()
    const s = (await orders.getOrder(seller, orderA))!
    expect(s.role).toBe('seller')
    expect(s.handoverCode).toBeNull()
    expect(s.can.accept).toBe(true)
    expect((await orders.getOrder(buyer, orderA))!.can.cancel).toBe(true)
    expect((await orders.getOrder(admin, orderA))!.role).toBe('admin')
    expect((await orders.myOrders(buyer.id, 'active')).map((o) => o.id)).toEqual(expect.arrayContaining([orderA, orderB]))
    expect((await orders.shopOrders(seller)).map((o) => o.id)).toEqual([orderA])
  })

  it('the buyer cancels before the seller accepts: full refund, stock back', async () => {
    const before = await stock(cakeV)
    ok(await orders.cancelOrder(buyer, orderB, 'changed_mind'))
    const [o] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, orderB))
    expect(o).toMatchObject({ status: 'cancelled', escrow: 'refunded', refundedPesewas: o.totalPesewas, cancelReason: 'changed_mind' })
    expect(await stock(cakeV)).toBe(before + 2)
    expect((await notes(seller2.id, 'market_sale')).length).toBeGreaterThan(0)
    // The other order is still paid, so the payment isn't fully refunded
    const [p] = await db.select().from(schema.payments).where(eq(schema.payments.marketCheckoutId, o.checkoutId!))
    expect(p.status).toBe('success')
  })

  it('seller: accept → pack → ship; hand-over needs the buyer’s code; then the buyer can review', async () => {
    expect(await orders.sellerStep(seller2, orderA, 'accept')).toEqual({ ok: false, error: 'not_found' })
    expect(await orders.sellerStep(seller, orderA, 'ship')).toEqual({ ok: false, error: 'state' })
    ok(await orders.sellerStep(seller, orderA, 'accept'))
    expect((await orders.getOrder(buyer, orderA))!.can.cancel).toBe(false)
    expect((await orders.getOrder(buyer, orderA))!.can.requestCancel).toBe(true)
    ok(await orders.sellerStep(seller, orderA, 'pack'))
    ok(await orders.sellerStep(seller, orderA, 'ship', 'Rider Kofi is bringing it'))
    expect(await orders.writeReview(buyer, orderA, shirt, 5, 'Great')).toEqual({ ok: false, error: 'state' })
    expect(await orders.sellerHandover(seller, orderA, '000000')).toEqual({ ok: false, error: 'code' })
    const [o] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, orderA))
    ok(await orders.sellerHandover(seller, orderA, o.handoverCode!))
    const d = (await orders.getOrder(buyer, orderA))!
    expect(d.status).toBe('delivered')
    expect(d.events.map((e) => e.kind)).toEqual(['placed', 'paid', 'accepted', 'packed', 'shipped', 'delivered'])
    expect(d.can.return).toBe(true)
    ok(await orders.writeReview(buyer, orderA, shirt, 4, 'Fits well'))
    ok(await orders.writeReview(buyer, orderA, shirt, 5, 'Fits well, lovely fabric'))
    const p = (await catalog.getProduct(shirt, buyer))!
    expect(p).toMatchObject({ rating: 5, ratingCount: 1 })
    expect((await notes(seller.id, 'market_review')).length).toBe(1)
    expect(await orders.writeReview(buyer, orderA, cake, 5, '')).toEqual({ ok: false, error: 'not_found' })
  })

  it('return request after delivery: the seller approves part of the money back', async () => {
    expect(await orders.requestReturn(buyer, orderA, 'return', 'bad')).toEqual({ ok: false, error: 'reason' })
    ok(await orders.requestReturn(buyer, orderA, 'return', 'damaged', 'Torn sleeve'))
    expect((await orders.getOrder(buyer, orderA))!.can.return).toBe(false) // one open request at a time
    const [rq] = await db.select().from(schema.marketRequests).where(eq(schema.marketRequests.orderId, orderA))
    expect(await orders.answerRequest(buyer2, rq.id, true, 'ok')).toEqual({ ok: false, error: 'not_found' })
    expect(await orders.answerRequest(seller, rq.id, true, 'Sorry!', 999_999)).toEqual({ ok: false, error: 'amount' })
    ok(await orders.answerRequest(seller, rq.id, true, 'Sorry! Refunding one shirt.', 12_000))
    const [o] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, orderA))
    expect(o).toMatchObject({ refundedPesewas: 12_000, escrow: 'held' })
    expect(o.sellerNetPesewas + o.feePesewas).toBe(o.totalPesewas - 12_000)
    expect((await madmin.adminRequests('approved')).some((r) => r.id === rq.id)).toBe(true)
  })
})

describe('more order paths', () => {
  const buy = async (variant: string, qty: number, f: 'delivery' | 'pickup' = 'delivery') => {
    await db.delete(schema.cartItems).where(eq(schema.cartItems.userId, buyer2.id))
    ok(await cart.addToCart(buyer2, variant, qty))
    const shopId = variant === cakeV ? shopB : shopA
    const r = ok(await cart.placeOrder(buyer2, [{ shopId, fulfilment: f }], addr))
    await confirmPayment(r.reference, 'success')
    return (await ordersOf(r.checkoutId))[0]
  }

  it('after accepting, cancelling is a request the seller answers', async () => {
    const o = await buy(cakeV, 1, 'pickup')
    ok(await orders.sellerStep(seller2, o.id, 'accept'))
    expect(ok(await orders.cancelOrder(buyer2, o.id, 'late')).requested).toBe(true)
    const [rq] = await db.select().from(schema.marketRequests).where(eq(schema.marketRequests.orderId, o.id))
    ok(await orders.answerRequest(seller2, rq.id, true, 'No problem'))
    const [x] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, o.id))
    expect(x).toMatchObject({ status: 'cancelled', escrow: 'refunded', refundedPesewas: x.totalPesewas })
    // Everything in that checkout refunded → the payment is marked refunded
    expect((await payFor(x.checkoutId!)).status).toBe('refunded')
  })

  it('buyer confirms delivery; seller cancels with a reason; admin refunds', async () => {
    const o = await buy(cakeV, 1, 'pickup')
    expect(await orders.sellerStep(seller2, o.id, 'ship')).toEqual({ ok: false, error: 'state' })
    ok(await orders.sellerStep(seller2, o.id, 'accept'))
    ok(await orders.sellerStep(seller2, o.id, 'ship'))
    expect(await orders.confirmReceived(buyer, o.id)).toBe(false)
    expect(await orders.confirmReceived(buyer2, o.id)).toBe(true)
    expect((await orders.getOrder(buyer2, o.id))!.events.at(-1)).toMatchObject({ kind: 'delivered', note: 'confirmed_by_buyer' })
    const o2 = await buy(cakeV, 1, 'pickup')
    expect(await orders.sellerCancel(seller2, o2.id, '')).toEqual({ ok: false, error: 'reason' })
    ok(await orders.sellerCancel(seller2, o2.id, 'Oven broke'))
    expect((await notes(buyer2.id, 'market_order')).some((n) => n.marketOrderId === o2.id)).toBe(true)
    expect((await orders.adminRefund(admin, o.id, 500, 'Late delivery')).ok).toBe(true)
    expect((await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, o.id)))[0].refundedPesewas).toBe(500)
    expect((await orders.adminRefund(admin, o.id, 999_999, 'too much')).ok).toBe(false)
  })

  it('a paid order not accepted within 3 days is cancelled and refunded by the job', async () => {
    const o = await buy(cakeV, 1, 'pickup')
    await db.update(schema.marketOrders).set({ paidAt: sql`now() - interval '73 hours'` }).where(eq(schema.marketOrders.id, o.id))
    expect(await orders.cancelUnacceptedOrders()).toBeGreaterThanOrEqual(1)
    const [x] = await db.select().from(schema.marketOrders).where(eq(schema.marketOrders.id, o.id))
    expect(x).toMatchObject({ status: 'cancelled', cancelReason: 'not_accepted_in_time', escrow: 'refunded' })
  })

  it('an unpaid checkout is released by a new checkout or by the stale-payment job', async () => {
    await db.delete(schema.cartItems).where(eq(schema.cartItems.userId, buyer2.id))
    ok(await cart.addToCart(buyer2, cakeV, 3))
    const before = await stock(cakeV)
    const r1 = ok(await cart.placeOrder(buyer2, [{ shopId: shopB, fulfilment: 'pickup' }], null))
    expect(await stock(cakeV)).toBe(before - 3)
    const r2 = ok(await cart.placeOrder(buyer2, [{ shopId: shopB, fulfilment: 'pickup' }], null))
    expect((await ordersOf(r1.checkoutId))[0].status).toBe('cancelled')
    expect((await payFor(r1.checkoutId)).status).toBe('abandoned')
    expect(await stock(cakeV)).toBe(before - 3)
    await db.update(schema.payments).set({ createdAt: sql`now() - interval '3 hours'` }).where(eq(schema.payments.reference, r2.reference))
    await settleStalePayments()
    expect((await ordersOf(r2.checkoutId))[0].status).toBe('cancelled')
    expect(await stock(cakeV)).toBe(before)
    // A late payment for released orders is refunded automatically
    await db.update(schema.payments).set({ status: 'pending' }).where(eq(schema.payments.reference, r2.reference))
    await confirmPayment(r2.reference, 'success')
    expect((await payFor(r2.checkoutId)).status).toBe('refunded')
  })
})

describe('moderation, admin and your data', () => {
  it('members report a product; a Tech Admin takes it down', async () => {
    expect(await fileReport(seller.id, { productId: phone }, 'spam', '')).toEqual({ ok: false, error: 'self' })
    ok(await fileReport(buyer.id, { productId: phone }, 'false_info', 'Fake phone'))
    const [r] = await db.select().from(schema.reports).where(eq(schema.reports.productId, phone))
    expect(r.targetUserId).toBe(seller.id)
    await resolveReports(r.id, admin.id, 'actioned', 'remove_post')
    expect(await madmin.setProductStatus(phone, 'removed')).toBe(true)
    expect(await catalog.getProduct(phone, buyer)).toBeNull()
    expect((await madmin.adminProducts({ status: 'removed', q: 'zz' })).rows.map((x) => x.id)).toContain(phone)
    ok(await fileReport(buyer.id, { shopId: shopA }, 'spam', ''))
  })

  it('admin lists and stats', async () => {
    const s = await madmin.marketStats()
    expect(s.sales).toBeGreaterThan(0)
    expect((await madmin.adminOrders({ q: 'ZZ Tailors' })).rows.length).toBeGreaterThan(0)
    expect((await madmin.adminShops({ q: 'zz' })).rows.map((x) => x.slug)).toEqual(expect.arrayContaining(['zz-shop-a', 'zz-shop-b']))
    expect(await madmin.setShopVerified(shopA, true)).toBe(true)
    expect((await catalog.getShop('zz-shop-a', null))!.verified).toBe(true)
  })

  it('"Your data" includes Market orders, wishlist and reviews', async () => {
    const d = await exportData(buyer.id)
    expect(d.marketOrders.length).toBeGreaterThan(0)
    expect(d.wishlist.length).toBe(1)
    expect(d.productReviews.length).toBe(1)
  })
})
