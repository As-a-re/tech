import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, CalendarDays, MapPin, Package, RotateCcw, Star, Truck } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { monthYear } from '@/lib/community/dates'
import { SORTS, type SortKey } from '@/lib/market/categories'
import { getCurrentUser } from '@/server/identity/session'
import { getShop, listProducts, shopCategories } from '@/server/market/catalog'
import { shopReviews } from '@/server/market/seller'
import { PageHeader } from '@/components/common/page-header'
import { LinkChips } from '@/components/community/tabs'
import { ProductGrid, ShopLogo } from '@/components/market/product-card'
import { FollowShopButton } from '@/components/market/follow-shop'
import { MarketMenu } from '@/components/market/item-menu'
import { MessageButton } from '@/components/messages/message-button'
import { UserAvatar } from '@/components/common/user-avatar'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = await getShop((await params).slug, await getCurrentUser())
  return { title: s?.name ?? 'Shop', description: s?.bio.slice(0, 160) }
}

export default async function ShopPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ cat?: string; sort?: string; page?: string }> }) {
  const [{ slug }, sp, t, me] = await Promise.all([params, searchParams, getT(), getCurrentUser()])
  const s = await getShop(slug, me)
  if (!s) notFound()
  const sort: SortKey = SORTS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : 'popular'
  const page = Math.max(1, Number(sp.page) || 1)
  const [cats, r, reviews] = await Promise.all([shopCategories(s.id), listProducts({ shopId: s.id, category: sp.cat, sort, page, limit: 24 }), page === 1 ? shopReviews(s.id, 6) : []])
  const href = (o: Record<string, string | undefined>) => `/market/shop/${s.slug}?` + new URLSearchParams(Object.entries({ cat: sp.cat, sort: sp.sort, ...o }).filter(([, v]) => v) as [string, string][]).toString()
  return (
    <>
      <PageHeader title={s.name} subtitle={t('market.shop.products', { n: s.products })} back="/market" action={<MarketMenu path={`/market/shop/${s.slug}`} title={s.name} report={me && !s.isOwner ? { shopId: s.id } : null} reportLabel={t('market.shop.report')} />} />
      <div className="relative h-32 bg-hero sm:h-44">{s.coverUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.coverUrl} alt="" className="size-full object-cover" />}</div>
      <section className="space-y-3 px-4 pb-4" data-shop={s.slug}>
        <div className="-mt-8 flex items-end justify-between gap-3">
          <ShopLogo name={s.name} src={s.logoUrl} className="size-20 rounded-2xl border-4 border-background text-3xl" />
          <span className="flex gap-2 pb-1">
            {me && !s.isOwner && <MessageButton userId={s.owner.id} />}
            {!s.isOwner && <FollowShopButton shopId={s.id} initial={s.following} signedIn={!!me} />}
            {s.isOwner && <Link href="/market/sell" className="rounded-full bg-primary px-5 py-2 font-bold text-primary-foreground" data-manage-shop>{t('market.shop.manage')}</Link>}
          </span>
        </div>
        {!s.visible && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm">{s.status === 'paused' ? t('market.shop.paused') : t('market.shop.suspended')}</p>}
        <div>
          <h1 className="flex items-center gap-1.5 text-2xl font-black">{s.name}{s.verified && <BadgeCheck className="size-5 text-primary" aria-label={t('market.shop.verified')} />}</h1>
          <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            {s.rating != null && <span className="flex items-center gap-1"><Star className="size-4 fill-amber-500 text-amber-500" />{t('market.shop.rating', { rating: s.rating.toFixed(1) })}</span>}
            <span>{t('market.shop.followers', { n: s.followers })}</span><span>{t('market.shop.sold', { n: s.sold })}</span>
          </p>
        </div>
        {s.bio && <p className="whitespace-pre-line text-[15px]">{s.bio}</p>}
        <ul className="grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
          {(s.town || s.assemblyName) && <li className="flex gap-2"><MapPin className="size-4 shrink-0" />{[s.town, s.assemblyName, s.districtName].filter(Boolean).join(' · ')}</li>}
          <li className="flex gap-2"><CalendarDays className="size-4 shrink-0" />{t('market.shop.since', { date: monthYear(new Date(s.createdAt)) })}</li>
          {s.offersDelivery && <li className="flex gap-2"><Truck className="size-4 shrink-0" />{s.deliveryFeePesewas ? t('market.product.deliveryFee', { amount: ghs(s.deliveryFeePesewas) }) : t('market.product.freeDelivery')}{s.deliveryNote ? ` · ${s.deliveryNote}` : ''}</li>}
          {s.offersPickup && <li className="flex gap-2"><Package className="size-4 shrink-0" />{t('market.product.pickupFrom', { place: s.pickupAddress || s.town || s.name })}</li>}
          <li className="flex gap-2"><RotateCcw className="size-4 shrink-0" />{s.returnDays > 0 ? t('market.product.returns', { n: s.returnDays }) : t('market.product.noReturns')}</li>
          <li><Link href={`/u/${s.owner.username}`} className="flex items-center gap-2 hover:underline"><UserAvatar name={s.owner.fullName} src={s.owner.avatarUrl} className="size-5 text-[8px]" />{t('market.shop.owner')} {s.owner.fullName}</Link></li>
        </ul>
      </section>
      <div className="space-y-3 border-t px-4 py-3">
        {cats.length > 1 && <LinkChips active={sp.cat ?? 'all'} items={[{ key: 'all', label: t('market.allCategories'), href: href({ cat: undefined, page: undefined }) },
          ...cats.map((c) => ({ key: c.category, label: `${t(`market.cat.${c.category}` as MessageKey)} · ${c.n}`, href: href({ cat: c.category, page: undefined }) }))]} />}
        <LinkChips active={sort} items={(['popular', 'newest', 'price_asc', 'price_desc', 'rating'] as const).map((k) => ({ key: k, label: t(`market.sort.${k}`), href: href({ sort: k, page: undefined }) }))} />
      </div>
      <div className="px-4 pb-6">{r.items.length ? <ProductGrid items={r.items} t={t} /> : <p className="py-12 text-center text-muted-foreground">{t('market.shop.none')}</p>}</div>
      {reviews.length > 0 && <section className="border-t px-4 py-4" data-shop-reviews={reviews.length}>
        <h2 className="mb-2 text-lg font-bold">{t('market.shop.reviews')}{s.rating != null && <span className="ml-2 text-sm font-normal text-muted-foreground">★ {s.rating.toFixed(1)} · {t('market.reviews.count', { n: s.ratingCount })}</span>}</h2>
        <ul className="divide-y">{reviews.map((x) => (
          <li key={x.id} className="space-y-1 py-3">
            <p className="flex items-center gap-2 text-sm"><UserAvatar name={x.name} src={x.avatar_url} className="size-6 text-[9px]" /><b>{x.name}</b><span className="text-amber-500">{'★'.repeat(x.rating)}<span className="opacity-30">{'★'.repeat(5 - x.rating)}</span></span></p>
            {x.body && <p className="text-[15px]">{x.body}</p>}
            <Link href={`/market/p/${x.product_id}`} className="text-xs text-primary hover:underline">{x.title}</Link>
            {x.seller_reply && <p className="rounded-xl bg-muted px-3 py-2 text-sm"><b>{t('market.reviews.reply')}:</b> {x.seller_reply}</p>}
          </li>))}</ul>
      </section>}
      {(page > 1 || r.hasMore) && <nav className="flex justify-between px-4 pb-6 text-sm">
        {page > 1 ? <Link href={href({ page: page > 2 ? String(page - 1) : undefined })} className="rounded-full border px-4 py-2">{t('admin.pager.prev')}</Link> : <span />}
        {r.hasMore && <Link href={href({ page: String(page + 1) })} className="rounded-full border px-4 py-2">{t('market.filters.more')}</Link>}
      </nav>}
    </>
  )
}
