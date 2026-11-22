import Link from 'next/link'
import { BellRing, TrendingDown } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { ghs } from '@/lib/give/money'
import { requireUser } from '@/server/identity/session'
import { followedShops, myAlerts, wishlist } from '@/server/market/catalog'
import { PageHeader } from '@/components/common/page-header'
import { LinkTabs } from '@/components/community/tabs'
import { ProductTile, ShopLogo } from '@/components/market/product-card'
import { RemoveAlert, RemoveWish } from '@/components/market/list-controls'

export const metadata = { title: 'Wishlist' }

export default async function WishlistPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [me, t, sp] = await Promise.all([requireUser('/market/wishlist'), getT(), searchParams])
  const tab = sp.tab === 'shops' || sp.tab === 'alerts' ? sp.tab : 'items'
  const [items, shops, alerts] = await Promise.all([tab === 'items' ? wishlist(me.id) : [], tab === 'shops' ? followedShops(me.id) : [], tab === 'alerts' ? myAlerts(me.id) : []])
  return (
    <>
      <PageHeader title={t('market.wishlist.title')} back="/market" />
      <LinkTabs active={tab} items={(['items', 'shops', 'alerts'] as const).map((k) => ({ key: k, label: t(`market.wishlist.tabs.${k}`), href: k === 'items' ? '/market/wishlist' : `/market/wishlist?tab=${k}` }))} />
      <div className="px-4 py-4">
        {tab === 'items' && (items.length ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4" data-wishlist={items.length}>
            {items.map((p) => <div key={p.id} className="relative"><ProductTile p={p} t={t} /><RemoveWish productId={p.id} label={t('market.wishlist.remove')} /></div>)}
          </div>
        ) : <p className="py-14 text-center text-muted-foreground">{t('market.wishlist.none')}</p>)}
        {tab === 'shops' && (shops.length ? (
          <ul className="divide-y rounded-2xl border">{shops.map((s) => (
            <li key={s.id}><Link href={`/market/shop/${s.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
              <ShopLogo name={s.name} src={s.logoUrl} /><span className="min-w-0"><b className="block truncate">{s.name}</b><span className="text-sm text-muted-foreground">{[s.town, t('market.shop.products', { n: s.products })].filter(Boolean).join(' · ')}</span></span>
            </Link></li>))}</ul>
        ) : <p className="py-14 text-center text-muted-foreground">{t('market.wishlist.noShops')}</p>)}
        {tab === 'alerts' && (alerts.length ? (
          <ul className="divide-y rounded-2xl border">{alerts.map((a) => (
            <li key={`${a.id}${a.kind}`} className="flex items-center gap-3 px-3 py-3" data-alert={a.kind}>
              <div className="w-20 shrink-0"><ProductTile p={a} t={t} className="[&_p]:hidden" /></div>
              <div className="min-w-0 flex-1">
                <Link href={`/market/p/${a.id}`} className="line-clamp-2 font-semibold hover:underline">{a.title}</Link>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">{a.kind === 'stock' ? <><BellRing className="size-4" />{t('market.wishlist.alertStock')}</> : <><TrendingDown className="size-4" />{t('market.wishlist.alertPrice', { amount: ghs(a.alertPricePesewas) })}</>}
                  <span>· {a.notified ? t('market.wishlist.notified') : t('market.wishlist.watching')}</span></p>
              </div>
              <RemoveAlert productId={a.id} kind={a.kind} label={t('market.wishlist.remove')} />
            </li>))}</ul>
        ) : <p className="py-14 text-center text-muted-foreground">{t('market.wishlist.noAlerts')}</p>)}
      </div>
    </>
  )
}
