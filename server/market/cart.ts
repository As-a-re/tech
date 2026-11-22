import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { hit } from '@/server/identity/rate-limit'
import { notify } from '@/server/notifications/notify'
import { getSetting } from '@/server/admin/platform-settings'
import { begin, MAX_PESEWAS, MIN_PESEWAS } from '@/server/payments/payments'
import { paymentProvider, refundPayment } from '@/integrations/payments'
import { sendSms } from '@/integrations/sms'
import { formatPhone, isGhanaMobile, normalisePhone } from '@/lib/identity/normalise'
import { ghs } from '@/lib/give/money'
import { iso, isId, orderEvent, orderNumber, sixDigits, type Who } from './shared'
import { fireStockAlerts } from './catalog'

const MAX_LINES = 100, MAX_QTY = 50

/* ───────── Cart ───────── */
export type CartLine = {
  id: string; variantId: string; productId: string; title: string; variantName: string; image: string | null; unitPesewas: number; qty: number; stock: number
  available: boolean; savedForLater: boolean
}
export type CartShop = {
  id: string; name: string; slug: string; offersPickup: boolean; offersDelivery: boolean; deliveryFeePesewas: number; freeDeliveryOverPesewas: number | null
  pickupAddress: string | null; deliveryNote: string | null; lines: CartLine[]; subtotalPesewas: number
}

export async function getCart(userId: string) {
  const r = await db.execute<{
    id: string; variant_id: string; product_id: string; title: string; variant_name: string; image: string | null; unit: number; qty: number; stock: number; available: boolean
    saved: boolean; shop_id: string; shop_name: string; shop_slug: string; offers_pickup: boolean; offers_delivery: boolean; delivery_fee: number; free_over: number | null
    pickup_address: string | null; delivery_note: string | null
  }>(sql`select c.id, c.variant_id, p.id as product_id, p.title, v.name as variant_name, p.images ->> 0 as image, v.price_pesewas as unit, c.qty, v.stock,
      (p.status = 'active' and p.deleted_at is null and s.status = 'active' and s.deleted_at is null and u.status = 'active' and v.active and v.stock > 0) as available,
      c.saved_for_later as saved, s.id as shop_id, s.name as shop_name, s.slug as shop_slug, s.offers_pickup, s.offers_delivery, s.delivery_fee_pesewas as delivery_fee,
      s.free_delivery_over_pesewas as free_over, s.pickup_address, s.delivery_note
    from cart_items c join product_variants v on v.id = c.variant_id join products p on p.id = v.product_id join shops s on s.id = p.shop_id join users u on u.id = s.owner_id
    where c.user_id = ${userId} order by c.created_at desc`)
  const shops = new Map<string, CartShop>()
  const saved: (CartLine & { shopName: string })[] = []
  for (const x of r.rows) {
    const line: CartLine = { id: x.id, variantId: x.variant_id, productId: x.product_id, title: x.title, variantName: x.variant_name, image: x.image, unitPesewas: x.unit,
      qty: x.qty, stock: x.stock, available: x.available, savedForLater: x.saved }
    if (x.saved) { saved.push({ ...line, shopName: x.shop_name }); continue }
    let s = shops.get(x.shop_id)
    if (!s) shops.set(x.shop_id, s = { id: x.shop_id, name: x.shop_name, slug: x.shop_slug, offersPickup: x.offers_pickup, offersDelivery: x.offers_delivery, deliveryFeePesewas: x.delivery_fee,
      freeDeliveryOverPesewas: x.free_over, pickupAddress: x.pickup_address, deliveryNote: x.delivery_note, lines: [], subtotalPesewas: 0 })
    s.lines.push(line)
    if (line.available) s.subtotalPesewas += line.unitPesewas * Math.min(line.qty, line.stock)
  }
  const groups = [...shops.values()]
  return { shops: groups, saved, subtotalPesewas: groups.reduce((a, s) => a + s.subtotalPesewas, 0), count: groups.reduce((a, s) => a + s.lines.filter((l) => l.available).reduce((b, l) => b + l.qty, 0), 0) }
}

/** Number shown on the Cart badge (items waiting to be checked out). */
export async function cartCount(userId: string) {
  const r = await db.execute<{ n: number }>(sql`select coalesce(sum(qty), 0)::int as n from cart_items where user_id = ${userId} and not saved_for_later`)
  return r.rows[0]?.n ?? 0
}

type CartError = 'not_found' | 'own_shop' | 'stock' | 'qty' | 'too_many' | 'rate_limited'

async function variantInfo(variantId: string) {
  if (!isId(variantId)) return null
  const r = await db.execute<{ stock: number; owner_id: string; product_id: string }>(sql`select v.stock, s.owner_id, p.id as product_id from product_variants v join products p on p.id = v.product_id
    join shops s on s.id = p.shop_id join users u on u.id = s.owner_id
    where v.id = ${variantId} and v.active and p.status = 'active' and p.deleted_at is null and s.status = 'active' and s.deleted_at is null and u.status = 'active'`)
  return r.rows[0] ?? null
}

export async function addToCart(user: Who, variantId: string, qty = 1): Promise<{ ok: true; count: number; error?: never } | { ok: false; error: CartError }> {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { ok: false, error: 'qty' }
  if (!(await hit(`mkt-cart:${user.id}`, 300, 3600))) return { ok: false, error: 'rate_limited' }
  const v = await variantInfo(variantId)
  if (!v) return { ok: false, error: 'not_found' }
  if (v.owner_id === user.id) return { ok: false, error: 'own_shop' }
  if (v.stock < 1) return { ok: false, error: 'stock' }
  const [existing] = await db.select().from(schema.cartItems).where(and(eq(schema.cartItems.userId, user.id), eq(schema.cartItems.variantId, variantId)))
  if (!existing && (await db.$count(schema.cartItems, eq(schema.cartItems.userId, user.id))) >= MAX_LINES) return { ok: false, error: 'too_many' }
  const want = Math.min((existing && !existing.savedForLater ? existing.qty : 0) + qty, v.stock, MAX_QTY)
  await db.insert(schema.cartItems).values({ userId: user.id, variantId, qty: want })
    .onConflictDoUpdate({ target: [schema.cartItems.userId, schema.cartItems.variantId], set: { qty: want, savedForLater: false, updatedAt: sql`now()` } })
  return { ok: true, count: await cartCount(user.id) }
}

/** Change how many (0 removes the line). Never more than is in stock. */
export async function setCartQty(user: Who, itemId: string, qty: number) {
  if (!isId(itemId) || !Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) return { ok: false as const, error: 'qty' as const }
  const [c] = await db.select().from(schema.cartItems).where(and(eq(schema.cartItems.id, itemId), eq(schema.cartItems.userId, user.id)))
  if (!c) return { ok: false as const, error: 'not_found' as const }
  if (qty === 0) await db.delete(schema.cartItems).where(eq(schema.cartItems.id, itemId))
  else {
    const [v] = await db.select({ stock: schema.productVariants.stock }).from(schema.productVariants).where(eq(schema.productVariants.id, c.variantId))
    await db.update(schema.cartItems).set({ qty: Math.max(1, Math.min(qty, v?.stock || 1)), updatedAt: sql`now()` }).where(eq(schema.cartItems.id, itemId))
  }
  return { ok: true as const, count: await cartCount(user.id) }
}

export async function saveForLater(user: Who, itemId: string, saved: boolean) {
  if (!isId(itemId)) return { ok: false as const, error: 'not_found' as const }
  const r = await db.update(schema.cartItems).set({ savedForLater: saved, updatedAt: sql`now()` }).where(and(eq(schema.cartItems.id, itemId), eq(schema.cartItems.userId, user.id))).returning()
  return r.length ? { ok: true as const, count: await cartCount(user.id) } : { ok: false as const, error: 'not_found' as const }
}

/* ───────── Coupons ───────── */
export type CouponError = 'coupon_invalid' | 'coupon_expired' | 'coupon_min' | 'coupon_used_up' | 'coupon_used'

export async function checkCoupon(shopId: string, code: string, subtotal: number, buyerId: string): Promise<{ ok: true; id: string; code: string; discount: number } | { ok: false; error: CouponError }> {
  const c = code.trim().toUpperCase()
  if (!/^[A-Z0-9-]{3,20}$/.test(c)) return { ok: false, error: 'coupon_invalid' }
  const [k] = await db.select().from(schema.coupons).where(and(eq(schema.coupons.shopId, shopId), eq(schema.coupons.code, c), eq(schema.coupons.active, true)))
  if (!k) return { ok: false, error: 'coupon_invalid' }
  const now = Date.now()
  if ((k.startsAt && k.startsAt.getTime() > now) || (k.endsAt && k.endsAt.getTime() < now)) return { ok: false, error: 'coupon_expired' }
  if (subtotal < k.minSpendPesewas) return { ok: false, error: 'coupon_min' }
  if (k.maxUses != null && k.usedCount >= k.maxUses) return { ok: false, error: 'coupon_used_up' }
  const used = await db.$count(schema.marketOrders, and(eq(schema.marketOrders.buyerId, buyerId), eq(schema.marketOrders.couponId, k.id), sql`${schema.marketOrders.status} not in ('pending_payment', 'cancelled')`))
  if (used > 0) return { ok: false, error: 'coupon_used' }
  const discount = k.kind === 'percent' ? Math.floor((subtotal * Math.min(90, k.value)) / 100) : Math.min(k.value, subtotal)
  return { ok: true, id: k.id, code: k.code, discount }
}

/* ───────── Checkout ───────── */
export type Fulfilment = 'delivery' | 'pickup'
export type CheckoutChoice = { shopId: string; fulfilment: Fulfilment; coupon?: string | null }
export type Address = { name: string; phone: string; town: string; address: string; landmark?: string | null; note?: string | null }
export type QuoteGroup = {
  shopId: string; shopName: string; fulfilment: Fulfilment; subtotalPesewas: number; deliveryFeePesewas: number; discountPesewas: number; totalPesewas: number
  coupon: string | null; couponError: CouponError | null
}
export type CheckoutError = 'empty' | 'unavailable' | 'fulfilment' | 'address' | 'phone' | 'stock' | 'amount' | 'own_shop' | 'rate_limited' | 'provider' | CouponError

function deliveryFee(shop: CartShop, subtotal: number, f: Fulfilment) {
  if (f === 'pickup') return 0
  return shop.freeDeliveryOverPesewas != null && subtotal >= shop.freeDeliveryOverPesewas ? 0 : shop.deliveryFeePesewas
}

/** Prices for the checkout page (also used to place the order, so what the buyer sees is what they pay). */
export async function quoteCheckout(user: Who, choices: CheckoutChoice[]) {
  const cart = await getCart(user.id)
  const groups: QuoteGroup[] = []
  for (const s of cart.shops) {
    const live = s.lines.filter((l) => l.available)
    if (!live.length) continue
    const c = choices.find((x) => x.shopId === s.id)
    const f: Fulfilment = c?.fulfilment === 'pickup' && s.offersPickup ? 'pickup' : c?.fulfilment === 'delivery' && s.offersDelivery ? 'delivery' : s.offersDelivery ? 'delivery' : 'pickup'
    const subtotal = live.reduce((a, l) => a + l.unitPesewas * l.qty, 0)
    const fee = deliveryFee(s, subtotal, f)
    let discount = 0, coupon: string | null = null, couponError: CouponError | null = null
    if (c?.coupon?.trim()) {
      const k = await checkCoupon(s.id, c.coupon, subtotal, user.id)
      if (k.ok) { discount = k.discount; coupon = k.code } else couponError = 'error' in k ? k.error : 'coupon_invalid'
    }
    groups.push({ shopId: s.id, shopName: s.name, fulfilment: f, subtotalPesewas: subtotal, deliveryFeePesewas: fee, discountPesewas: discount, totalPesewas: subtotal + fee - discount, coupon, couponError })
  }
  return { cart, groups, totalPesewas: groups.reduce((a, g) => a + g.totalPesewas, 0) }
}

/** The address from the member's last delivery (or their name and phone), to fill the form. */
export async function lastAddress(userId: string): Promise<Address> {
  const [o] = await db.select().from(schema.marketOrders).where(and(eq(schema.marketOrders.buyerId, userId), eq(schema.marketOrders.fulfilment, 'delivery')))
    .orderBy(sql`${schema.marketOrders.createdAt} desc`).limit(1)
  if (o) return { name: o.recipientName ?? '', phone: o.phone ? formatPhone(o.phone) : '', town: o.town ?? '', address: o.address ?? '', landmark: o.landmark }
  const [u] = await db.select({ name: schema.users.fullName, phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, userId))
  return { name: u?.name ?? '', phone: u?.phone ? formatPhone(u.phone) : '', town: '', address: '', landmark: '' }
}

/**
 * Places the order: one order per shop, stock held, coupon used, then the buyer pays once for everything on the secure page.
 * The money is held by the platform until delivery is confirmed.
 */
export async function placeOrder(user: Who, choices: CheckoutChoice[], address: Address | null): Promise<{ ok: true; url: string; reference: string; checkoutId: string; error?: never; shopId?: never } | { ok: false; error: CheckoutError; shopId?: string }> {
  if (!(await hit(`mkt-checkout:${user.id}`, 20, 3600))) return { ok: false, error: 'rate_limited' }
  // An earlier checkout that was never paid lets its stock go first
  await releasePendingCheckouts(user.id)
  const q = await quoteCheckout(user, choices)
  if (!q.groups.length) return { ok: false, error: 'empty' }
  for (const s of q.cart.shops) {
    // Lines no longer for sale are simply left out; a line asking for more than is left must be changed first
    if (s.lines.some((l) => l.available && l.qty > l.stock)) return { ok: false, error: 'stock', shopId: s.id }
    const c = choices.find((x) => x.shopId === s.id)
    if (c && ((c.fulfilment === 'pickup' && !s.offersPickup) || (c.fulfilment === 'delivery' && !s.offersDelivery))) return { ok: false, error: 'fulfilment', shopId: s.id }
  }
  const bad = q.groups.find((g) => g.couponError)
  if (bad) return { ok: false, error: bad.couponError!, shopId: bad.shopId }
  const owner = await db.execute(sql`select 1 from shops where owner_id = ${user.id} and id in ${q.groups.map((g) => g.shopId)}`)
  if (owner.rows.length) return { ok: false, error: 'own_shop' }
  let addr: Address | null = null
  if (q.groups.some((g) => g.fulfilment === 'delivery')) {
    const a = address
    if (!a || a.name.trim().length < 2 || a.name.length > 80 || a.town.trim().length < 2 || a.town.length > 60 || a.address.trim().length < 5 || a.address.length > 300
      || (a.landmark?.length ?? 0) > 200 || (a.note?.length ?? 0) > 300) return { ok: false, error: 'address' }
    const phone = normalisePhone(a.phone)
    if (!isGhanaMobile(phone)) return { ok: false, error: 'phone' }
    addr = { name: a.name.trim(), phone, town: a.town.trim(), address: a.address.trim(), landmark: a.landmark?.trim() || null, note: a.note?.trim() || null }
  }
  if (q.totalPesewas < MIN_PESEWAS || q.totalPesewas > MAX_PESEWAS) return { ok: false, error: 'amount' }
  const feeBps = Math.round((await getSetting('marketFeePercent')) * 100)
  const [buyer] = await db.select({ name: schema.users.fullName, phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, user.id))

  class Stop extends Error { constructor(public code: CheckoutError, public shopId?: string) { super(code) } }
  let checkoutId: string
  try {
    checkoutId = await db.transaction(async (tx) => {
      const [co] = await tx.insert(schema.marketCheckouts).values({ buyerId: user.id, totalPesewas: q.totalPesewas }).returning({ id: schema.marketCheckouts.id })
      for (const g of q.groups) {
        const shop = q.cart.shops.find((s) => s.id === g.shopId)!
        const [owner] = await tx.select({ id: schema.shops.ownerId }).from(schema.shops).where(eq(schema.shops.id, g.shopId))
        let couponId: string | null = null
        if (g.coupon) {
          const used = await tx.execute<{ id: string }>(sql`update coupons set used_count = used_count + 1 where shop_id = ${g.shopId} and code = ${g.coupon} and active
            and (max_uses is null or used_count < max_uses) returning id`)
          if (!used.rows.length) throw new Stop('coupon_used_up', g.shopId)
          couponId = used.rows[0].id
        }
        const feeBase = g.subtotalPesewas - g.discountPesewas
        const fee = Math.round((feeBase * feeBps) / 10_000)
        const [o] = await tx.insert(schema.marketOrders).values({
          number: orderNumber(), checkoutId: co.id, buyerId: user.id, shopId: g.shopId, sellerId: owner.id, shopName: g.shopName, fulfilment: g.fulfilment,
          recipientName: addr && g.fulfilment === 'delivery' ? addr.name : buyer.name, phone: addr && g.fulfilment === 'delivery' ? addr.phone : buyer.phone,
          town: g.fulfilment === 'delivery' ? addr!.town : null, address: g.fulfilment === 'delivery' ? addr!.address : null, landmark: g.fulfilment === 'delivery' ? addr!.landmark : null,
          note: addr?.note ?? null, pickupAddress: g.fulfilment === 'pickup' ? shop.pickupAddress : null,
          subtotalPesewas: g.subtotalPesewas, deliveryFeePesewas: g.deliveryFeePesewas, discountPesewas: g.discountPesewas, totalPesewas: g.totalPesewas,
          feeBps, feePesewas: fee, sellerNetPesewas: g.totalPesewas - fee, couponId, couponCode: g.coupon,
        }).returning({ id: schema.marketOrders.id })
        for (const l of shop.lines.filter((x) => x.available)) {
          // Hold the stock in one statement, so two buyers can't both get the last one
          const held = await tx.execute(sql`update product_variants set stock = stock - ${l.qty} where id = ${l.variantId} and active and stock >= ${l.qty} returning id`)
          if (!held.rows.length) throw new Stop('stock', g.shopId)
          await tx.insert(schema.marketOrderItems).values({ orderId: o.id, productId: l.productId, variantId: l.variantId, title: l.title, variantName: l.variantName, image: l.image,
            unitPesewas: l.unitPesewas, qty: l.qty, totalPesewas: l.unitPesewas * l.qty })
        }
        await tx.insert(schema.marketOrderEvents).values({ orderId: o.id, kind: 'placed', actorId: user.id })
      }
      return co.id
    })
  } catch (e) {
    if (e instanceof Stop) return { ok: false, error: e.code, shopId: e.shopId }
    throw e
  }
  const pay = await begin(user, { purpose: 'order', amountPesewas: q.totalPesewas, level: 'national', marketCheckoutId: checkoutId })
  if (!pay.ok) { await checkoutPaid(checkoutId, false); return { ok: false, error: pay.error === 'rate_limited' ? 'rate_limited' : 'provider' } }
  return { ok: true, url: pay.url, reference: pay.reference, checkoutId }
}

/** Stock and coupons held by the buyer's unpaid checkouts go back (the payment is checked with the provider first). */
export async function releasePendingCheckouts(buyerId: string) {
  const r = await db.execute<{ reference: string; checkout: string; provider: string }>(sql`select p.reference, p.market_checkout_id as checkout, p.provider from payments p
    where p.user_id = ${buyerId} and p.purpose = 'order' and p.status = 'pending' and p.market_checkout_id is not null`)
  for (const p of r.rows) {
    if (p.provider === 'paystack') {
      const { confirmPayment } = await import('@/server/payments/payments')
      const v = await confirmPayment(p.reference)
      if (v?.status !== 'pending') continue
    }
    const gone = await db.update(schema.payments).set({ status: 'abandoned' }).where(and(eq(schema.payments.reference, p.reference), eq(schema.payments.status, 'pending'))).returning()
    if (gone.length) await checkoutPaid(p.checkout, false)
  }
}

/** Puts an order's items back in stock (and tells members waiting for them). */
export async function restock(orderId: string) {
  const items = await db.select({ variantId: schema.marketOrderItems.variantId, productId: schema.marketOrderItems.productId, qty: schema.marketOrderItems.qty })
    .from(schema.marketOrderItems).where(eq(schema.marketOrderItems.orderId, orderId))
  for (const i of items) if (i.variantId) await db.execute(sql`update product_variants set stock = stock + ${i.qty} where id = ${i.variantId}`)
  for (const pid of new Set(items.map((i) => i.productId).filter(Boolean) as string[])) await fireStockAlerts(pid).catch(() => {})
}

/**
 * Called once the checkout's payment succeeds or fails (from the payment return page, the webhook or the stale-payment job).
 * Paid: orders move to "paid" with money held, buyer and sellers are told, the bought items leave the cart.
 * Failed or abandoned: orders are cancelled, stock and coupons are given back.
 */
export async function checkoutPaid(checkoutId: string, ok: boolean) {
  if (!isId(checkoutId)) return
  if (!ok) {
    const cancelled = await db.update(schema.marketOrders).set({ status: 'cancelled', cancelledAt: sql`now()`, cancelReason: 'payment_failed' })
      .where(and(eq(schema.marketOrders.checkoutId, checkoutId), eq(schema.marketOrders.status, 'pending_payment'))).returning()
    for (const o of cancelled) {
      await restock(o.id)
      if (o.couponId) await db.execute(sql`update coupons set used_count = greatest(used_count - 1, 0) where id = ${o.couponId}`)
      await orderEvent(o.id, 'payment_failed')
    }
    return
  }
  const paid = await db.update(schema.marketOrders).set({ status: 'paid', paidAt: sql`now()`, escrow: 'held', handoverCode: sixDigits() })
    .where(and(eq(schema.marketOrders.checkoutId, checkoutId), eq(schema.marketOrders.status, 'pending_payment'))).returning()
  if (!paid.length) {
    // Paid for orders that were already released (e.g. the buyer started a new checkout): give the money back
    const [p] = await db.select().from(schema.payments).where(and(eq(schema.payments.marketCheckoutId, checkoutId), eq(schema.payments.status, 'success')))
    const open = await db.$count(schema.marketOrders, and(eq(schema.marketOrders.checkoutId, checkoutId), sql`${schema.marketOrders.status} <> 'cancelled'`))
    if (p && !open) {
      const r = await refundPayment(p.reference, p.amountPesewas, 'Order was no longer reserved')
      if (r.ok) await db.update(schema.payments).set({ status: 'refunded' }).where(eq(schema.payments.id, p.id))
    }
    return
  }
  const buyerId = paid[0].buyerId
  for (const o of paid) {
    await orderEvent(o.id, 'paid')
    await db.execute(sql`update products p set sold_count = sold_count + i.qty from (select product_id, sum(qty)::int as qty from market_order_items where order_id = ${o.id} group by 1) i where p.id = i.product_id`)
    if (o.buyerId) await notify(o.buyerId, 'market_order', null, null, { marketOrderId: o.id }).catch(() => {})
    if (o.sellerId) {
      await notify(o.sellerId, 'market_sale', o.buyerId, null, { marketOrderId: o.id }).catch(() => {})
      const [s] = await db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, o.sellerId))
      if (s?.phone) await sendSms(s.phone, `PAPA Market: New order ${o.number} (${ghs(o.subtotalPesewas)}). Open PAPA to accept it within 3 days.`).catch(() => {})
    }
  }
  if (buyerId) {
    // The items bought leave the cart ("saved for later" lines stay)
    await db.execute(sql`delete from cart_items where user_id = ${buyerId} and not saved_for_later and variant_id in
      (select i.variant_id from market_order_items i join market_orders o on o.id = i.order_id where o.checkout_id = ${checkoutId})`)
    const [b] = await db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, buyerId))
    const total = paid.reduce((a, o) => a + o.totalPesewas, 0)
    if (b?.phone) await sendSms(b.phone, `PAPA Market: Payment of ${ghs(total)} received for ${paid.map((o) => o.number).join(', ')}. The money is held safely until you receive your items.`).catch(() => {})
  }
}

/** Order confirmation page: the orders of one checkout (the buyer's own). */
export async function checkoutSummary(userId: string, checkoutId: string) {
  if (!isId(checkoutId)) return null
  const orders = await db.select({ id: schema.marketOrders.id, number: schema.marketOrders.number, shopName: schema.marketOrders.shopName, status: schema.marketOrders.status,
    fulfilment: schema.marketOrders.fulfilment, totalPesewas: schema.marketOrders.totalPesewas, createdAt: schema.marketOrders.createdAt })
    .from(schema.marketOrders).where(and(eq(schema.marketOrders.checkoutId, checkoutId), eq(schema.marketOrders.buyerId, userId))).orderBy(schema.marketOrders.shopName)
  if (!orders.length) return null
  const [p] = await db.select({ reference: schema.payments.reference, status: schema.payments.status }).from(schema.payments).where(eq(schema.payments.marketCheckoutId, checkoutId)).orderBy(sql`${schema.payments.createdAt} desc`).limit(1)
  return { orders: orders.map((o) => ({ ...o, createdAt: iso(o.createdAt)! })), reference: p?.reference ?? null, paymentStatus: p?.status ?? null, sandbox: paymentProvider() === 'sandbox' }
}
