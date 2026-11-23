import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { hit } from '@/server/identity/rate-limit'
import { notify } from '@/server/notifications/notify'
import { isCategory } from '@/lib/market/categories'
import { isGhanaMobile, normalisePhone, slugify } from '@/lib/identity/normalise'
import { iso, isId, IMAGE, type Who } from './shared'
import { firePriceAlerts, fireStockAlerts } from './catalog'

/* ───────── Shop ───────── */
export const PAYOUT_PROVIDERS = ['mtn', 'telecel', 'airteltigo'] as const
export type ShopInput = {
  name: string; bio?: string; logoUrl?: string | null; coverUrl?: string | null; town?: string | null; phone?: string | null
  offersPickup: boolean; pickupAddress?: string | null; offersDelivery: boolean; deliveryFeeGhs?: number; freeDeliveryOverGhs?: number | null; deliveryNote?: string | null
  returnDays?: number; payoutMethod?: 'momo' | 'bank' | null; payoutProvider?: string | null; payoutNumber?: string | null; payoutName?: string | null; acceptTerms?: boolean
}
export type ShopError = 'name' | 'bio' | 'images' | 'phone' | 'fulfilment' | 'pickup' | 'fee' | 'returns' | 'payout' | 'terms' | 'exists' | 'no_shop' | 'suspended' | 'open_orders' | 'rate_limited'
const supabase = () => createSupabaseAdminClient()
const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }
const toSnake = (values: Record<string, unknown>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value]))

function toShop(row: any) {
  return {
    id: row.id, ownerId: row.owner_id, slug: row.slug, name: row.name, bio: row.bio, logoUrl: row.logo_url, coverUrl: row.cover_url,
    assemblyId: row.assembly_id, town: row.town, phone: row.phone, offersPickup: row.offers_pickup, pickupAddress: row.pickup_address,
    offersDelivery: row.offers_delivery, deliveryFeePesewas: row.delivery_fee_pesewas, freeDeliveryOverPesewas: row.free_delivery_over_pesewas,
    deliveryNote: row.delivery_note, returnDays: row.return_days, status: row.status, verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
    payoutMethod: row.payout_method, payoutProvider: row.payout_provider, payoutNumber: row.payout_number, payoutName: row.payout_name,
    termsAcceptedAt: row.terms_accepted_at ? new Date(row.terms_accepted_at) : null, createdAt: new Date(row.created_at), deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  }
}

export async function myShop(userId: string) {
  const { data, error } = await supabase().from('shops').select('id,owner_id,slug,name,bio,logo_url,cover_url,assembly_id,town,phone,offers_pickup,pickup_address,offers_delivery,delivery_fee_pesewas,free_delivery_over_pesewas,delivery_note,return_days,status,verified_at,payout_method,payout_provider,payout_number,payout_name,terms_accepted_at,created_at,deleted_at').eq('owner_id', userId).is('deleted_at', null).maybeSingle()
  fail(error)
  return data ? toShop(data) : null
}
export type MyShop = NonNullable<Awaited<ReturnType<typeof myShop>>>

async function freeSlug(name: string, keep?: string) {
  const base = slugify(name).replace(/[^a-z0-9-]/g, '').slice(0, 50).replace(/^-+|-+$/g, '') || 'shop'
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${base}-${i + 1}` : base
    if (slug === keep) return slug
    const { data, error } = await supabase().from('shops').select('id').eq('slug', slug).limit(1)
    fail(error)
    if (!data?.length) return slug
  }
  return `${base}-${Date.now().toString(36)}`
}

const pes = (ghs: number | null | undefined) => (ghs == null ? null : Math.round(ghs * 100))

type ShopValues = {
  name: string; bio: string; logoUrl: string | null; coverUrl: string | null; town: string | null; phone: string | null
  offersPickup: boolean; pickupAddress: string | null; offersDelivery: boolean; deliveryFeePesewas: number; freeDeliveryOverPesewas: number | null
  deliveryNote: string | null; returnDays: number; payoutMethod: 'momo' | 'bank' | null; payoutProvider: string | null; payoutNumber: string | null; payoutName: string | null
}

function checkShop(i: ShopInput): { ok: false; error: ShopError } | { ok: true; values: ShopValues } {
  const name = i.name?.trim() ?? ''
  if (name.length < 3 || name.length > 60) return { ok: false, error: 'name' }
  if ((i.bio?.length ?? 0) > 1000 || (i.town?.length ?? 0) > 60 || (i.deliveryNote?.length ?? 0) > 200) return { ok: false, error: 'bio' }
  if ((i.logoUrl && !IMAGE.test(i.logoUrl)) || (i.coverUrl && !IMAGE.test(i.coverUrl))) return { ok: false, error: 'images' }
  let phone: string | null = null
  if (i.phone?.trim()) { phone = normalisePhone(i.phone); if (!isGhanaMobile(phone)) return { ok: false, error: 'phone' } }
  if (!i.offersPickup && !i.offersDelivery) return { ok: false, error: 'fulfilment' }
  if (i.offersPickup && ((i.pickupAddress?.trim().length ?? 0) < 3 || (i.pickupAddress?.length ?? 0) > 200)) return { ok: false, error: 'pickup' }
  const fee = pes(i.deliveryFeeGhs ?? 0)!, freeOver = pes(i.freeDeliveryOverGhs)
  if (!Number.isFinite(fee) || fee < 0 || fee > 100_000 || (freeOver != null && (!Number.isFinite(freeOver) || freeOver < 100 || freeOver > 10_000_000))) return { ok: false, error: 'fee' }
  const returnDays = i.returnDays ?? 7
  if (!Number.isInteger(returnDays) || returnDays < 0 || returnDays > 30) return { ok: false, error: 'returns' }
  let payout: Pick<ShopValues, 'payoutMethod' | 'payoutProvider' | 'payoutNumber' | 'payoutName'> = { payoutMethod: null, payoutProvider: null, payoutNumber: null, payoutName: null }
  if (i.payoutMethod) {
    const name = i.payoutName?.trim() ?? ''
    if (name.length < 3 || name.length > 80) return { ok: false, error: 'payout' }
    if (i.payoutMethod === 'momo') {
      const n = normalisePhone(i.payoutNumber ?? '')
      if (!PAYOUT_PROVIDERS.includes(i.payoutProvider as never) || !isGhanaMobile(n)) return { ok: false, error: 'payout' }
      payout = { payoutMethod: 'momo', payoutProvider: i.payoutProvider!, payoutNumber: n, payoutName: name }
    } else if (i.payoutMethod === 'bank') {
      const n = (i.payoutNumber ?? '').replace(/\s/g, '')
      const bank = i.payoutProvider?.trim() ?? ''
      if (!/^\d{6,20}$/.test(n) || bank.length < 2 || bank.length > 60) return { ok: false, error: 'payout' }
      payout = { payoutMethod: 'bank', payoutProvider: bank, payoutNumber: n, payoutName: name }
    } else return { ok: false, error: 'payout' }
  }
  return { ok: true, values: {
    name, bio: i.bio?.trim() ?? '', logoUrl: i.logoUrl || null, coverUrl: i.coverUrl || null, town: i.town?.trim() || null, phone,
    offersPickup: i.offersPickup, pickupAddress: i.offersPickup ? i.pickupAddress!.trim() : null, offersDelivery: i.offersDelivery,
    deliveryFeePesewas: i.offersDelivery ? fee : 0, freeDeliveryOverPesewas: i.offersDelivery ? freeOver : null, deliveryNote: i.offersDelivery ? i.deliveryNote?.trim() || null : null,
    returnDays, ...payout,
  } }
}

/** "Become a seller": one shop per member, after accepting the seller rules. */
export async function openShop(user: Who, i: ShopInput): Promise<{ ok: true; slug: string; error?: never } | { ok: false; error: ShopError }> {
  if (!i.acceptTerms) return { ok: false, error: 'terms' }
  if (await myShop(user.id)) return { ok: false, error: 'exists' }
  const c = checkShop(i)
  if (!c.ok) return { ok: false, error: 'error' in c ? c.error : 'name' }
  if (!(await hit(`mkt-shop:${user.id}`, 5, 86_400))) return { ok: false, error: 'rate_limited' }
  const { data: member, error: memberError } = await supabase().from('users').select('assembly_id').eq('id', user.id).maybeSingle()
  fail(memberError)
  if (!member) return { ok: false, error: 'exists' }
  const slug = await freeSlug(c.values.name!)
  const { error } = await supabase().from('shops').insert({
    ...toSnake(c.values as Record<string, unknown>), name: c.values.name!, owner_id: user.id, slug, assembly_id: member.assembly_id,
    terms_accepted_at: new Date().toISOString(),
  })
  if (error?.code === '23505') return { ok: false, error: 'exists' }
  fail(error)
  return { ok: true, slug }
}

export async function updateShop(user: Who, i: ShopInput): Promise<{ ok: true; slug: string; error?: never } | { ok: false; error: ShopError }> {
  const s = await myShop(user.id)
  if (!s) return { ok: false, error: 'no_shop' }
  const c = checkShop(i)
  if (!c.ok) return { ok: false, error: 'error' in c ? c.error : 'name' }
  const { error } = await supabase().from('shops').update(toSnake(c.values as Record<string, unknown>)).eq('id', s.id)
  fail(error)
  return { ok: true, slug: s.slug }
}

/** Take a break (items hidden, orders still handled) or open again. A suspended shop stays suspended. */
export async function setShopPaused(user: Who, paused: boolean) {
  const s = await myShop(user.id)
  if (!s) return { ok: false as const, error: 'no_shop' as const }
  if (s.status === 'suspended') return { ok: false as const, error: 'suspended' as const }
  const { error } = await supabase().from('shops').update({ status: paused ? 'paused' : 'active' }).eq('id', s.id)
  fail(error)
  return { ok: true as const }
}

/** Close the shop for good (only when no order is still in progress). Items leave every cart. */
export async function closeShop(user: Who) {
  const shop = await myShop(user.id)
  if (!shop) return { ok: false as const, error: 'no_shop' as const }
  const client = supabase()
  const { data: openOrders, error: ordersError } = await client.from('market_orders').select('id').eq('shop_id', shop.id).in('status', ['paid', 'accepted', 'packed', 'shipped']).limit(1)
  fail(ordersError)
  if (openOrders?.length) return { ok: false as const, error: 'open_orders' as const }
  const { data: shopOrders, error: shopOrdersError } = await client.from('market_orders').select('id').eq('shop_id', shop.id)
  fail(shopOrdersError)
  const orderIds = (shopOrders ?? []).map((order) => order.id)
  if (orderIds.length) {
    const { data: openRequests, error: requestsError } = await client.from('market_requests').select('id').in('order_id', orderIds).eq('status', 'open').limit(1)
    fail(requestsError)
    if (openRequests?.length) return { ok: false as const, error: 'open_orders' as const }
  }
  const { error: closeError } = await client.from('shops').update({ deleted_at: new Date().toISOString() }).eq('id', shop.id)
  fail(closeError)
  const { data: products, error: productsError } = await client.from('products').select('id').eq('shop_id', shop.id)
  fail(productsError)
  const productIds = (products ?? []).map((product) => product.id)
  if (productIds.length) {
    const { data: variants, error: variantsError } = await client.from('product_variants').select('id').in('product_id', productIds)
    fail(variantsError)
    const variantIds = (variants ?? []).map((variant) => variant.id)
    if (variantIds.length) {
      const { error: cartError } = await client.from('cart_items').delete().in('variant_id', variantIds)
      fail(cartError)
    }
  }
  return { ok: true as const }
}

/* ───────── Products ───────── */
export type VariantInput = { id?: string | null; options: Record<string, string>; priceGhs: number; stock: number; sku?: string | null }
export type ProductInput = {
  title: string; description?: string; category: string; condition: 'new' | 'used' | 'refurbished'; images: string[]; optionNames: string[]; variants: VariantInput[]
  compareAtGhs?: number | null; dealEndsAt?: string | null; status: 'active' | 'draft'
}
export type ProductError = 'no_shop' | 'not_found' | 'title' | 'description' | 'category' | 'condition' | 'images' | 'options' | 'variants' | 'price' | 'stock' | 'compare' | 'deal' | 'removed' | 'rate_limited'

async function ownProduct(user: Who, productId: string) {
  if (!isId(productId)) return null
  const { data: product, error } = await supabase().from('products').select('id,shop_id,status,published_at,title,deleted_at').eq('id', productId).is('deleted_at', null).maybeSingle()
  fail(error)
  if (!product) return null
  const { data: shop, error: shopError } = await supabase().from('shops').select('owner_id,deleted_at').eq('id', product.shop_id).maybeSingle()
  fail(shopError)
  if (!shop || shop.deleted_at || shop.owner_id !== user.id) return null
  return { id: product.id, shop_id: product.shop_id, status: product.status as 'active' | 'draft' | 'removed', published_at: product.published_at ? new Date(product.published_at) : null, title: product.title }
}

/** Adds or edits a listing. Variants keep their ids (carts and orders point at them); removed ones are switched off, not deleted. */
export async function saveProduct(user: Who, i: ProductInput, id?: string): Promise<{ ok: true; id: string; error?: never } | { ok: false; error: ProductError }> {
  const shop = await myShop(user.id)
  if (!shop) return { ok: false, error: 'no_shop' }
  const old = id ? await ownProduct(user, id) : null
  if (id && !old) return { ok: false, error: 'not_found' }
  if (!old && !(await hit(`mkt-product:${user.id}`, 60, 3600))) return { ok: false, error: 'rate_limited' }
  const title = i.title?.trim() ?? ''
  if (title.length < 3 || title.length > 120) return { ok: false, error: 'title' }
  if ((i.description?.length ?? 0) > 5000) return { ok: false, error: 'description' }
  if (!isCategory(i.category)) return { ok: false, error: 'category' }
  if (!['new', 'used', 'refurbished'].includes(i.condition)) return { ok: false, error: 'condition' }
  const images = (i.images ?? []).slice(0, 8)
  if (images.some((u) => !IMAGE.test(u)) || new Set(images).size !== images.length || (i.status === 'active' && !images.length)) return { ok: false, error: 'images' }
  const names = (i.optionNames ?? []).map((n) => n.trim()).filter(Boolean)
  if (names.length > 2 || names.some((n) => n.length > 20) || new Set(names.map((n) => n.toLowerCase())).size !== names.length) return { ok: false, error: 'options' }
  const vs = (i.variants ?? []).map((v) => ({ id: v.id && isId(v.id) ? v.id : null, options: Object.fromEntries(names.map((n) => [n, String(v.options?.[n] ?? '').trim()])), price: Math.round(Number(v.priceGhs) * 100), stock: Number(v.stock), sku: v.sku?.trim().slice(0, 40) || null }))
  if (!vs.length || vs.length > 100 || (!names.length && vs.length !== 1)) return { ok: false, error: 'variants' }
  if (vs.some((v) => Object.values(v.options).some((x) => !x || x.length > 40))) return { ok: false, error: 'options' }
  if (new Set(vs.map((v) => JSON.stringify(v.options))).size !== vs.length) return { ok: false, error: 'variants' }
  if (vs.some((v) => !Number.isInteger(v.price) || v.price < 100 || v.price > 10_000_000)) return { ok: false, error: 'price' }
  if (vs.some((v) => !Number.isInteger(v.stock) || v.stock < 0 || v.stock > 100_000)) return { ok: false, error: 'stock' }
  const minPrice = Math.min(...vs.map((v) => v.price))
  const compareAt = i.compareAtGhs ? Math.round(i.compareAtGhs * 100) : null
  if (compareAt != null && (!(compareAt > minPrice) || compareAt > 10_000_000)) return { ok: false, error: 'compare' }
  const dealEnds = compareAt && i.dealEndsAt ? new Date(i.dealEndsAt) : null
  if (dealEnds && (Number.isNaN(dealEnds.getTime()) || dealEnds.getTime() < Date.now())) return { ok: false, error: 'deal' }
  // A listing a Tech Admin took down can still be corrected, but stays off sale
  const status = old?.status === 'removed' ? 'removed' : i.status === 'active' ? 'active' : 'draft'
  const firstPublish = status === 'active' && !old?.published_at
  const { data: pid, error: saveError } = await supabase().rpc('papa_market_save_product', {
    p_user_id: user.id,
    p_shop_id: shop.id,
    p_product_id: old?.id ?? null,
    p_values: {
      title, description: i.description?.trim() ?? '', category: i.category, condition: i.condition, images, option_names: names,
      price_pesewas: minPrice, compare_at_pesewas: compareAt, deal_ends_at: dealEnds?.toISOString() ?? null, status,
      ...(firstPublish ? { published_at: new Date().toISOString() } : {}),
    },
    p_variants: vs.map((variant, position) => ({
      id: variant.id, name: names.map((name) => variant.options[name]).join(' / '), options: variant.options,
      price_pesewas: variant.price, stock: variant.stock, sku: variant.sku, position,
    })),
  })
  fail(saveError)
  if (!pid) throw new Error('Product could not be saved')
  if (status === 'active') { await fireStockAlerts(pid).catch(() => {}); await firePriceAlerts(pid).catch(() => {}) }
  if (firstPublish && shop.status === 'active') {
    const { data: followers, error: followersError } = await supabase().from('shop_follows').select('user_id').eq('shop_id', shop.id).limit(5000)
    fail(followersError)
    for (const follower of followers ?? []) await notify(follower.user_id, 'market_new', user.id, null, { productId: pid }).catch(() => {})
  }
  return { ok: true, id: pid }
}

/** For the edit form. */
export async function productForEdit(user: Who, productId: string) {
  const p = await ownProduct(user, productId)
  if (!p) return null
  const client = supabase()
  const { data: row, error: productError } = await client.from('products').select('id,status,title,description,category,condition,images,option_names,compare_at_pesewas,deal_ends_at').eq('id', p.id).single()
  fail(productError)
  const { data: variants, error: variantsError } = await client.from('product_variants').select('id,options,price_pesewas,stock,sku').eq('product_id', p.id).eq('active', true).order('position')
  fail(variantsError)
  return {
    id: row.id, status: row.status, input: {
      title: row.title, description: row.description, category: row.category, condition: row.condition, images: row.images, optionNames: row.option_names,
      variants: (variants ?? []).map((variant) => ({ id: variant.id, options: variant.options, priceGhs: variant.price_pesewas / 100, stock: variant.stock, sku: variant.sku })),
      compareAtGhs: row.compare_at_pesewas ? row.compare_at_pesewas / 100 : null, dealEndsAt: row.deal_ends_at ? iso(new Date(row.deal_ends_at))!.slice(0, 10) : null,
      status: row.status === 'active' ? 'active' : 'draft',
    } satisfies ProductInput,
  }
}

/** Publish or move back to drafts (a product a Tech Admin took down can't be republished). */
export async function setListingStatus(user: Who, productId: string, status: 'active' | 'draft') {
  const p = await ownProduct(user, productId)
  if (!p) return { ok: false as const, error: 'not_found' as const }
  if (p.status === 'removed') return { ok: false as const, error: 'removed' as const }
  if (status === 'active') {
    const { data: product, error: productError } = await supabase().from('products').select('images').eq('id', p.id).single()
    fail(productError)
    if (!product.images?.length) return { ok: false as const, error: 'images' as const }
    const first = !p.published_at
    const { error } = await supabase().from('products').update({ status, updated_at: new Date().toISOString(), ...(first ? { published_at: new Date().toISOString() } : {}) }).eq('id', p.id)
    fail(error)
    await fireStockAlerts(p.id).catch(() => {})
    if (first) {
      const { data: followers, error: followersError } = await supabase().from('shop_follows').select('user_id').eq('shop_id', p.shop_id).limit(5000)
      fail(followersError)
      for (const follower of followers ?? []) await notify(follower.user_id, 'market_new', user.id, null, { productId: p.id }).catch(() => {})
    }
  } else {
    const { error } = await supabase().from('products').update({ status, updated_at: new Date().toISOString() }).eq('id', p.id)
    fail(error)
  }
  return { ok: true as const }
}

/** Deleting hides the listing for good and takes it out of carts (past orders keep their copy). */
export async function deleteListing(user: Who, productId: string) {
  const p = await ownProduct(user, productId)
  if (!p) return false
  const client = supabase()
  const { error } = await client.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', p.id)
  fail(error)
  const { data: variants, error: variantsError } = await client.from('product_variants').select('id').eq('product_id', p.id)
  fail(variantsError)
  const variantIds = (variants ?? []).map((variant) => variant.id)
  if (variantIds.length) {
    const { error: cartError } = await client.from('cart_items').delete().in('variant_id', variantIds)
    fail(cartError)
  }
  return true
}

/** "Duplicate": a draft copy to edit (for similar items). */
export async function duplicateListing(user: Who, productId: string) {
  const e = await productForEdit(user, productId)
  if (!e) return { ok: false as const, error: 'not_found' as const }
  const title = `${e.input.title}`.slice(0, 112) + ' (copy)'
  return saveProduct(user, { ...e.input, title, status: 'draft', variants: e.input.variants.map((v) => ({ ...v, id: null })) })
}

/** Quick stock change from the listings page. */
export async function setVariantStock(user: Who, variantId: string, stock: number) {
  if (!isId(variantId) || !Number.isInteger(stock) || stock < 0 || stock > 100_000) return false
  const { data: variant, error } = await supabase().from('product_variants').select('id,product_id').eq('id', variantId).maybeSingle()
  fail(error)
  if (!variant) return false
  const { data: product, error: productError } = await supabase().from('products').select('shop_id,deleted_at').eq('id', variant.product_id).maybeSingle()
  fail(productError)
  if (!product || product.deleted_at) return false
  const { data: shop, error: shopError } = await supabase().from('shops').select('owner_id').eq('id', product.shop_id).maybeSingle()
  fail(shopError)
  if (shop?.owner_id !== user.id) return false
  const { error: updateError } = await supabase().from('product_variants').update({ stock }).eq('id', variantId)
  fail(updateError)
  await fireStockAlerts(variant.product_id).catch(() => {})
  return true
}

export const LOW_STOCK = 3
export type ListingRow = {
  id: string; title: string; image: string | null; status: 'active' | 'draft' | 'removed'; pricePesewas: number; compareAtPesewas: number | null; stock: number; sold: number; views: number
  rating: number | null; ratingCount: number; updatedAt: string; variants: { id: string; name: string; stock: number }[]
}
export async function listings(user: Who, o: { status?: string; q?: string } = {}) {
  const shop = await myShop(user.id)
  if (!shop) return null
  const queryText = o.q?.trim().replace(/[%_\\]/g, '')
  const client = supabase()
  let query = client.from('products').select('id,title,images,status,price_pesewas,compare_at_pesewas,sold_count,view_count,rating_sum,rating_count,updated_at')
    .eq('shop_id', shop.id).is('deleted_at', null)
  if (o.status === 'active' || o.status === 'draft' || o.status === 'removed') query = query.eq('status', o.status)
  if (queryText) query = query.ilike('title', `%${queryText}%`)
  const { data: products, error } = await query.order('updated_at', { ascending: false }).limit(500)
  fail(error)
  const productRows = products ?? []
  const ids = productRows.map((product) => product.id)
  const { data: variants, error: variantsError } = ids.length
    ? await client.from('product_variants').select('id,product_id,name,stock,position').in('product_id', ids).eq('active', true).order('position')
    : { data: [], error: null }
  fail(variantsError)
  const variantsByProduct = new Map<string, { id: string; name: string; stock: number }[]>()
  for (const variant of variants ?? []) {
    const list = variantsByProduct.get(variant.product_id) ?? []
    list.push({ id: variant.id, name: variant.name, stock: variant.stock })
    variantsByProduct.set(variant.product_id, list)
  }
  const rows = productRows.map((product) => {
    const productVariants = variantsByProduct.get(product.id) ?? []
    return { id: product.id, title: product.title, image: product.images?.[0] ?? null, status: product.status as ListingRow['status'],
      price: product.price_pesewas, was: product.compare_at_pesewas, stock: productVariants.reduce((sum, variant) => sum + variant.stock, 0),
      sold: product.sold_count, views: product.view_count, rating_sum: product.rating_sum, rating_count: product.rating_count,
      updated_at: new Date(product.updated_at), variants: productVariants }
  }).filter((product) => o.status !== 'low' || product.status !== 'removed' && product.stock <= LOW_STOCK)
  return {
    shop, rows: rows.map((product): ListingRow => ({ id: product.id, title: product.title, image: product.image, status: product.status, pricePesewas: product.price, compareAtPesewas: product.was, stock: product.stock, sold: product.sold, views: product.views,
      rating: product.rating_count ? Math.round((product.rating_sum / product.rating_count) * 10) / 10 : null, ratingCount: product.rating_count, updatedAt: iso(product.updated_at)!, variants: product.variants })),
  }
}

/* ───────── Dashboard and earnings ───────── */
export async function dashboard(user: Who) {
  const shop = await myShop(user.id)
  if (!shop) return null
  const client = supabase()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [{ data: orders, error: ordersError }, { data: products, error: productsError }, { count: followers, error: followersError }] = await Promise.all([
    client.from('market_orders').select('id,status,paid_at,total_pesewas,refunded_pesewas,seller_net_pesewas,fee_pesewas,escrow').eq('shop_id', shop.id).range(0, 49_999),
    client.from('products').select('id,status,view_count,rating_sum,rating_count').eq('shop_id', shop.id).is('deleted_at', null),
    client.from('shop_follows').select('user_id', { count: 'exact', head: true }).eq('shop_id', shop.id),
  ])
  fail(ordersError); fail(productsError); fail(followersError)
  const orderRows = orders ?? []
  const productRows = products ?? []
  const orderIds = orderRows.map((order) => order.id)
  const productIds = productRows.map((product) => product.id)
  const [{ data: requests, error: requestsError }, { count: questions, error: questionsError }, { data: variants, error: variantsError }] = await Promise.all([
    orderIds.length ? client.from('market_requests').select('id').in('order_id', orderIds).eq('status', 'open') : Promise.resolve({ data: [], error: null }),
    productIds.length ? client.from('product_questions').select('id', { count: 'exact', head: true }).in('product_id', productIds).is('answer', null).is('hidden_at', null) : Promise.resolve({ count: 0, error: null }),
    productIds.length ? client.from('product_variants').select('product_id,stock').in('product_id', productIds).eq('active', true) : Promise.resolve({ data: [], error: null }),
  ])
  fail(requestsError); fail(questionsError); fail(variantsError)
  const stockByProduct = new Map<string, number>()
  for (const variant of variants ?? []) stockByProduct.set(variant.product_id, (stockByProduct.get(variant.product_id) ?? 0) + variant.stock)
  const recentOrders = orderRows.filter((order) => order.paid_at && order.paid_at >= since)
  const activeRecentOrders = recentOrders.filter((order) => order.status !== 'cancelled')
  const rating_sum = productRows.reduce((sum, product) => sum + product.rating_sum, 0)
  const rating_count = productRows.reduce((sum, product) => sum + product.rating_count, 0)
  const data = {
    sales: activeRecentOrders.reduce((sum, order) => sum + order.total_pesewas - order.refunded_pesewas, 0),
    orders: recentOrders.length, to_accept: orderRows.filter((order) => order.status === 'paid').length,
    to_pack: orderRows.filter((order) => order.status === 'accepted').length, to_ship: orderRows.filter((order) => order.status === 'packed').length,
    shipped: orderRows.filter((order) => order.status === 'shipped').length, requests: requests?.length ?? 0, questions: questions ?? 0,
    held: orderRows.filter((order) => order.escrow === 'held' && order.status !== 'cancelled').reduce((sum, order) => sum + order.seller_net_pesewas, 0),
    fees: activeRecentOrders.reduce((sum, order) => sum + order.fee_pesewas, 0),
    products: productRows.filter((product) => product.status === 'active').length, drafts: productRows.filter((product) => product.status === 'draft').length,
    low: productRows.filter((product) => product.status === 'active' && (stockByProduct.get(product.id) ?? 0) <= LOW_STOCK).length,
    views: productRows.reduce((sum, product) => sum + product.view_count, 0), followers: followers ?? 0, rating_sum, rating_count,
  }
  return { shop, ...data, rating: rating_count ? Math.round((rating_sum / rating_count) * 10) / 10 : null }
}

/** Money: held for the seller (paid out after delivery, Batch 18), already paid, fees and refunds; one line per order. */
export async function earnings(user: Who, page = 1) {
  const shop = await myShop(user.id)
  if (!shop) return null
  const { data, error } = await supabase().from('market_orders')
    .select('id,number,status,total_pesewas,fee_pesewas,refunded_pesewas,seller_net_pesewas,escrow,paid_at')
    .eq('shop_id', shop.id).not('paid_at', 'is', null).order('paid_at', { ascending: false }).range(0, 49_999)
  fail(error)
  const orders = data ?? []
  const totals = {
    held: orders.filter((order) => order.escrow === 'held' && order.status !== 'cancelled').reduce((sum, order) => sum + order.seller_net_pesewas, 0),
    released: orders.filter((order) => order.escrow === 'released').reduce((sum, order) => sum + order.seller_net_pesewas, 0),
    fees: orders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + order.fee_pesewas, 0),
    refunded: orders.reduce((sum, order) => sum + order.refunded_pesewas, 0),
    gross: orders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + order.total_pesewas, 0),
  }
  const PAGE = 30, currentPage = Math.max(1, page), start = (currentPage - 1) * PAGE
  return { shop, ...totals, rows: orders.slice(start, start + PAGE).map((order) => ({ ...order, paid_at: iso(new Date(order.paid_at!))! })), page: currentPage, hasMore: orders.length > start + PAGE }
}

export async function unansweredQuestions(user: Who) {
  const client = supabase()
  const { data: shop, error: shopError } = await client.from('shops').select('id').eq('owner_id', user.id).is('deleted_at', null).maybeSingle()
  fail(shopError)
  if (!shop) return []
  const { data: products, error: productsError } = await client.from('products').select('id,title,images').eq('shop_id', shop.id).is('deleted_at', null)
  fail(productsError)
  const productById = new Map((products ?? []).map((product) => [product.id, product]))
  const productIds = [...productById.keys()]
  if (!productIds.length) return []
  const { data: questions, error } = await client.from('product_questions').select('id,body,created_at,asker_id,product_id,answer')
    .in('product_id', productIds).is('hidden_at', null).order('created_at', { ascending: false }).limit(100)
  fail(error)
  const askerIds = [...new Set((questions ?? []).map((question) => question.asker_id))]
  const { data: users, error: usersError } = askerIds.length ? await client.from('users').select('id,full_name').in('id', askerIds) : { data: [], error: null }
  fail(usersError)
  const askerById = new Map((users ?? []).map((member) => [member.id, member.full_name]))
  return (questions ?? []).map((question) => {
    const product = productById.get(question.product_id)!
    return { id: question.id, body: question.body, created_at: iso(new Date(question.created_at))!, asker: askerById.get(question.asker_id) ?? '',
      product_id: question.product_id, title: product.title, image: product.images?.[0] ?? null, answer: question.answer }
  }).sort((a, b) => Number(a.answer !== null) - Number(b.answer !== null) || b.created_at.localeCompare(a.created_at))
}

/** Requests from buyers waiting for the seller. */
export async function sellerRequests(user: Who) {
  const client = supabase()
  const { data: orders, error: ordersError } = await client.from('market_orders').select('id,number,total_pesewas').eq('seller_id', user.id)
  fail(ordersError)
  const orderById = new Map((orders ?? []).map((order) => [order.id, order]))
  const orderIds = [...orderById.keys()]
  if (!orderIds.length) return []
  const { data: requests, error } = await client.from('market_requests').select('id,order_id,kind,reason,details,created_at,buyer_id')
    .in('order_id', orderIds).eq('status', 'open').order('created_at')
  fail(error)
  const buyerIds = [...new Set((requests ?? []).map((request) => request.buyer_id).filter(Boolean))] as string[]
  const { data: users, error: usersError } = buyerIds.length ? await client.from('users').select('id,full_name').in('id', buyerIds) : { data: [], error: null }
  fail(usersError)
  const buyerById = new Map((users ?? []).map((member) => [member.id, member.full_name]))
  return (requests ?? []).map((request) => {
    const order = orderById.get(request.order_id)!
    return { id: request.id, order_id: request.order_id, number: order.number, kind: request.kind, reason: request.reason, details: request.details,
      created_at: iso(new Date(request.created_at))!, buyer: request.buyer_id ? buyerById.get(request.buyer_id) ?? null : null, total_pesewas: order.total_pesewas }
  })
}

/** Counts for the seller's order tabs. */
export async function orderCounts(user: Who) {
  const { data, error } = await supabase().from('market_orders').select('status').eq('seller_id', user.id).not('paid_at', 'is', null)
  fail(error)
  const counts: Record<string, number> = {}
  for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1
  return counts
}

/* ───────── Coupons ───────── */
export type CouponInput = { code: string; kind: 'percent' | 'amount'; value: number; minSpendGhs?: number; maxUses?: number | null; startsAt?: string | null; endsAt?: string | null; active?: boolean }
export type CouponFormError = 'no_shop' | 'not_found' | 'code' | 'code_taken' | 'value' | 'min' | 'uses' | 'dates'

export async function listCoupons(user: Who) {
  const shop = await myShop(user.id)
  if (!shop) return null
  const { data, error } = await supabase().from('coupons')
    .select('id,shop_id,code,kind,value,min_spend_pesewas,max_uses,used_count,starts_at,ends_at,active,created_by,created_at')
    .eq('shop_id', shop.id).order('active', { ascending: false }).order('created_at', { ascending: false })
  fail(error)
  return (data ?? []).map((coupon) => ({
    id: coupon.id, shopId: coupon.shop_id, code: coupon.code, kind: coupon.kind, value: coupon.value,
    minSpendPesewas: coupon.min_spend_pesewas, maxUses: coupon.max_uses, usedCount: coupon.used_count,
    startsAt: coupon.starts_at, endsAt: coupon.ends_at, active: coupon.active, createdBy: coupon.created_by, createdAt: coupon.created_at,
  }))
}

export async function saveCoupon(user: Who, i: CouponInput, id?: string): Promise<{ ok: true; id: string; error?: never } | { ok: false; error: CouponFormError }> {
  const shop = await myShop(user.id)
  if (!shop) return { ok: false, error: 'no_shop' }
  const code = i.code?.trim().toUpperCase() ?? ''
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) return { ok: false, error: 'code' }
  const value = i.kind === 'percent' ? Math.round(i.value) : Math.round(i.value * 100)
  if (i.kind === 'percent' ? !(value >= 1 && value <= 90) : !(value >= 100 && value <= 10_000_000)) return { ok: false, error: 'value' }
  const min = Math.round((i.minSpendGhs ?? 0) * 100)
  if (!Number.isFinite(min) || min < 0 || min > 10_000_000) return { ok: false, error: 'min' }
  if (i.maxUses != null && !(Number.isInteger(i.maxUses) && i.maxUses >= 1 && i.maxUses <= 1_000_000)) return { ok: false, error: 'uses' }
  const starts = i.startsAt ? new Date(i.startsAt) : null, ends = i.endsAt ? new Date(i.endsAt) : null
  if ((starts && Number.isNaN(starts.getTime())) || (ends && Number.isNaN(ends.getTime())) || (starts && ends && ends <= starts)) return { ok: false, error: 'dates' }
  const client = supabase()
  const values = { code, kind: i.kind, value, min_spend_pesewas: min, max_uses: i.maxUses ?? null, starts_at: starts?.toISOString() ?? null, ends_at: ends?.toISOString() ?? null, active: i.active ?? true }
  const { data: clash, error: clashError } = await client.from('coupons').select('id').eq('shop_id', shop.id).eq('code', code).limit(2)
  fail(clashError)
  if ((clash ?? []).some((coupon) => coupon.id !== id)) return { ok: false, error: 'code_taken' }
  if (id) {
    if (!isId(id)) return { ok: false, error: 'not_found' }
    const { data, error } = await client.from('coupons').update(values).eq('id', id).eq('shop_id', shop.id).select('id').maybeSingle()
    fail(error)
    return data ? { ok: true, id } : { ok: false, error: 'not_found' }
  }
  const { data, error } = await client.from('coupons').insert({ ...values, shop_id: shop.id, created_by: user.id }).select('id').single()
  if (error?.code === '23505') return { ok: false, error: 'code_taken' }
  fail(error)
  return { ok: true, id: data.id }
}

/** A coupon nobody used is deleted; a used one is switched off (orders still show it). */
export async function removeCoupon(user: Who, id: string) {
  const shop = await myShop(user.id)
  if (!shop || !isId(id)) return false
  const client = supabase()
  const { data: coupon, error } = await client.from('coupons').select('used_count').eq('id', id).eq('shop_id', shop.id).maybeSingle()
  fail(error)
  if (!coupon) return false
  const { count, error: ordersError } = await client.from('market_orders').select('id', { count: 'exact', head: true }).eq('coupon_id', id)
  fail(ordersError)
  if (coupon.used_count === 0 && !count) {
    const { error: deleteError } = await client.from('coupons').delete().eq('id', id)
    fail(deleteError)
  } else {
    const { error: updateError } = await client.from('coupons').update({ active: false }).eq('id', id)
    fail(updateError)
  }
  return true
}

/** All reviews of a shop's products (shop page). */
export async function shopReviews(shopId: string, limit = 30) {
  if (!isId(shopId)) return []
  const client = supabase()
  const { data: products, error: productsError } = await client.from('products').select('id,title').eq('shop_id', shopId).is('deleted_at', null)
  fail(productsError)
  const productById = new Map((products ?? []).map((product) => [product.id, product]))
  const productIds = [...productById.keys()]
  if (!productIds.length) return []
  const { data: reviews, error } = await client.from('product_reviews')
    .select('id,product_id,user_id,rating,body,created_at,seller_reply').in('product_id', productIds).is('hidden_at', null)
    .order('created_at', { ascending: false }).limit(limit)
  fail(error)
  const userIds = [...new Set((reviews ?? []).map((review) => review.user_id))]
  const { data: users, error: usersError } = userIds.length ? await client.from('users').select('id,full_name,username,avatar_url,status').in('id', userIds) : { data: [], error: null }
  fail(usersError)
  const userById = new Map((users ?? []).filter((user) => user.status === 'active').map((user) => [user.id, user]))
  return (reviews ?? []).filter((review) => userById.has(review.user_id)).map((review) => {
    const user = userById.get(review.user_id)!
    return { id: review.id, rating: review.rating, body: review.body, created_at: iso(new Date(review.created_at))!, seller_reply: review.seller_reply,
      name: user.full_name, username: user.username, avatar_url: user.avatar_url, product_id: review.product_id, title: productById.get(review.product_id)?.title ?? '' }
  })
}

/** A shop as the settings form expects it. */
export function shopToInput(s: MyShop): ShopInput {
  return {
    name: s.name, bio: s.bio, logoUrl: s.logoUrl, coverUrl: s.coverUrl, town: s.town, phone: s.phone, offersPickup: s.offersPickup, pickupAddress: s.pickupAddress,
    offersDelivery: s.offersDelivery, deliveryFeeGhs: s.deliveryFeePesewas / 100, freeDeliveryOverGhs: s.freeDeliveryOverPesewas != null ? s.freeDeliveryOverPesewas / 100 : null,
    deliveryNote: s.deliveryNote, returnDays: s.returnDays, payoutMethod: (s.payoutMethod as 'momo' | 'bank' | null) ?? null, payoutProvider: s.payoutProvider, payoutNumber: s.payoutNumber, payoutName: s.payoutName,
  }
}

/** Sales per day for the last 30 days (dashboard chart). */
export async function salesByDay(shopId: string) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const start = new Date(today.getTime() - 29 * 86_400_000)
  const { data, error } = await supabase().from('market_orders').select('paid_at,status,total_pesewas,refunded_pesewas')
    .eq('shop_id', shopId).gte('paid_at', start.toISOString()).not('paid_at', 'is', null).range(0, 49_999)
  fail(error)
  const byDay = new Map<string, { day: string; total: number; n: number }>()
  for (let i = 0; i < 30; i++) {
    const day = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10)
    byDay.set(day, { day, total: 0, n: 0 })
  }
  for (const order of data ?? []) {
    const day = new Date(order.paid_at!).toISOString().slice(0, 10)
    const entry = byDay.get(day)
    if (!entry) continue
    entry.n++
    if (order.status !== 'cancelled') entry.total += order.total_pesewas - order.refunded_pesewas
  }
  return [...byDay.values()]
}

/** Variants running low (dashboard). */
export async function lowStock(shopId: string, limit = 8) {
  const client = supabase()
  const { data: products, error: productsError } = await client.from('products').select('id,title,images').eq('shop_id', shopId).is('deleted_at', null).eq('status', 'active')
  fail(productsError)
  const productById = new Map((products ?? []).map((product) => [product.id, product]))
  const productIds = [...productById.keys()]
  if (!productIds.length) return []
  const { data: variants, error } = await client.from('product_variants').select('id,product_id,name,stock').in('product_id', productIds).eq('active', true).lte('stock', LOW_STOCK)
  fail(error)
  return (variants ?? []).map((variant) => ({
    id: variant.id, product_id: variant.product_id, title: productById.get(variant.product_id)?.title ?? '', name: variant.name,
    stock: variant.stock, image: productById.get(variant.product_id)?.images?.[0] ?? null,
  })).sort((a, b) => a.stock - b.stock || a.title.localeCompare(b.title)).slice(0, limit)
}

/** Every paid order line for a CSV download. */
export async function earningsCsvRows(user: Who) {
  const shop = await myShop(user.id)
  if (!shop) return null
  const client = supabase()
  const { data: orders, error } = await client.from('market_orders')
    .select('number,paid_at,status,buyer_id,subtotal_pesewas,delivery_fee_pesewas,discount_pesewas,total_pesewas,fee_pesewas,refunded_pesewas,seller_net_pesewas,escrow')
    .eq('shop_id', shop.id).not('paid_at', 'is', null).order('paid_at', { ascending: false }).limit(50000)
  fail(error)
  const buyerIds = [...new Set((orders ?? []).map((order) => order.buyer_id).filter(Boolean))] as string[]
  const { data: buyers, error: buyersError } = buyerIds.length ? await client.from('users').select('id,full_name').in('id', buyerIds) : { data: [], error: null }
  fail(buyersError)
  const buyerById = new Map((buyers ?? []).map((buyer) => [buyer.id, buyer.full_name]))
  return (orders ?? []).map((order) => ({ ...order, buyer: order.buyer_id ? buyerById.get(order.buyer_id) ?? null : null }))
}
