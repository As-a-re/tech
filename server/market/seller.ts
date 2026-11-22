import 'server-only'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
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

export async function myShop(userId: string) {
  const [s] = await db.select().from(schema.shops).where(and(eq(schema.shops.ownerId, userId), isNull(schema.shops.deletedAt)))
  return s ?? null
}
export type MyShop = NonNullable<Awaited<ReturnType<typeof myShop>>>

async function freeSlug(name: string, keep?: string) {
  const base = slugify(name).replace(/[^a-z0-9-]/g, '').slice(0, 50).replace(/^-+|-+$/g, '') || 'shop'
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${base}-${i + 1}` : base
    if (slug === keep) return slug
    if (!(await db.$count(schema.shops, eq(schema.shops.slug, slug)))) return slug
  }
  return `${base}-${Date.now().toString(36)}`
}

const pes = (ghs: number | null | undefined) => (ghs == null ? null : Math.round(ghs * 100))

function checkShop(i: ShopInput): { ok: false; error: ShopError } | { ok: true; values: Partial<typeof schema.shops.$inferInsert> } {
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
  let payout: Pick<typeof schema.shops.$inferInsert, 'payoutMethod' | 'payoutProvider' | 'payoutNumber' | 'payoutName'> = { payoutMethod: null, payoutProvider: null, payoutNumber: null, payoutName: null }
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
  const [u] = await db.select({ a: schema.users.assemblyId }).from(schema.users).where(eq(schema.users.id, user.id))
  const slug = await freeSlug(c.values.name!)
  try {
    await db.insert(schema.shops).values({ ...c.values, name: c.values.name!, ownerId: user.id, slug, assemblyId: u.a, termsAcceptedAt: new Date() })
  } catch { return { ok: false, error: 'exists' } }
  return { ok: true, slug }
}

export async function updateShop(user: Who, i: ShopInput): Promise<{ ok: true; slug: string; error?: never } | { ok: false; error: ShopError }> {
  const s = await myShop(user.id)
  if (!s) return { ok: false, error: 'no_shop' }
  const c = checkShop(i)
  if (!c.ok) return { ok: false, error: 'error' in c ? c.error : 'name' }
  await db.update(schema.shops).set(c.values).where(eq(schema.shops.id, s.id))
  return { ok: true, slug: s.slug }
}

/** Take a break (items hidden, orders still handled) or open again. A suspended shop stays suspended. */
export async function setShopPaused(user: Who, paused: boolean) {
  const s = await myShop(user.id)
  if (!s) return { ok: false as const, error: 'no_shop' as const }
  if (s.status === 'suspended') return { ok: false as const, error: 'suspended' as const }
  await db.update(schema.shops).set({ status: paused ? 'paused' : 'active' }).where(eq(schema.shops.id, s.id))
  return { ok: true as const }
}

const OPEN = sql.raw(`('paid', 'accepted', 'packed', 'shipped')`)

/** Close the shop for good (only when no order is still in progress). Items leave every cart. */
export async function closeShop(user: Who) {
  const s = await myShop(user.id)
  if (!s) return { ok: false as const, error: 'no_shop' as const }
  const open = await db.execute(sql`select 1 from market_orders where shop_id = ${s.id} and status in ${OPEN} limit 1`)
  const req = await db.execute(sql`select 1 from market_requests r join market_orders o on o.id = r.order_id where o.shop_id = ${s.id} and r.status = 'open' limit 1`)
  if (open.rows.length || req.rows.length) return { ok: false as const, error: 'open_orders' as const }
  await db.update(schema.shops).set({ deletedAt: sql`now()` }).where(eq(schema.shops.id, s.id))
  await db.execute(sql`delete from cart_items c using product_variants v, products p where c.variant_id = v.id and v.product_id = p.id and p.shop_id = ${s.id}`)
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
  const r = await db.execute<{ id: string; shop_id: string; status: 'active' | 'draft' | 'removed'; published_at: Date | null; title: string }>(sql`select p.id, p.shop_id, p.status, p.published_at, p.title
    from products p join shops s on s.id = p.shop_id where p.id = ${productId} and p.deleted_at is null and s.owner_id = ${user.id} and s.deleted_at is null`)
  return r.rows[0] ?? null
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
  const values = { title, description: i.description?.trim() ?? '', category: i.category, condition: i.condition, images, optionNames: names, pricePesewas: minPrice,
    compareAtPesewas: compareAt, dealEndsAt: dealEnds, status, updatedAt: sql`now()`, ...(firstPublish ? { publishedAt: sql`now()` } : {}) } as const
  const pid = await db.transaction(async (tx) => {
    let pid = old?.id
    if (pid) await tx.update(schema.products).set(values).where(eq(schema.products.id, pid))
    else pid = (await tx.insert(schema.products).values({ ...values, shopId: shop.id }).returning({ id: schema.products.id }))[0].id
    const existing = await tx.select({ id: schema.productVariants.id, options: schema.productVariants.options }).from(schema.productVariants).where(eq(schema.productVariants.productId, pid))
    const kept = new Set<string>()
    for (const [pos, v] of vs.entries()) {
      // Same id, or the same choices as an earlier variant: update it (keeps carts and alerts)
      const match = existing.find((e) => e.id === v.id) ?? existing.find((e) => !kept.has(e.id) && JSON.stringify(e.options) === JSON.stringify(v.options))
      const row = { name: names.map((n) => v.options[n]).join(' / '), options: v.options, pricePesewas: v.price, stock: v.stock, sku: v.sku, position: pos, active: true }
      if (match) { kept.add(match.id); await tx.update(schema.productVariants).set(row).where(eq(schema.productVariants.id, match.id)) }
      else kept.add((await tx.insert(schema.productVariants).values({ ...row, productId: pid }).returning({ id: schema.productVariants.id }))[0].id)
    }
    const gone = existing.filter((e) => !kept.has(e.id)).map((e) => e.id)
    if (gone.length) await tx.update(schema.productVariants).set({ active: false }).where(inArray(schema.productVariants.id, gone))
    return pid
  })
  if (status === 'active') { await fireStockAlerts(pid).catch(() => {}); await firePriceAlerts(pid).catch(() => {}) }
  if (firstPublish && shop.status === 'active') {
    const followers = await db.select({ u: schema.shopFollows.userId }).from(schema.shopFollows).where(eq(schema.shopFollows.shopId, shop.id)).limit(5000)
    for (const f of followers) await notify(f.u, 'market_new', user.id, null, { productId: pid }).catch(() => {})
  }
  return { ok: true, id: pid }
}

/** For the edit form. */
export async function productForEdit(user: Who, productId: string) {
  const p = await ownProduct(user, productId)
  if (!p) return null
  const [row] = await db.select().from(schema.products).where(eq(schema.products.id, p.id))
  const variants = await db.select().from(schema.productVariants).where(and(eq(schema.productVariants.productId, p.id), eq(schema.productVariants.active, true))).orderBy(schema.productVariants.position)
  return {
    id: row.id, status: row.status, input: {
      title: row.title, description: row.description, category: row.category, condition: row.condition, images: row.images, optionNames: row.optionNames,
      variants: variants.map((v) => ({ id: v.id, options: v.options, priceGhs: v.pricePesewas / 100, stock: v.stock, sku: v.sku })),
      compareAtGhs: row.compareAtPesewas ? row.compareAtPesewas / 100 : null, dealEndsAt: row.dealEndsAt ? iso(row.dealEndsAt)!.slice(0, 10) : null,
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
    const [x] = await db.select({ images: schema.products.images }).from(schema.products).where(eq(schema.products.id, p.id))
    if (!x.images.length) return { ok: false as const, error: 'images' as const }
    const first = !p.published_at
    await db.update(schema.products).set({ status, updatedAt: sql`now()`, ...(first ? { publishedAt: sql`now()` } : {}) }).where(eq(schema.products.id, p.id))
    await fireStockAlerts(p.id).catch(() => {})
    if (first) {
      const followers = await db.select({ u: schema.shopFollows.userId }).from(schema.shopFollows).where(eq(schema.shopFollows.shopId, p.shop_id)).limit(5000)
      for (const f of followers) await notify(f.u, 'market_new', user.id, null, { productId: p.id }).catch(() => {})
    }
  } else await db.update(schema.products).set({ status, updatedAt: sql`now()` }).where(eq(schema.products.id, p.id))
  return { ok: true as const }
}

/** Deleting hides the listing for good and takes it out of carts (past orders keep their copy). */
export async function deleteListing(user: Who, productId: string) {
  const p = await ownProduct(user, productId)
  if (!p) return false
  await db.update(schema.products).set({ deletedAt: sql`now()` }).where(eq(schema.products.id, p.id))
  await db.execute(sql`delete from cart_items c using product_variants v where c.variant_id = v.id and v.product_id = ${p.id}`)
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
  const r = await db.execute<{ product_id: string }>(sql`update product_variants v set stock = ${stock} from products p, shops s
    where v.id = ${variantId} and p.id = v.product_id and s.id = p.shop_id and s.owner_id = ${user.id} and p.deleted_at is null returning v.product_id`)
  if (!r.rows[0]) return false
  await fireStockAlerts(r.rows[0].product_id).catch(() => {})
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
  const t = o.q?.trim() ? `%${o.q.trim().replace(/[%_\\]/g, '')}%` : null
  const f = o.status === 'active' ? sql`and p.status = 'active'` : o.status === 'draft' ? sql`and p.status = 'draft'` : o.status === 'removed' ? sql`and p.status = 'removed'`
    : o.status === 'low' ? sql`and p.status <> 'removed' and (select coalesce(sum(v.stock), 0) from product_variants v where v.product_id = p.id and v.active) <= ${LOW_STOCK}` : sql``
  const r = await db.execute<{ id: string; title: string; image: string | null; status: ListingRow['status']; price: number; was: number | null; stock: number; sold: number; views: number; rating_sum: number; rating_count: number; updated_at: Date; variants: { id: string; name: string; stock: number }[] }>(sql`
    select p.id, p.title, p.images ->> 0 as image, p.status, p.price_pesewas as price, p.compare_at_pesewas as was, p.sold_count as sold, p.view_count as views, p.rating_sum, p.rating_count, p.updated_at,
      (select coalesce(sum(v.stock), 0)::int from product_variants v where v.product_id = p.id and v.active) as stock,
      (select coalesce(json_agg(json_build_object('id', v.id, 'name', v.name, 'stock', v.stock) order by v.position), '[]'::json) from product_variants v where v.product_id = p.id and v.active) as variants
    from products p where p.shop_id = ${shop.id} and p.deleted_at is null ${f} ${t ? sql`and p.title ilike ${t}` : sql``} order by p.updated_at desc limit 500`)
  return {
    shop, rows: r.rows.map((x): ListingRow => ({ id: x.id, title: x.title, image: x.image, status: x.status, pricePesewas: x.price, compareAtPesewas: x.was, stock: x.stock, sold: x.sold, views: x.views,
      rating: x.rating_count ? Math.round((x.rating_sum / x.rating_count) * 10) / 10 : null, ratingCount: x.rating_count, updatedAt: iso(x.updated_at)!, variants: x.variants })),
  }
}

/* ───────── Dashboard and earnings ───────── */
export async function dashboard(user: Who) {
  const shop = await myShop(user.id)
  if (!shop) return null
  const [s] = (await db.execute<{
    sales: number; orders: number; to_accept: number; to_pack: number; to_ship: number; shipped: number; requests: number; questions: number; held: number; fees: number
    products: number; drafts: number; low: number; views: number; followers: number; rating_sum: number; rating_count: number
  }>(sql`select
    (select coalesce(sum(total_pesewas - refunded_pesewas), 0)::int from market_orders where shop_id = ${shop.id} and paid_at > now() - interval '30 days' and status <> 'cancelled') as sales,
    (select count(*)::int from market_orders where shop_id = ${shop.id} and paid_at > now() - interval '30 days') as orders,
    (select count(*)::int from market_orders where shop_id = ${shop.id} and status = 'paid') as to_accept,
    (select count(*)::int from market_orders where shop_id = ${shop.id} and status = 'accepted') as to_pack,
    (select count(*)::int from market_orders where shop_id = ${shop.id} and status = 'packed') as to_ship,
    (select count(*)::int from market_orders where shop_id = ${shop.id} and status = 'shipped') as shipped,
    (select count(*)::int from market_requests r join market_orders o on o.id = r.order_id where o.shop_id = ${shop.id} and r.status = 'open') as requests,
    (select count(*)::int from product_questions q join products p on p.id = q.product_id where p.shop_id = ${shop.id} and q.answer is null and q.hidden_at is null and p.deleted_at is null) as questions,
    (select coalesce(sum(seller_net_pesewas), 0)::int from market_orders where shop_id = ${shop.id} and escrow = 'held' and status <> 'cancelled') as held,
    (select coalesce(sum(fee_pesewas), 0)::int from market_orders where shop_id = ${shop.id} and paid_at > now() - interval '30 days' and status <> 'cancelled') as fees,
    (select count(*)::int from products where shop_id = ${shop.id} and deleted_at is null and status = 'active') as products,
    (select count(*)::int from products where shop_id = ${shop.id} and deleted_at is null and status = 'draft') as drafts,
    (select count(*)::int from products p where p.shop_id = ${shop.id} and p.deleted_at is null and p.status = 'active'
      and (select coalesce(sum(v.stock), 0) from product_variants v where v.product_id = p.id and v.active) <= ${LOW_STOCK}) as low,
    (select coalesce(sum(view_count), 0)::int from products where shop_id = ${shop.id} and deleted_at is null) as views,
    (select count(*)::int from shop_follows where shop_id = ${shop.id}) as followers,
    (select coalesce(sum(rating_sum), 0)::int from products where shop_id = ${shop.id} and deleted_at is null) as rating_sum,
    (select coalesce(sum(rating_count), 0)::int from products where shop_id = ${shop.id} and deleted_at is null) as rating_count`)).rows
  return { shop, ...s, rating: s.rating_count ? Math.round((s.rating_sum / s.rating_count) * 10) / 10 : null }
}

/** Money: held for the seller (paid out after delivery, Batch 18), already paid, fees and refunds; one line per order. */
export async function earnings(user: Who, page = 1) {
  const shop = await myShop(user.id)
  if (!shop) return null
  const [t] = (await db.execute<{ held: number; released: number; fees: number; refunded: number; gross: number }>(sql`select
    coalesce(sum(seller_net_pesewas) filter (where escrow = 'held' and status <> 'cancelled'), 0)::int as held,
    coalesce(sum(seller_net_pesewas) filter (where escrow = 'released'), 0)::int as released,
    coalesce(sum(fee_pesewas) filter (where status <> 'cancelled'), 0)::int as fees,
    coalesce(sum(refunded_pesewas), 0)::int as refunded,
    coalesce(sum(total_pesewas) filter (where status <> 'cancelled'), 0)::int as gross
    from market_orders where shop_id = ${shop.id} and paid_at is not null`)).rows
  const PAGE = 30, p = Math.max(1, page)
  const r = await db.execute<{ id: string; number: string; status: string; total_pesewas: number; fee_pesewas: number; refunded_pesewas: number; seller_net_pesewas: number; escrow: string | null; paid_at: Date }>(sql`
    select id, number, status, total_pesewas, fee_pesewas, refunded_pesewas, seller_net_pesewas, escrow, paid_at from market_orders where shop_id = ${shop.id} and paid_at is not null
    order by paid_at desc limit ${PAGE + 1} offset ${(p - 1) * PAGE}`)
  return { shop, ...t, rows: r.rows.slice(0, PAGE).map((x) => ({ ...x, paid_at: iso(x.paid_at)! })), page: p, hasMore: r.rows.length > PAGE }
}

export async function unansweredQuestions(user: Who) {
  const r = await db.execute<{ id: string; body: string; created_at: Date; asker: string; product_id: string; title: string; image: string | null; answer: string | null }>(sql`
    select q.id, q.body, q.created_at, u.full_name as asker, p.id as product_id, p.title, p.images ->> 0 as image, q.answer
    from product_questions q join products p on p.id = q.product_id join shops s on s.id = p.shop_id join users u on u.id = q.asker_id
    where s.owner_id = ${user.id} and s.deleted_at is null and p.deleted_at is null and q.hidden_at is null
    order by (q.answer is null) desc, q.created_at desc limit 100`)
  return r.rows.map((x) => ({ ...x, created_at: iso(x.created_at)! }))
}

/** Requests from buyers waiting for the seller. */
export async function sellerRequests(user: Who) {
  const r = await db.execute<{ id: string; order_id: string; number: string; kind: string; reason: string; details: string | null; created_at: Date; buyer: string | null; total_pesewas: number }>(sql`
    select r.id, r.order_id, o.number, r.kind, r.reason, r.details, r.created_at, (select u.full_name from users u where u.id = r.buyer_id) as buyer, o.total_pesewas
    from market_requests r join market_orders o on o.id = r.order_id where o.seller_id = ${user.id} and r.status = 'open' order by r.created_at`)
  return r.rows.map((x) => ({ ...x, created_at: iso(x.created_at)! }))
}

/** Counts for the seller's order tabs. */
export async function orderCounts(user: Who) {
  const r = await db.execute<{ status: string; n: number }>(sql`select status, count(*)::int as n from market_orders where seller_id = ${user.id} and paid_at is not null group by 1`)
  return Object.fromEntries(r.rows.map((x) => [x.status, x.n])) as Record<string, number>
}

/* ───────── Coupons ───────── */
export type CouponInput = { code: string; kind: 'percent' | 'amount'; value: number; minSpendGhs?: number; maxUses?: number | null; startsAt?: string | null; endsAt?: string | null; active?: boolean }
export type CouponFormError = 'no_shop' | 'not_found' | 'code' | 'code_taken' | 'value' | 'min' | 'uses' | 'dates'

export async function listCoupons(user: Who) {
  const shop = await myShop(user.id)
  if (!shop) return null
  const rows = await db.select().from(schema.coupons).where(eq(schema.coupons.shopId, shop.id)).orderBy(desc(schema.coupons.active), desc(schema.coupons.createdAt))
  return rows.map((c) => ({ ...c, startsAt: iso(c.startsAt), endsAt: iso(c.endsAt), createdAt: iso(c.createdAt)! }))
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
  const values = { code, kind: i.kind, value, minSpendPesewas: min, maxUses: i.maxUses ?? null, startsAt: starts, endsAt: ends, active: i.active ?? true }
  const clash = await db.select({ id: schema.coupons.id }).from(schema.coupons).where(and(eq(schema.coupons.shopId, shop.id), eq(schema.coupons.code, code)))
  if (clash.some((c) => c.id !== id)) return { ok: false, error: 'code_taken' }
  if (id) {
    if (!isId(id)) return { ok: false, error: 'not_found' }
    const r = await db.update(schema.coupons).set(values).where(and(eq(schema.coupons.id, id), eq(schema.coupons.shopId, shop.id))).returning({ id: schema.coupons.id })
    return r.length ? { ok: true, id } : { ok: false, error: 'not_found' }
  }
  const [c] = await db.insert(schema.coupons).values({ ...values, shopId: shop.id, createdBy: user.id }).returning({ id: schema.coupons.id })
  return { ok: true, id: c.id }
}

/** A coupon nobody used is deleted; a used one is switched off (orders still show it). */
export async function removeCoupon(user: Who, id: string) {
  const shop = await myShop(user.id)
  if (!shop || !isId(id)) return false
  const [c] = await db.select().from(schema.coupons).where(and(eq(schema.coupons.id, id), eq(schema.coupons.shopId, shop.id)))
  if (!c) return false
  if (c.usedCount === 0 && !(await db.$count(schema.marketOrders, eq(schema.marketOrders.couponId, id)))) await db.delete(schema.coupons).where(eq(schema.coupons.id, id))
  else await db.update(schema.coupons).set({ active: false }).where(eq(schema.coupons.id, id))
  return true
}

/** All reviews of a shop's products (shop page). */
export async function shopReviews(shopId: string, limit = 30) {
  if (!isId(shopId)) return []
  const r = await db.execute<{ id: string; rating: number; body: string; created_at: Date; seller_reply: string | null; name: string; username: string; avatar_url: string | null; product_id: string; title: string }>(sql`
    select r.id, r.rating, r.body, r.created_at, r.seller_reply, u.full_name as name, u.username, u.avatar_url, p.id as product_id, p.title
    from product_reviews r join products p on p.id = r.product_id join users u on u.id = r.user_id
    where p.shop_id = ${shopId} and p.deleted_at is null and r.hidden_at is null and u.status = 'active' order by r.created_at desc limit ${limit}`)
  return r.rows.map((x) => ({ ...x, created_at: iso(x.created_at)! }))
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
  const r = await db.execute<{ day: string; total: number; n: number }>(sql`select to_char(d, 'YYYY-MM-DD') as day,
      coalesce((select sum(o.total_pesewas - o.refunded_pesewas) from market_orders o where o.shop_id = ${shopId} and o.status <> 'cancelled' and o.paid_at >= d and o.paid_at < d + interval '1 day'), 0)::int as total,
      (select count(*)::int from market_orders o where o.shop_id = ${shopId} and o.paid_at >= d and o.paid_at < d + interval '1 day') as n
    from generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d order by d`)
  return r.rows
}

/** Variants running low (dashboard). */
export async function lowStock(shopId: string, limit = 8) {
  const r = await db.execute<{ id: string; product_id: string; title: string; name: string; stock: number; image: string | null }>(sql`
    select v.id, p.id as product_id, p.title, v.name, v.stock, p.images ->> 0 as image from product_variants v join products p on p.id = v.product_id
    where p.shop_id = ${shopId} and p.deleted_at is null and p.status = 'active' and v.active and v.stock <= ${LOW_STOCK} order by v.stock, p.title limit ${limit}`)
  return r.rows
}

/** Every paid order line for a CSV download. */
export async function earningsCsvRows(user: Who) {
  const shop = await myShop(user.id)
  if (!shop) return null
  const r = await db.execute<{ number: string; paid_at: Date; status: string; buyer: string | null; subtotal_pesewas: number; delivery_fee_pesewas: number; discount_pesewas: number; total_pesewas: number; fee_pesewas: number; refunded_pesewas: number; seller_net_pesewas: number; escrow: string | null }>(sql`
    select o.number, o.paid_at, o.status, (select u.full_name from users u where u.id = o.buyer_id) as buyer, o.subtotal_pesewas, o.delivery_fee_pesewas, o.discount_pesewas, o.total_pesewas,
      o.fee_pesewas, o.refunded_pesewas, o.seller_net_pesewas, o.escrow from market_orders o where o.shop_id = ${shop.id} and o.paid_at is not null order by o.paid_at desc limit 50000`)
  return r.rows
}
