import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
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
  const { data, error } = await createSupabaseAdminClient().rpc('papa_market_cart_snapshot', { p_user_id: userId })
  if (error) throw new Error(`Unable to load market cart: ${error.message}`)
  const rows = (data ?? []) as {
    id: string; variant_id: string; product_id: string; title: string; variant_name: string; image: string | null; unit: number; qty: number; stock: number; available: boolean
    saved: boolean; shop_id: string; shop_name: string; shop_slug: string; offers_pickup: boolean; offers_delivery: boolean; delivery_fee: number; free_over: number | null
    pickup_address: string | null; delivery_note: string | null
  }[]
  const shops = new Map<string, CartShop>()
  const saved: (CartLine & { shopName: string })[] = []
  for (const x of rows) {
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
  const { data, error } = await createSupabaseAdminClient().from('cart_items').select('qty').eq('user_id', userId).eq('saved_for_later', false)
  if (error) throw new Error(`Unable to count market cart items: ${error.message}`)
  return (data ?? []).reduce((total, item) => total + item.qty, 0)
}

type CartError = 'not_found' | 'own_shop' | 'stock' | 'qty' | 'too_many' | 'rate_limited'

async function variantInfo(variantId: string) {
  if (!isId(variantId)) return null
  const { data, error } = await createSupabaseAdminClient().rpc('papa_market_variant_info', { p_variant_id: variantId })
  if (error) throw new Error(`Unable to validate market variant: ${error.message}`)
  return ((data ?? []) as { stock: number; owner_id: string; product_id: string }[])[0] ?? null
}

export async function addToCart(user: Who, variantId: string, qty = 1): Promise<{ ok: true; count: number; error?: never } | { ok: false; error: CartError }> {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { ok: false, error: 'qty' }
  if (!(await hit(`mkt-cart:${user.id}`, 300, 3600))) return { ok: false, error: 'rate_limited' }
  const v = await variantInfo(variantId)
  if (!v) return { ok: false, error: 'not_found' }
  if (v.owner_id === user.id) return { ok: false, error: 'own_shop' }
  if (v.stock < 1) return { ok: false, error: 'stock' }
  try {
    const { data: count, error } = await createSupabaseAdminClient().rpc('papa_market_add_to_cart', {
      p_user_id: user.id,
      p_variant_id: variantId,
      p_qty: qty,
    })
    if (error) {
      if (error.message.includes('too_many')) return { ok: false, error: 'too_many' }
      if (error.message.includes('stock')) return { ok: false, error: 'stock' }
      throw new Error(`Unable to add market item to cart: ${error.message}`)
    }
    return { ok: true, count: Number(count ?? 0) }
  } catch (error) {
    if (error instanceof Error && error.message.includes('too_many')) return { ok: false, error: 'too_many' }
    if (error instanceof Error && error.message.includes('stock')) return { ok: false, error: 'stock' }
    throw error
  }
}

/** Change how many (0 removes the line). Never more than is in stock. */
export async function setCartQty(user: Who, itemId: string, qty: number) {
  if (!isId(itemId) || !Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) return { ok: false as const, error: 'qty' as const }
  const { data: count, error } = await createSupabaseAdminClient().rpc('papa_market_set_cart_qty', {
    p_user_id: user.id,
    p_item_id: itemId,
    p_qty: qty,
  })
  if (error) {
    if (error.message.includes('not_found')) return { ok: false as const, error: 'not_found' as const }
    throw new Error(`Unable to update market cart: ${error.message}`)
  }
  return { ok: true as const, count: Number(count ?? 0) }
}

export async function saveForLater(user: Who, itemId: string, saved: boolean) {
  if (!isId(itemId)) return { ok: false as const, error: 'not_found' as const }
  const { data: count, error } = await createSupabaseAdminClient().rpc('papa_market_set_saved', {
    p_user_id: user.id,
    p_item_id: itemId,
    p_saved: saved,
  })
  if (error) {
    if (error.message.includes('not_found')) return { ok: false as const, error: 'not_found' as const }
    throw new Error(`Unable to update saved market item: ${error.message}`)
  }
  return { ok: true as const, count: Number(count ?? 0) }
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
  const client = createSupabaseAdminClient()
  const { data: shopOwners, error: shopsError } = await client.from('shops').select('id, owner_id').in('id', q.groups.map((group) => group.shopId))
  if (shopsError) throw new Error(`Unable to validate market checkout shops: ${shopsError.message}`)
  if ((shopOwners ?? []).some((shop) => shop.owner_id === user.id)) return { ok: false, error: 'own_shop' }
  const ownerByShop = new Map((shopOwners ?? []).map((shop) => [shop.id, shop.owner_id]))
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
  const { data: buyer, error: buyerError } = await client.from('users').select('full_name, phone').eq('id', user.id).maybeSingle()
  if (buyerError) throw new Error(`Unable to load market buyer details: ${buyerError.message}`)
  if (!buyer) return { ok: false, error: 'unavailable' }

  const orders = q.groups.map((group) => {
    const shop = q.cart.shops.find((entry) => entry.id === group.shopId)!
    const fee = Math.round(((group.subtotalPesewas - group.discountPesewas) * feeBps) / 10_000)
    const delivery = group.fulfilment === 'delivery'
    return {
      number: orderNumber(),
      shop_id: group.shopId,
      seller_id: ownerByShop.get(group.shopId),
      shop_name: group.shopName,
      fulfilment: group.fulfilment,
      recipient_name: delivery ? addr!.name : buyer.full_name,
      phone: delivery ? addr!.phone : buyer.phone,
      town: delivery ? addr!.town : null,
      address: delivery ? addr!.address : null,
      landmark: delivery ? addr!.landmark : null,
      note: addr?.note ?? null,
      pickup_address: delivery ? null : shop.pickupAddress,
      subtotal: group.subtotalPesewas,
      delivery_fee: group.deliveryFeePesewas,
      discount: group.discountPesewas,
      total: group.totalPesewas,
      fee_bps: feeBps,
      fee,
      seller_net: group.totalPesewas - fee,
      coupon: group.coupon,
      items: shop.lines.filter((line) => line.available).map((line) => ({
        variant_id: line.variantId,
        product_id: line.productId,
        title: line.title,
        variant_name: line.variantName,
        image: line.image,
        unit: line.unitPesewas,
        qty: line.qty,
        line_total: line.unitPesewas * line.qty,
      })),
    }
  })

  const { data: checkoutId, error: checkoutError } = await client.rpc('papa_market_create_checkout', {
    p_buyer_id: user.id,
    p_total_pesewas: q.totalPesewas,
    p_orders: orders,
  })
  if (checkoutError) {
    if (checkoutError.message.includes('coupon_used_up')) return { ok: false, error: 'coupon_used_up' }
    if (checkoutError.message.includes('stock')) return { ok: false, error: 'stock' }
    throw new Error(`Unable to create market checkout: ${checkoutError.message}`)
  }
  if (!checkoutId) throw new Error('Unable to create market checkout: no checkout id returned')
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
  const { data: transitioned, error: transitionError } = await createSupabaseAdminClient().rpc('papa_market_set_checkout_paid', {
    p_checkout_id: checkoutId,
    p_ok: ok,
  })
  if (transitionError) throw new Error(`Unable to update market checkout payment: ${transitionError.message}`)
  const paid = ((transitioned ?? []) as {
    id: string
    buyer_id: string | null
    seller_id: string | null
    number: string
    subtotal_pesewas: number
    total_pesewas: number
  }[]).map((order) => ({
    id: order.id,
    buyerId: order.buyer_id,
    sellerId: order.seller_id,
    number: order.number,
    subtotalPesewas: order.subtotal_pesewas,
    totalPesewas: order.total_pesewas,
  }))
  if (!ok) {
    if (!paid.length) return
    const client = createSupabaseAdminClient()
    const { data: items, error: itemsError } = await client.from('market_order_items').select('product_id').in('order_id', paid.map((order) => order.id))
    if (itemsError) throw new Error(`Unable to load failed market checkout items: ${itemsError.message}`)
    for (const productId of new Set((items ?? []).map((item) => item.product_id).filter((id): id is string => !!id))) {
      await fireStockAlerts(productId).catch(() => {})
    }
    return
  }
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
    if (o.buyerId) await notify(o.buyerId, 'market_order', null, null, { marketOrderId: o.id }).catch(() => {})
    if (o.sellerId) {
      await notify(o.sellerId, 'market_sale', o.buyerId, null, { marketOrderId: o.id }).catch(() => {})
      const [s] = await db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, o.sellerId))
      if (s?.phone) await sendSms(s.phone, `PAPA Market: New order ${o.number} (${ghs(o.subtotalPesewas)}). Open PAPA to accept it within 3 days.`).catch(() => {})
    }
  }
  if (buyerId) {
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
