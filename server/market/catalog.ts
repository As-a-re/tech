import 'server-only'
import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'
import { db, schema } from '@/db'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { hit } from '@/server/identity/rate-limit'
import { notify } from '@/server/notifications/notify'
import { CATEGORY_KEYS, isCategory, type CategoryKey, type SortKey } from '@/lib/market/categories'
import { iso, isId, VISIBLE, type Who } from './shared'
const VISIBLE_SQL = sql.raw(VISIBLE)

/* ───────── Product cards (lists, grids, carousels) ───────── */
export type ProductCard = {
  id: string; title: string; image: string | null; pricePesewas: number; compareAtPesewas: number | null; rating: number | null; ratingCount: number
  soldCount: number; inStock: boolean; condition: 'new' | 'used' | 'refurbished'; category: string; shopName: string; shopSlug: string; town: string | null
}
type CardRow = {
  id: string; title: string; image: string | null; price: number; was: number | null; rating_sum: number; rating_count: number; sold: number
  in_stock: boolean; condition: ProductCard['condition']; category: string; shop_name: string; shop_slug: string; town: string | null
}
const CARD_COLS = sql.raw(`p.id, p.title, p.images ->> 0 as image, p.price_pesewas as price,
  case when p.compare_at_pesewas > p.price_pesewas and (p.deal_ends_at is null or p.deal_ends_at > now()) then p.compare_at_pesewas end as was,
  p.rating_sum, p.rating_count, p.sold_count as sold, p.condition, p.category, s.name as shop_name, s.slug as shop_slug, s.town,
  exists (select 1 from product_variants v where v.product_id = p.id and v.active and v.stock > 0) as in_stock`)
const FROM = sql.raw(`from products p join shops s on s.id = p.shop_id join users u on u.id = s.owner_id`)
const toCard = (r: CardRow): ProductCard => ({
  id: r.id, title: r.title, image: r.image, pricePesewas: r.price, compareAtPesewas: r.was, rating: r.rating_count ? Math.round((r.rating_sum / r.rating_count) * 10) / 10 : null,
  ratingCount: r.rating_count, soldCount: r.sold, inStock: r.in_stock, condition: r.condition, category: r.category, shopName: r.shop_name, shopSlug: r.shop_slug, town: r.town,
})

export type ListOptions = {
  q?: string; category?: string | null; minPesewas?: number | null; maxPesewas?: number | null; condition?: string | null; inStock?: boolean; deals?: boolean
  delivery?: boolean; districtId?: string | null; ratingMin?: number | null; shopId?: string | null; sort?: SortKey; page?: number; limit?: number
  excludeId?: string | null; ids?: string[]; since?: Date | null
}

/** Search and browse with filters. Only products members may see (active product, active shop, active owner). */
export async function listProducts(o: ListOptions = {}): Promise<{ items: ProductCard[]; page: number; hasMore: boolean }> {
  const page = Math.max(1, Math.min(200, o.page ?? 1))
  const limit = Math.min(60, Math.max(1, o.limit ?? 24))
  const ids = o.ids?.filter(isId) ?? null
  if (o.ids && !ids?.length) return { items: [], page, hasMore: false }
  const { data, error } = await createSupabaseAdminClient().rpc('papa_market_list_products', {
    p_query: (o.q ?? '').trim().toLowerCase().replace(/[%_\\]/g, '').split(/\s+/).filter(Boolean).slice(0, 6).join(' ') || null,
    p_category: o.category && isCategory(o.category) ? o.category : null,
    p_min_pesewas: o.minPesewas != null && o.minPesewas > 0 ? Math.round(o.minPesewas) : null,
    p_max_pesewas: o.maxPesewas != null && o.maxPesewas > 0 ? Math.round(o.maxPesewas) : null,
    p_condition: o.condition === 'new' || o.condition === 'used' || o.condition === 'refurbished' ? o.condition : null,
    p_in_stock: !!o.inStock,
    p_deals: !!o.deals,
    p_delivery: !!o.delivery,
    p_district_id: o.districtId && isId(o.districtId) ? o.districtId : null,
    p_rating_min: o.ratingMin ?? null,
    p_shop_id: o.shopId && isId(o.shopId) ? o.shopId : null,
    p_sort: o.sort ?? 'best',
    p_page: page,
    p_limit: limit,
    p_exclude_id: o.excludeId && isId(o.excludeId) ? o.excludeId : null,
    p_ids: ids,
    p_since: o.since?.toISOString() ?? null,
  })
  if (error) throw new Error(`Unable to list market products: ${error.message}`)
  const rows = (data ?? []) as CardRow[]
  return { items: rows.slice(0, limit).map(toCard), page, hasMore: rows.length > limit }
}

/** Category tiles with how many products each has. */
export async function categoryCounts() {
  const { data, error } = await createSupabaseAdminClient().rpc('papa_market_category_counts')
  if (error) throw new Error(`Unable to load market categories: ${error.message}`)
  const m = new Map(((data ?? []) as { category: string; n: number | string }[]).map((x) => [x.category, Number(x.n)]))
  return CATEGORY_KEYS.map((k) => ({ key: k as CategoryKey, n: m.get(k) ?? 0 }))
}

/* ───────── Market home ───────── */
export async function marketHome(viewer: { id: string; districtId?: string | null } | null) {
  const [deals, fresh, popular] = await Promise.all([
    listProducts({ deals: true, sort: 'popular', limit: 12 }),
    listProducts({ sort: 'newest', limit: 12 }),
    listProducts({ sort: 'popular', limit: 12 }),
  ])
  let recent: ProductCard[] = [], recommended: ProductCard[] = [], fromFollowed: ProductCard[] = [], near: ProductCard[] = []
  if (viewer) {
    recent = await recentlyViewedCards(viewer.id, 12)
    // Recommended: the categories the member looks at, saves and buys, not already viewed; then popular near them
    const cats = await db.execute<{ category: string }>(sql`select category from (
        select p.category, count(*) as n from recently_viewed r join products p on p.id = r.product_id where r.user_id = ${viewer.id} group by 1
        union all select p.category, count(*) * 2 from wishlist_items w join products p on p.id = w.product_id where w.user_id = ${viewer.id} group by 1
        union all select p.category, count(*) * 3 from market_order_items i join market_orders o on o.id = i.order_id join products p on p.id = i.product_id where o.buyer_id = ${viewer.id} group by 1
      ) x group by category order by sum(n) desc limit 3`)
    const seen = new Set(recent.map((x) => x.id))
    for (const c of cats.rows) {
      const more = await listProducts({ category: c.category, sort: 'popular', limit: 8 })
      for (const p of more.items) if (!seen.has(p.id) && recommended.length < 12) { recommended.push(p); seen.add(p.id) }
    }
    if (viewer.districtId) near = (await listProducts({ districtId: viewer.districtId, sort: 'popular', limit: 12 })).items
    const followed = await db.execute<{ id: string }>(sql`select f.shop_id as id from shop_follows f where f.user_id = ${viewer.id}`)
    if (followed.rows.length) {
      const items = await db.execute<CardRow>(sql`select ${CARD_COLS} ${FROM} where ${VISIBLE_SQL} and p.shop_id in ${followed.rows.map((x) => x.id)}
        and p.created_at > now() - interval '60 days' order by p.created_at desc limit 12`)
      fromFollowed = items.rows.map(toCard)
    }
    for (const p of popular.items) if (recommended.length < 8 && !seen.has(p.id)) { recommended.push(p); seen.add(p.id) }
  }
  return { deals: deals.items, fresh: fresh.items, popular: popular.items, recent, recommended, fromFollowed, near, categories: await categoryCounts() }
}

export async function recentlyViewedCards(userId: string, limit = 24) {
  const r = await db.execute<CardRow>(sql`select ${CARD_COLS} ${FROM} join recently_viewed rv on rv.product_id = p.id and rv.user_id = ${userId}
    where ${VISIBLE_SQL} order by rv.viewed_at desc limit ${limit}`)
  return r.rows.map(toCard)
}

/* ───────── Product page ───────── */
export type Variant = { id: string; name: string; options: Record<string, string>; pricePesewas: number; stock: number }
export type QuestionView = { id: string; body: string; answer: string | null; answeredAt: string | null; createdAt: string; asker: string; askerUsername: string; mine: boolean }
export type ReviewView = { id: string; rating: number; body: string; createdAt: string; sellerReply: string | null; name: string; username: string; avatarUrl: string | null; mine: boolean }

export async function getProduct(id: string, viewer: Who | null) {
  if (!isId(id)) return null
  const r = await db.execute<{
    id: string; title: string; description: string; category: string; condition: ProductCard['condition']; images: string[]; option_names: string[]; price: number
    compare_at: number | null; deal_ends_at: Date | null; rating_sum: number; rating_count: number; sold: number; status: 'active' | 'draft' | 'removed'; created_at: Date; deleted: boolean
    shop_id: string; shop_name: string; shop_slug: string; shop_logo: string | null; shop_town: string | null; shop_status: string; owner_id: string; owner_status: string
    owner_username: string; owner_name: string; offers_pickup: boolean; offers_delivery: boolean; delivery_fee: number; free_over: number | null; delivery_note: string | null
    pickup_address: string | null; return_days: number; shop_verified: boolean; assembly_name: string | null
  }>(sql`select p.id, p.title, p.description, p.category, p.condition, p.images, p.option_names, p.price_pesewas as price, p.compare_at_pesewas as compare_at, p.deal_ends_at,
      p.rating_sum, p.rating_count, p.sold_count as sold, p.status, p.created_at, p.deleted_at is not null as deleted,
      s.id as shop_id, s.name as shop_name, s.slug as shop_slug, s.logo_url as shop_logo, s.town as shop_town, s.status as shop_status, s.owner_id, u.status as owner_status,
      u.username as owner_username, u.full_name as owner_name, s.offers_pickup, s.offers_delivery, s.delivery_fee_pesewas as delivery_fee, s.free_delivery_over_pesewas as free_over,
      s.delivery_note, s.pickup_address, s.return_days, s.verified_at is not null as shop_verified, (select a.name from assemblies a where a.id = s.assembly_id) as assembly_name
    from products p join shops s on s.id = p.shop_id join users u on u.id = s.owner_id where p.id = ${id} and s.deleted_at is null`)
  const p = r.rows[0]
  if (!p || p.deleted) return null
  const isOwner = viewer?.id === p.owner_id
  const isAdmin = viewer?.role === 'tech_admin'
  const visible = p.status === 'active' && p.shop_status === 'active' && p.owner_status === 'active'
  if (!visible && !isOwner && !isAdmin) return null
  const variants = await db.select({ id: schema.productVariants.id, name: schema.productVariants.name, options: schema.productVariants.options, pricePesewas: schema.productVariants.pricePesewas, stock: schema.productVariants.stock })
    .from(schema.productVariants).where(and(eq(schema.productVariants.productId, id), eq(schema.productVariants.active, true))).orderBy(schema.productVariants.position, schema.productVariants.pricePesewas)
  const stars = await db.execute<{ rating: number; n: number }>(sql`select rating, count(*)::int as n from product_reviews where product_id = ${id} and hidden_at is null group by 1`)
  const [flags] = viewer ? (await db.execute<{ wished: boolean; stock_alert: boolean; price_alert: boolean; following: boolean; in_cart: number }>(sql`select
      exists (select 1 from wishlist_items w where w.user_id = ${viewer.id} and w.product_id = ${id}) as wished,
      exists (select 1 from product_alerts a where a.user_id = ${viewer.id} and a.product_id = ${id} and a.kind = 'stock' and a.notified_at is null) as stock_alert,
      exists (select 1 from product_alerts a where a.user_id = ${viewer.id} and a.product_id = ${id} and a.kind = 'price' and a.notified_at is null) as price_alert,
      exists (select 1 from shop_follows f where f.user_id = ${viewer.id} and f.shop_id = ${p.shop_id}) as following,
      (select coalesce(sum(c.qty), 0)::int from cart_items c join product_variants v on v.id = c.variant_id where c.user_id = ${viewer.id} and v.product_id = ${id} and not c.saved_for_later) as in_cart`)).rows : []
  const dealOn = !!p.compare_at && p.compare_at > p.price && (!p.deal_ends_at || p.deal_ends_at > new Date())
  return {
    id: p.id, title: p.title, description: p.description, category: p.category, condition: p.condition, images: p.images, optionNames: p.option_names,
    pricePesewas: p.price, compareAtPesewas: dealOn ? p.compare_at : null, dealEndsAt: dealOn ? iso(p.deal_ends_at) : null,
    rating: p.rating_count ? Math.round((p.rating_sum / p.rating_count) * 10) / 10 : null, ratingCount: p.rating_count, soldCount: p.sold, status: p.status, visible, createdAt: iso(p.created_at)!,
    stars: [5, 4, 3, 2, 1].map((n) => ({ n, count: stars.rows.find((x) => x.rating === n)?.n ?? 0 })),
    variants, inStock: variants.some((v) => v.stock > 0), stockTotal: variants.reduce((a, v) => a + v.stock, 0),
    shop: {
      id: p.shop_id, name: p.shop_name, slug: p.shop_slug, logoUrl: p.shop_logo, town: p.shop_town, assemblyName: p.assembly_name, verified: p.shop_verified, ownerId: p.owner_id,
      ownerUsername: p.owner_username, ownerName: p.owner_name, offersPickup: p.offers_pickup, offersDelivery: p.offers_delivery, deliveryFeePesewas: p.delivery_fee,
      freeDeliveryOverPesewas: p.free_over, deliveryNote: p.delivery_note, pickupAddress: p.pickup_address, returnDays: p.return_days,
    },
    viewer: { isOwner, isAdmin, wished: !!flags?.wished, stockAlert: !!flags?.stock_alert, priceAlert: !!flags?.price_alert, following: !!flags?.following, inCart: flags?.in_cart ?? 0 },
  }
}
export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProduct>>>

/** Counts a view (not the seller's own) and remembers it in "Recently viewed" (last 50). */
export async function recordView(productId: string, viewer: Who | null, ownerId: string) {
  if (viewer?.id === ownerId) return
  await db.execute(sql`update products set view_count = view_count + 1 where id = ${productId}`)
  if (!viewer) return
  await db.execute(sql`insert into recently_viewed (user_id, product_id) values (${viewer.id}, ${productId}) on conflict (user_id, product_id) do update set viewed_at = now()`)
  await db.execute(sql`delete from recently_viewed where user_id = ${viewer.id} and product_id not in (select product_id from recently_viewed where user_id = ${viewer.id} order by viewed_at desc limit 50)`)
}

export async function clearRecentlyViewed(userId: string) {
  await db.delete(schema.recentlyViewed).where(eq(schema.recentlyViewed.userId, userId))
}

export async function listQuestions(productId: string, viewerId: string | null, limit = 30): Promise<QuestionView[]> {
  const r = await db.execute<{ id: string; body: string; answer: string | null; answered_at: Date | null; created_at: Date; asker: string; asker_username: string; asker_id: string }>(sql`
    select q.id, q.body, q.answer, q.answered_at, q.created_at, u.full_name as asker, u.username as asker_username, q.asker_id
    from product_questions q join users u on u.id = q.asker_id where q.product_id = ${productId} and q.hidden_at is null and u.status = 'active'
    order by (q.answer is not null) desc, q.created_at desc limit ${limit}`)
  return r.rows.map((q) => ({ id: q.id, body: q.body, answer: q.answer, answeredAt: iso(q.answered_at), createdAt: iso(q.created_at)!, asker: q.asker, askerUsername: q.asker_username, mine: q.asker_id === viewerId }))
}

export async function listReviews(productId: string, viewerId: string | null, limit = 20): Promise<ReviewView[]> {
  const r = await db.execute<{ id: string; rating: number; body: string; created_at: Date; seller_reply: string | null; name: string; username: string; avatar_url: string | null; user_id: string }>(sql`
    select r.id, r.rating, r.body, r.created_at, r.seller_reply, u.full_name as name, u.username, u.avatar_url, r.user_id
    from product_reviews r join users u on u.id = r.user_id where r.product_id = ${productId} and r.hidden_at is null and u.status = 'active'
    order by (r.user_id = ${viewerId ?? '00000000-0000-0000-0000-000000000000'}) desc, length(r.body) > 0 desc, r.created_at desc limit ${limit}`)
  return r.rows.map((x) => ({ id: x.id, rating: x.rating, body: x.body, createdAt: iso(x.created_at)!, sellerReply: x.seller_reply, name: x.name, username: x.username, avatarUrl: x.avatar_url, mine: x.user_id === viewerId }))
}

/* ───────── Shops ───────── */
export async function getShop(slug: string, viewer: Who | null) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null
  const r = await db.execute<{
    id: string; slug: string; name: string; bio: string; logo_url: string | null; cover_url: string | null; town: string | null; status: string; verified: boolean; created_at: Date
    owner_id: string; owner_status: string; owner_username: string; owner_name: string; owner_avatar: string | null; assembly_name: string | null; district_name: string | null
    offers_pickup: boolean; offers_delivery: boolean; delivery_fee: number; free_over: number | null; delivery_note: string | null; pickup_address: string | null; return_days: number
    products: number; sold: number; rating_sum: number; rating_count: number; followers: number; following: boolean
  }>(sql`select s.id, s.slug, s.name, s.bio, s.logo_url, s.cover_url, s.town, s.status, s.verified_at is not null as verified, s.created_at,
      s.owner_id, u.status as owner_status, u.username as owner_username, u.full_name as owner_name, u.avatar_url as owner_avatar,
      a.name as assembly_name, d.name as district_name, s.offers_pickup, s.offers_delivery, s.delivery_fee_pesewas as delivery_fee, s.free_delivery_over_pesewas as free_over,
      s.delivery_note, s.pickup_address, s.return_days,
      (select count(*)::int from products p where p.shop_id = s.id and p.status = 'active' and p.deleted_at is null) as products,
      (select coalesce(sum(p.sold_count), 0)::int from products p where p.shop_id = s.id) as sold,
      (select coalesce(sum(p.rating_sum), 0)::int from products p where p.shop_id = s.id and p.deleted_at is null) as rating_sum,
      (select coalesce(sum(p.rating_count), 0)::int from products p where p.shop_id = s.id and p.deleted_at is null) as rating_count,
      (select count(*)::int from shop_follows f where f.shop_id = s.id) as followers,
      exists (select 1 from shop_follows f where f.shop_id = s.id and f.user_id = ${viewer?.id ?? '00000000-0000-0000-0000-000000000000'}) as following
    from shops s join users u on u.id = s.owner_id left join assemblies a on a.id = s.assembly_id left join districts d on d.id = a.district_id
    where s.slug = ${slug} and s.deleted_at is null`)
  const s = r.rows[0]
  if (!s) return null
  const isOwner = viewer?.id === s.owner_id, isAdmin = viewer?.role === 'tech_admin'
  const visible = s.status === 'active' && s.owner_status === 'active'
  if (!visible && !isOwner && !isAdmin) return null
  return {
    id: s.id, slug: s.slug, name: s.name, bio: s.bio, logoUrl: s.logo_url, coverUrl: s.cover_url, town: s.town, status: s.status, visible, verified: s.verified, createdAt: iso(s.created_at)!,
    owner: { id: s.owner_id, username: s.owner_username, fullName: s.owner_name, avatarUrl: s.owner_avatar }, assemblyName: s.assembly_name, districtName: s.district_name,
    offersPickup: s.offers_pickup, offersDelivery: s.offers_delivery, deliveryFeePesewas: s.delivery_fee, freeDeliveryOverPesewas: s.free_over, deliveryNote: s.delivery_note,
    pickupAddress: s.pickup_address, returnDays: s.return_days, products: s.products, sold: s.sold,
    rating: s.rating_count ? Math.round((s.rating_sum / s.rating_count) * 10) / 10 : null, ratingCount: s.rating_count, followers: s.followers, following: s.following, isOwner, isAdmin,
  }
}
export type ShopDetail = NonNullable<Awaited<ReturnType<typeof getShop>>>

/** Shop category chips: only the categories this shop sells. */
export async function shopCategories(shopId: string) {
  const r = await db.execute<{ category: string; n: number }>(sql`select p.category, count(*)::int as n ${FROM} where ${VISIBLE_SQL} and p.shop_id = ${shopId} group by 1 order by 2 desc`)
  return r.rows
}

async function visibleShop(shopId: string) {
  if (!isId(shopId)) return false
  const client = createSupabaseAdminClient()
  const { data: shop, error: shopError } = await client.from('shops').select('owner_id').eq('id', shopId).eq('status', 'active').is('deleted_at', null).maybeSingle()
  if (shopError) throw new Error(`Unable to check market shop: ${shopError.message}`)
  if (!shop) return false
  const { data: owner, error: ownerError } = await client.from('users').select('id').eq('id', shop.owner_id).eq('status', 'active').maybeSingle()
  if (ownerError) throw new Error(`Unable to check shop owner: ${ownerError.message}`)
  return !!owner
}
async function visibleProduct(productId: string) {
  if (!isId(productId)) return null
  const client = createSupabaseAdminClient()
  const { data: product, error: productError } = await client.from('products').select('id,shop_id,price_pesewas,title').eq('id', productId).eq('status', 'active').is('deleted_at', null).maybeSingle()
  if (productError) throw new Error(`Unable to load market product: ${productError.message}`)
  if (!product) return null
  const { data: shop, error: shopError } = await client.from('shops').select('owner_id').eq('id', product.shop_id).eq('status', 'active').is('deleted_at', null).maybeSingle()
  if (shopError) throw new Error(`Unable to load product shop: ${shopError.message}`)
  if (!shop) return null
  const { data: owner, error: ownerError } = await client.from('users').select('id').eq('id', shop.owner_id).eq('status', 'active').maybeSingle()
  if (ownerError) throw new Error(`Unable to check shop owner: ${ownerError.message}`)
  if (!owner) return null
  return { owner_id: shop.owner_id, price: product.price_pesewas, title: product.title }
}

export async function followShop(user: Who, shopId: string, on: boolean) {
  if (!(await visibleShop(shopId))) return { ok: false as const, error: 'not_found' as const }
  const client = createSupabaseAdminClient()
  const { data: shop, error: shopError } = await client.from('shops').select('owner_id').eq('id', shopId).maybeSingle()
  if (shopError) throw new Error(`Unable to load shop owner: ${shopError.message}`)
  if (shop?.owner_id === user.id) return { ok: false as const, error: 'own_shop' as const }
  const result = on
    ? await client.from('shop_follows').upsert({ shop_id: shopId, user_id: user.id }, { onConflict: 'shop_id,user_id', ignoreDuplicates: true })
    : await client.from('shop_follows').delete().eq('shop_id', shopId).eq('user_id', user.id)
  if (result.error) throw new Error(`Unable to update shop follow: ${result.error.message}`)
  return { ok: true as const }
}

export async function followedShops(userId: string) {
  const r = await db.execute<{ id: string; slug: string; name: string; logo_url: string | null; town: string | null; products: number }>(sql`
    select s.id, s.slug, s.name, s.logo_url, s.town, (select count(*)::int from products p where p.shop_id = s.id and p.status = 'active' and p.deleted_at is null) as products
    from shop_follows f join shops s on s.id = f.shop_id join users u on u.id = s.owner_id
    where f.user_id = ${userId} and s.deleted_at is null and s.status = 'active' and u.status = 'active' order by f.created_at desc`)
  return r.rows.map((s) => ({ id: s.id, slug: s.slug, name: s.name, logoUrl: s.logo_url, town: s.town, products: s.products }))
}

/** Shops near the member (same district). */
export async function shopsNear(districtId: string | null | undefined, limit = 10) {
  if (!districtId) return []
  const r = await db.execute<{ id: string; slug: string; name: string; logo_url: string | null; town: string | null; products: number }>(sql`
    select s.id, s.slug, s.name, s.logo_url, s.town, (select count(*)::int from products p where p.shop_id = s.id and p.status = 'active' and p.deleted_at is null) as products
    from shops s join users u on u.id = s.owner_id where s.deleted_at is null and s.status = 'active' and u.status = 'active'
      and s.assembly_id in (select a.id from assemblies a where a.district_id = ${districtId}) order by 6 desc limit ${limit}`)
  return r.rows.map((s) => ({ id: s.id, slug: s.slug, name: s.name, logoUrl: s.logo_url, town: s.town, products: s.products }))
}

/* ───────── Wishlist ───────── */
export async function setWishlist(user: Who, productId: string, on: boolean) {
  const client = createSupabaseAdminClient()
  if (on) {
    if (!(await visibleProduct(productId))) return { ok: false as const, error: 'not_found' as const }
    const { count, error: countError } = await client.from('wishlist_items').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if (countError) throw new Error(`Unable to count saved products: ${countError.message}`)
    if ((count ?? 0) >= 500) return { ok: false as const, error: 'too_many' as const }
    const { error } = await client.from('wishlist_items').upsert({ user_id: user.id, product_id: productId }, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
    if (error) throw new Error(`Unable to save product: ${error.message}`)
  } else if (isId(productId)) {
    const { error } = await client.from('wishlist_items').delete().eq('user_id', user.id).eq('product_id', productId)
    if (error) throw new Error(`Unable to remove saved product: ${error.message}`)
  }
  return { ok: true as const }
}

export async function wishlist(userId: string) {
  const r = await db.execute<CardRow>(sql`select ${CARD_COLS} ${FROM} join wishlist_items w on w.product_id = p.id and w.user_id = ${userId}
    where ${VISIBLE_SQL} order by w.created_at desc limit 500`)
  return r.rows.map(toCard)
}

/* ───────── Alerts: back in stock, price drop ───────── */
export async function setAlert(user: Who, productId: string, kind: 'stock' | 'price', on: boolean) {
  const client = createSupabaseAdminClient()
  if (!on) {
    if (isId(productId)) {
      const { error } = await client.from('product_alerts').delete().eq('user_id', user.id).eq('product_id', productId).eq('kind', kind)
      if (error) throw new Error(`Unable to remove product alert: ${error.message}`)
    }
    return { ok: true as const }
  }
  const p = await visibleProduct(productId)
  if (!p) return { ok: false as const, error: 'not_found' as const }
  if (p.owner_id === user.id) return { ok: false as const, error: 'own_shop' as const }
  const { error } = await client.from('product_alerts').upsert({
    user_id: user.id, product_id: productId, kind, price_pesewas: p.price, notified_at: null, created_at: new Date().toISOString(),
  }, { onConflict: 'user_id,product_id,kind' })
  if (error) throw new Error(`Unable to save product alert: ${error.message}`)
  return { ok: true as const }
}

export async function myAlerts(userId: string) {
  const r = await db.execute<CardRow & { kind: 'stock' | 'price'; alert_price: number; notified: boolean }>(sql`select ${CARD_COLS}, a.kind, a.price_pesewas as alert_price, a.notified_at is not null as notified
    ${FROM} join product_alerts a on a.product_id = p.id and a.user_id = ${userId} where ${VISIBLE_SQL} order by a.created_at desc limit 200`)
  return r.rows.map((x) => ({ ...toCard(x), kind: x.kind, alertPricePesewas: x.alert_price, notified: x.notified }))
}

/** Call after stock goes up: members waiting for it are told once (they can switch the alert on again). */
export async function fireStockAlerts(productId: string) {
  const p = await visibleProduct(productId)
  if (!p) return 0
  const inStock = await db.execute(sql`select 1 from product_variants v where v.product_id = ${productId} and v.active and v.stock > 0`)
  if (!inStock.rows.length) return 0
  const due = await db.update(schema.productAlerts).set({ notifiedAt: sql`now()` })
    .where(and(eq(schema.productAlerts.productId, productId), eq(schema.productAlerts.kind, 'stock'), isNull(schema.productAlerts.notifiedAt))).returning({ userId: schema.productAlerts.userId })
  for (const a of due) await notify(a.userId, 'market_alert', null, null, { productId }).catch(() => {})
  return due.length
}

/** Call after a price change: members whose alert price is now beaten are told once. */
export async function firePriceAlerts(productId: string) {
  const p = await visibleProduct(productId)
  if (!p) return 0
  const due = await db.update(schema.productAlerts).set({ notifiedAt: sql`now()` })
    .where(and(eq(schema.productAlerts.productId, productId), eq(schema.productAlerts.kind, 'price'), isNull(schema.productAlerts.notifiedAt), sql`${schema.productAlerts.pricePesewas} > ${p.price}`))
    .returning({ userId: schema.productAlerts.userId })
  for (const a of due) await notify(a.userId, 'market_alert', null, null, { productId }).catch(() => {})
  return due.length
}

/* ───────── Questions ───────── */
export async function askQuestion(user: Who, productId: string, body: string) {
  const text = body?.trim() ?? ''
  if (text.length < 3 || text.length > 500) return { ok: false as const, error: 'question' as const }
  const p = await visibleProduct(productId)
  if (!p) return { ok: false as const, error: 'not_found' as const }
  if (p.owner_id === user.id) return { ok: false as const, error: 'own_shop' as const }
  if (!(await hit(`mkt-ask:${user.id}`, 20, 3600))) return { ok: false as const, error: 'rate_limited' as const }
  const [q] = await db.insert(schema.productQuestions).values({ productId, askerId: user.id, body: text }).returning({ id: schema.productQuestions.id })
  await notify(p.owner_id, 'market_question', user.id, null, { productId }).catch(() => {})
  return { ok: true as const, id: q.id }
}

/** The shop owner answers (and may change the answer). The person who asked is told. */
export async function answerQuestion(user: Who, questionId: string, answer: string) {
  const text = answer?.trim() ?? ''
  if (!isId(questionId)) return { ok: false as const, error: 'not_found' as const }
  if (text.length < 1 || text.length > 1000) return { ok: false as const, error: 'answer' as const }
  const r = await db.execute<{ asker_id: string; product_id: string; owner_id: string }>(sql`select q.asker_id, q.product_id, s.owner_id from product_questions q join products p on p.id = q.product_id
    join shops s on s.id = p.shop_id where q.id = ${questionId} and q.hidden_at is null`)
  const q = r.rows[0]
  if (!q || q.owner_id !== user.id) return { ok: false as const, error: 'not_found' as const }
  await db.update(schema.productQuestions).set({ answer: text, answeredBy: user.id, answeredAt: sql`now()` }).where(eq(schema.productQuestions.id, questionId))
  await notify(q.asker_id, 'market_question', user.id, null, { productId: q.product_id }).catch(() => {})
  return { ok: true as const }
}

/** The asker deletes their question; a Tech Admin hides any question. */
export async function removeQuestion(user: Who, questionId: string) {
  if (!isId(questionId)) return false
  const [q] = await db.select().from(schema.productQuestions).where(eq(schema.productQuestions.id, questionId))
  if (!q || (q.askerId !== user.id && user.role !== 'tech_admin')) return false
  if (q.askerId === user.id) await db.delete(schema.productQuestions).where(eq(schema.productQuestions.id, questionId))
  else await db.update(schema.productQuestions).set({ hiddenAt: sql`now()` }).where(eq(schema.productQuestions.id, questionId))
  return true
}

/** For the search box: a few products matching what is being typed. */
export async function suggestProducts(q: string, limit = 3) {
  if (q.trim().length < 2) return []
  return (await listProducts({ q, limit })).items
}

/** The member's open shop (for their profile). */
export async function shopOf(userId: string) {
  const r = await db.execute<{ slug: string; name: string }>(sql`select slug, name from shops where owner_id = ${userId} and deleted_at is null and status = 'active' limit 1`)
  return r.rows[0] ?? null
}
