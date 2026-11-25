import 'server-only'
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
  const client = createSupabaseAdminClient()
  const { data: k, error } = await client.from('coupons')
    .select('id,code,kind,value,min_spend_pesewas,starts_at,ends_at,max_uses,used_count')
    .eq('shop_id', shopId).eq('code', c).eq('active', true).maybeSingle()
  if (error) throw new Error(`Unable to check market coupon: ${error.message}`)
  if (!k) return { ok: false, error: 'coupon_invalid' }
  const now = Date.now()
  if ((k.starts_at && new Date(k.starts_at).getTime() > now) || (k.ends_at && new Date(k.ends_at).getTime() < now)) return { ok: false, error: 'coupon_expired' }
  if (subtotal < k.min_spend_pesewas) return { ok: false, error: 'coupon_min' }
  if (k.max_uses != null && k.used_count >= k.max_uses) return { ok: false, error: 'coupon_used_up' }
  const { count: used, error: usedError } = await client.from('market_orders').select('id', { count: 'exact', head: true })
    .eq('buyer_id', buyerId).eq('coupon_id', k.id).not('status', 'in', '(pending_payment,cancelled)')
  if (usedError) throw new Error(`Unable to check coupon usage: ${usedError.message}`)
  if ((used ?? 0) > 0) return { ok: false, error: 'coupon_used' }
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
  const client = createSupabaseAdminClient()
  const { data: order, error: orderError } = await client.from('market_orders')
    .select('recipient_name,phone,town,address,landmark').eq('buyer_id', userId).eq('fulfilment', 'delivery')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (orderError) throw new Error(`Unable to load previous delivery address: ${orderError.message}`)
  if (order) return { name: order.recipient_name ?? '', phone: order.phone ? formatPhone(order.phone) : '', town: order.town ?? '', address: order.address ?? '', landmark: order.landmark }
  const { data: user, error: userError } = await client.from('users').select('full_name,phone').eq('id', userId).maybeSingle()
  if (userError) throw new Error(`Unable to load buyer details: ${userError.message}`)
  return { name: user?.full_name ?? '', phone: user?.phone ? formatPhone(user.phone) : '', town: '', address: '', landmark: '' }
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
  const client = createSupabaseAdminClient()
  const { data: pending, error } = await client.from('payments').select('reference,market_checkout_id,provider')
    .eq('user_id', buyerId).eq('purpose', 'order').eq('status', 'pending').not('market_checkout_id', 'is', null)
  if (error) throw new Error(`Unable to load pending market checkouts: ${error.message}`)
  for (const payment of pending ?? []) {
    if (!payment.market_checkout_id) continue
    if (payment.provider === 'paystack') {
      const { confirmPayment } = await import('@/server/payments/payments')
      const verified = await confirmPayment(payment.reference)
      if (verified?.status !== 'pending') continue
    }
    const { data: abandoned, error: updateError } = await client.from('payments').update({ status: 'abandoned' })
      .eq('reference', payment.reference).eq('status', 'pending').select('reference')
    if (updateError) throw new Error(`Unable to release pending market payment: ${updateError.message}`)
    if (abandoned?.length) await checkoutPaid(payment.market_checkout_id, false)
  }
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
    const client = createSupabaseAdminClient()
    const { data: payment, error: paymentError } = await client.from('payments').select('id,reference,amount_pesewas')
      .eq('market_checkout_id', checkoutId).eq('status', 'success').maybeSingle()
    if (paymentError) throw new Error(`Unable to load market payment: ${paymentError.message}`)
    const { count: open, error: ordersError } = await client.from('market_orders').select('id', { count: 'exact', head: true })
      .eq('checkout_id', checkoutId).neq('status', 'cancelled')
    if (ordersError) throw new Error(`Unable to check market checkout orders: ${ordersError.message}`)
    if (payment && !open) {
      const r = await refundPayment(payment.reference, payment.amount_pesewas, 'Order was no longer reserved')
      if (r.ok) {
        const { error: updateError } = await client.from('payments').update({ status: 'refunded' }).eq('id', payment.id)
        if (updateError) throw new Error(`Unable to update market payment: ${updateError.message}`)
      }
    }
    return
  }
  const buyerId = paid[0].buyerId
  for (const o of paid) {
    if (o.buyerId) await notify(o.buyerId, 'market_order', null, null, { marketOrderId: o.id }).catch(() => {})
    if (o.sellerId) {
      await notify(o.sellerId, 'market_sale', o.buyerId, null, { marketOrderId: o.id }).catch(() => {})
      const { data: seller, error: sellerError } = await createSupabaseAdminClient().from('users').select('phone').eq('id', o.sellerId).maybeSingle()
      if (sellerError) throw new Error(`Unable to load seller contact: ${sellerError.message}`)
      if (seller?.phone) await sendSms(seller.phone, `PAPA Market: New order ${o.number} (${ghs(o.subtotalPesewas)}). Open PAPA to accept it within 3 days.`).catch(() => {})
    }
  }
  if (buyerId) {
    const { data: buyer, error: buyerError } = await createSupabaseAdminClient().from('users').select('phone').eq('id', buyerId).maybeSingle()
    if (buyerError) throw new Error(`Unable to load buyer contact: ${buyerError.message}`)
    const total = paid.reduce((a, o) => a + o.totalPesewas, 0)
    if (buyer?.phone) await sendSms(buyer.phone, `PAPA Market: Payment of ${ghs(total)} received for ${paid.map((o) => o.number).join(', ')}. The money is held safely until you receive your items.`).catch(() => {})
  }
}

/** Order confirmation page: the orders of one checkout (the buyer's own). */
export async function checkoutSummary(userId: string, checkoutId: string) {
  if (!isId(checkoutId)) return null
  const client = createSupabaseAdminClient()
  const { data: orders, error: ordersError } = await client.from('market_orders')
    .select('id,number,shop_name,status,fulfilment,total_pesewas,created_at').eq('checkout_id', checkoutId).eq('buyer_id', userId).order('shop_name')
  if (ordersError) throw new Error(`Unable to load market checkout summary: ${ordersError.message}`)
  if (!orders?.length) return null
  const { data: payment, error: paymentError } = await client.from('payments').select('reference,status')
    .eq('market_checkout_id', checkoutId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (paymentError) throw new Error(`Unable to load market payment status: ${paymentError.message}`)
  return {
    orders: orders.map((o) => ({ id: o.id, number: o.number, shopName: o.shop_name, status: o.status, fulfilment: o.fulfilment, totalPesewas: o.total_pesewas, createdAt: iso(o.created_at)! })),
    reference: payment?.reference ?? null, paymentStatus: payment?.status ?? null, sandbox: paymentProvider() === 'sandbox',
  }
}
