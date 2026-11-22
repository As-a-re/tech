import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, MapPin, Pencil, RotateCcw, ShieldCheck, Star, Store, Truck } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { longDate } from '@/lib/community/dates'
import { percentOff } from '@/lib/market/categories'
import { getCurrentUser } from '@/server/identity/session'
import { getProduct, listProducts, listQuestions, listReviews, recordView } from '@/server/market/catalog'
import { PageHeader } from '@/components/common/page-header'
import { ProductRail, ShopLogo } from '@/components/market/product-card'
import { Gallery } from '@/components/market/gallery'
import { BuyBox } from '@/components/market/buy-box'
import { WishButton } from '@/components/market/wish-button'
import { FollowShopButton } from '@/components/market/follow-shop'
import { MarketMenu } from '@/components/market/item-menu'
import { Questions } from '@/components/market/questions'
import { Reviews } from '@/components/market/reviews'
import { MessageButton } from '@/components/messages/message-button'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = await getProduct((await params).id, await getCurrentUser())
  return p ? { title: p.title, description: p.description.slice(0, 160), openGraph: { title: p.title, images: p.images.slice(0, 1) } } : { title: 'Product' }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const p = await getProduct(id, me)
  if (!p) notFound()
  await recordView(p.id, me, p.shop.ownerId)
  const [questions, reviews, more, similar] = await Promise.all([
    listQuestions(p.id, me?.id ?? null), listReviews(p.id, me?.id ?? null),
    listProducts({ shopId: p.shop.id, excludeId: p.id, sort: 'popular', limit: 10 }), listProducts({ category: p.category, excludeId: p.id, sort: 'popular', limit: 10 }),
  ])
  const off = percentOff(p.pricePesewas, p.compareAtPesewas)
  const s = p.shop
  const deliveryText = !s.offersDelivery ? null : s.deliveryFeePesewas === 0 ? t('market.product.freeDelivery') : `${t('market.product.deliveryFee', { amount: ghs(s.deliveryFeePesewas) })}${s.freeDeliveryOverPesewas ? ` · ${t('market.product.freeOver', { amount: ghs(s.freeDeliveryOverPesewas) })}` : ''}`
  return (
    <>
      <PageHeader title={t('market.product.title')} subtitle={s.name} back="/market" action={<span className="flex gap-2">{p.viewer.isOwner && <Link href={`/market/sell/products/${p.id}/edit`} className="flex h-10 items-center gap-1 rounded-full border px-3 text-sm font-semibold hover:bg-muted" data-edit-product><Pencil className="size-4" />{t('market.product.edit')}</Link>}<WishButton productId={p.id} initial={p.viewer.wished} signedIn={!!me} />
        <MarketMenu path={`/market/p/${p.id}`} title={p.title} report={me && !p.viewer.isOwner ? { productId: p.id } : null} reportLabel={t('market.product.report')} /></span>} />
      <article className="lg:grid lg:grid-cols-2 lg:gap-6 lg:px-4 lg:pt-4" data-product-page={p.id}>
        <div className="px-4 pt-4 lg:px-0 lg:pt-0">
          {!p.visible && <p className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm">{p.status === 'removed' ? t('market.product.removed') : p.status === 'draft' ? t('market.product.draft') : t('market.product.hidden')}</p>}
          <Gallery images={p.images} title={p.title} badge={off > 0 ? <span className="absolute left-2 top-2 rounded-full bg-brand-red px-2.5 py-1 text-sm font-bold text-white">{t('market.card.off', { n: off })}</span> : undefined} />
        </div>
        <div className="space-y-4 px-4 py-4 lg:px-0 lg:py-0">
          <div>
            <h1 className="text-xl font-extrabold leading-snug" data-product-title>{p.title}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              {p.rating != null ? <a href="#reviews" className="flex items-center gap-1 hover:underline"><Star className="size-4 fill-amber-500 text-amber-500" />{t('market.product.rating', { rating: p.rating.toFixed(1), n: p.ratingCount })}</a> : <span>{t('market.product.noReviews')}</span>}
              {p.soldCount > 0 && <span>· {t('market.product.sold', { n: p.soldCount })}</span>}
              {p.condition !== 'new' && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">{t(`market.condition.${p.condition}`)}</span>}
            </p>
          </div>
          <div>
            <p className="flex flex-wrap items-baseline gap-2"><span className="text-3xl font-black" data-price>{ghs(p.pricePesewas)}</span>
              {p.compareAtPesewas && <s className="text-muted-foreground">{ghs(p.compareAtPesewas)}</s>}
              {p.compareAtPesewas && <span className="text-sm font-bold text-brand-red">{t('market.product.save', { amount: ghs(p.compareAtPesewas - p.pricePesewas) })}</span>}</p>
            {p.dealEndsAt && <p className="text-sm text-brand-red">{t('market.product.dealEnds', { date: longDate(p.dealEndsAt) })}</p>}
          </div>
          <BuyBox productId={p.id} optionNames={p.optionNames} variants={p.variants} signedIn={!!me} isOwner={p.viewer.isOwner} inCart={p.viewer.inCart} stockAlert={p.viewer.stockAlert} priceAlert={p.viewer.priceAlert} />
          <ul className="space-y-2 rounded-2xl border p-4 text-sm">
            <li className="flex gap-2"><ShieldCheck className="size-4 shrink-0 text-primary" />{t('market.product.safe')}</li>
            {deliveryText && <li className="flex gap-2"><Truck className="size-4 shrink-0 text-primary" /><span>{deliveryText}{s.deliveryNote && <span className="block text-muted-foreground">{s.deliveryNote}</span>}</span></li>}
            {s.offersPickup && <li className="flex gap-2"><MapPin className="size-4 shrink-0 text-primary" />{t('market.product.pickupFrom', { place: s.pickupAddress || s.town || s.name })}</li>}
            <li className="flex gap-2"><RotateCcw className="size-4 shrink-0 text-primary" />{s.returnDays > 0 ? t('market.product.returns', { n: s.returnDays }) : t('market.product.noReturns')}</li>
          </ul>
          <div className="flex items-center gap-3 rounded-2xl border p-3" data-shop-card>
            <Link href={`/market/shop/${s.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
              <ShopLogo name={s.name} src={s.logoUrl} />
              <span className="min-w-0"><span className="text-xs text-muted-foreground">{t('market.product.seller')}</span>
                <b className="flex items-center gap-1 truncate">{s.name}{s.verified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label={t('market.shop.verified')} />}</b>
                <span className="block truncate text-xs text-muted-foreground"><Store className="mr-1 inline size-3" />{[s.town, s.assemblyName].filter(Boolean).join(' · ')}</span></span>
            </Link>
            {me && !p.viewer.isOwner && <MessageButton userId={s.ownerId} />}
            {!p.viewer.isOwner && <FollowShopButton shopId={s.id} initial={p.viewer.following} signedIn={!!me} size="sm" />}
          </div>
        </div>
      </article>
      <section className="space-y-2 border-t px-4 py-4">
        <h2 className="text-lg font-bold">{t('market.product.description')}</h2>
        {p.description && <p className="whitespace-pre-line text-[15px] leading-relaxed">{p.description}</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t('market.product.category')}</dt><dd><Link href={`/market/search?cat=${p.category}`} className="text-primary hover:underline">{t(`market.cat.${p.category}` as MessageKey)}</Link></dd>
          <dt className="text-muted-foreground">{t('market.product.condition')}</dt><dd>{t(`market.condition.${p.condition}`)}</dd>
        </dl>
      </section>
      <div className="border-t"><Reviews productId={p.id} rating={p.rating} count={p.ratingCount} stars={p.stars} items={reviews} isOwner={p.viewer.isOwner} isAdmin={p.viewer.isAdmin} /></div>
      <div className="border-t"><Questions productId={p.id} items={questions} signedIn={!!me} isOwner={p.viewer.isOwner} isAdmin={p.viewer.isAdmin} /></div>
      <div className="border-t">
        <ProductRail title={t('market.product.moreFromShop')} items={more.items} t={t} href={`/market/shop/${s.slug}`} />
        <ProductRail title={t('market.product.similar')} items={similar.items.filter((x) => !more.items.some((m) => m.id === x.id))} t={t} href={`/market/search?cat=${p.category}`} />
      </div>
    </>
  )
}
