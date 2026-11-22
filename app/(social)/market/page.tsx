import Link from 'next/link'
import { Bike, Heart, Package, ShieldCheck, Store } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { CATEGORIES } from '@/lib/market/categories'
import { getCurrentUser } from '@/server/identity/session'
import { marketHome, shopsNear } from '@/server/market/catalog'
import { SearchForm } from '@/components/community/tabs'
import { ProductGrid, ProductRail, ShopLogo } from '@/components/market/product-card'
import { ClearRecent } from '@/components/market/clear-recent'

export const metadata = { title: 'Market' }

export default async function MarketHome() {
  const [t, me] = await Promise.all([getT(), getCurrentUser()])
  const [h, near] = await Promise.all([marketHome(me ? { id: me.id, districtId: me.districtId } : null), shopsNear(me?.districtId)])
  const empty = !h.fresh.length
  return (
    <div data-market-home>
      <div className="sticky top-16 z-30 space-y-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-black">{t('market.title')}</h1>
          {me && <nav className="flex gap-2 text-sm">
            <Link href="/market/sell" className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground" data-sell><Store className="size-4" />{t('market.home.sell')}</Link>
            <Link href="/market/orders" className="flex items-center gap-1 rounded-full border px-3 py-1.5 font-semibold hover:bg-muted"><Package className="size-4" />{t('market.home.orders')}</Link>
            <Link href="/market/wishlist" aria-label={t('market.home.wishlist')} className="flex items-center gap-1 rounded-full border px-3 py-1.5 font-semibold hover:bg-muted"><Heart className="size-4" /><span className="hidden sm:inline">{t('market.home.wishlist')}</span></Link>
          </nav>}
        </div>
        <SearchForm action="/market/search" placeholder={t('market.searchPh')} />
      </div>
      <div className="mx-4 mt-4 flex gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <ShieldCheck className="size-6 shrink-0 text-primary" />
        <p className="text-sm"><b>{t('market.home.safe')}.</b> {t('market.home.safeText')}</p>
      </div>
      <section className="px-4 pt-5">
        <h2 className="mb-2 text-lg font-bold">{t('market.categories')}</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {CATEGORIES.map((c) => {
            const n = h.categories.find((x) => x.key === c.key)?.n ?? 0
            return (
              <Link key={c.key} href={`/market/search?cat=${c.key}`} data-category={c.key} className="flex flex-col items-center gap-1 rounded-xl p-2 text-center hover:bg-muted">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><c.icon className="size-6" /></span>
                <span className="line-clamp-2 text-[11px] font-medium leading-tight">{t(`market.cat.${c.key}`)}</span>
                {n > 0 && <span className="text-[10px] text-muted-foreground">{n}</span>}
              </Link>
            )
          })}
        </div>
      </section>
      {empty ? <p className="px-8 py-14 text-center text-muted-foreground">{t('market.home.empty')}</p> : (
        <>
          <ProductRail title={t('market.home.recent')} items={h.recent} t={t} action={<ClearRecent label={t('market.home.clearRecent')} />} />
          <ProductRail title={t('market.home.deals')} items={h.deals} t={t} href="/market/search?deals=1&sort=popular" />
          <ProductRail title={t('market.home.recommended')} items={h.recommended} t={t} />
          <ProductRail title={t('market.home.followed')} items={h.fromFollowed} t={t} />
          <ProductRail title={t('market.home.near')} items={h.near} t={t} href="/market/search?near=1" />
          {near.length > 0 && (
            <section className="py-3">
              <h2 className="mb-2 px-4 text-lg font-bold">{t('market.home.shopsNear')}</h2>
              <div className="flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
                {near.map((s) => (
                  <Link key={s.id} href={`/market/shop/${s.slug}`} className="flex w-56 shrink-0 items-center gap-3 rounded-2xl border p-3 hover:bg-muted">
                    <ShopLogo name={s.name} src={s.logoUrl} />
                    <span className="min-w-0"><b className="block truncate">{s.name}</b><span className="block truncate text-xs text-muted-foreground"><Store className="mr-1 inline size-3" />{s.town ?? ''} · {t('market.shop.products', { n: s.products })}</span></span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <Link href="/market/sell" className="mx-4 my-3 flex items-center gap-3 rounded-2xl border border-dashed border-primary/50 p-4 hover:bg-primary/5" data-sell-card>
            <Store className="size-8 shrink-0 text-primary" /><span className="flex-1 text-sm font-semibold">{t('market.home.sellCard')}</span><b className="text-sm text-primary">{t('market.home.sell')} →</b>
          </Link>
          <Link href="/market/ride" className="mx-4 my-3 flex items-center gap-3 rounded-2xl border border-dashed p-4 hover:bg-muted/50" data-ride-card>
            <Bike className="size-8 shrink-0 text-primary" /><span className="flex-1 text-sm font-semibold">{t('market.ride.become.lead')}</span><b className="text-sm text-primary">{t('market.ride.title')} →</b>
          </Link>
          <ProductRail title={t('market.home.popular')} items={h.popular} t={t} href="/market/search?sort=popular" />
          <section className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-bold">{t('market.home.fresh')}</h2>
              <Link href="/market/search?sort=newest" className="text-sm font-semibold text-primary hover:underline">{t('market.home.seeAll')}</Link></div>
            <ProductGrid items={h.fresh} t={t} />
          </section>
        </>
      )}
    </div>
  )
}
