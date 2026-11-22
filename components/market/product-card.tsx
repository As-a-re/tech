import Link from 'next/link'
import { ChevronRight, Package, Star } from 'lucide-react'
import type { TFunction } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { percentOff } from '@/lib/market/categories'
import { cn } from '@/lib/utils'
import type { ProductCard } from '@/server/market/catalog'

/** Star rating as filled/empty stars (display only). */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-px text-amber-500', className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('size-[1em]', i <= Math.round(value) ? 'fill-current' : 'opacity-30')} />)}
    </span>
  )
}

/** One product in a grid or a row: picture, price (and "was" price), rating and shop. */
export function ProductTile({ p, t, className }: { p: ProductCard; t: TFunction; className?: string }) {
  const off = percentOff(p.pricePesewas, p.compareAtPesewas)
  return (
    <Link href={`/market/p/${p.id}`} className={cn('group block min-w-0', className)} data-product={p.id}>
      <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
        {p.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-[1.03]" />
          : <Package className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />}
        {off > 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-bold text-white">{t('market.card.off', { n: off })}</span>}
        {p.condition !== 'new' && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">{t(`market.card.${p.condition}`)}</span>}
        {!p.inStock && <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-center text-xs font-bold text-white">{t('market.card.outOfStock')}</span>}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{p.title}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        <b className="text-[15px]">{ghs(p.pricePesewas)}</b>
        {off > 0 && <s className="text-xs text-muted-foreground">{ghs(p.compareAtPesewas!)}</s>}
      </p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
        {p.rating != null && <><Star className="size-3 fill-amber-500 text-amber-500" /><span>{p.rating.toFixed(1)}</span><span>·</span></>}
        {p.soldCount > 0 && <><span>{t('market.card.sold', { n: p.soldCount })}</span><span>·</span></>}
        <span className="truncate">{p.shopName}</span>
      </p>
    </Link>
  )
}

/** A grid of products (2 columns on phones, more on wider screens). */
export function ProductGrid({ items, t }: { items: ProductCard[]; t: TFunction }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">{items.map((p) => <ProductTile key={p.id} p={p} t={t} />)}</div>
}

/** A titled row of products that scrolls sideways. */
export function ProductRail({ title, items, t, href, action }: { title: string; items: ProductCard[]; t: TFunction; href?: string; action?: React.ReactNode }) {
  if (!items.length) return null
  return (
    <section className="py-3" data-rail={title}>
      <div className="mb-2 flex items-center justify-between gap-2 px-4">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="flex items-center gap-2">
          {action}
          {href && <Link href={href} className="flex items-center text-sm font-semibold text-primary hover:underline">{t('market.home.seeAll')}<ChevronRight className="size-4" /></Link>}
        </span>
      </div>
      <div className="flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {items.map((p) => <ProductTile key={p.id} p={p} t={t} className="w-36 shrink-0 snap-start sm:w-40" />)}
      </div>
    </section>
  )
}

/** Shop logo with the first letter as a fallback. */
export function ShopLogo({ name, src, className }: { name: string; src: string | null; className?: string }) {
  return src ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt="" className={cn('size-12 shrink-0 rounded-xl border bg-muted object-cover', className)} />
    : <span aria-hidden className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-black text-primary', className)}>{name.slice(0, 1).toUpperCase()}</span>
}
