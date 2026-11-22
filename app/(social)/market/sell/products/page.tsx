import Link from 'next/link'
import { Package, Plus, Star } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { ghs } from '@/lib/give/money'
import { requireShop } from '@/server/market/require-shop'
import { listings, LOW_STOCK } from '@/server/market/seller'
import { LinkChips, SearchForm } from '@/components/community/tabs'
import { ListingMenu } from '@/components/market/listing-controls'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Listings' }
const TABS = ['all', 'active', 'draft', 'low', 'removed'] as const

export default async function Listings({ searchParams }: { searchParams: Promise<{ s?: string; q?: string }> }) {
  const [{ me }, t, sp] = await Promise.all([requireShop('/market/sell/products'), getT(), searchParams])
  const tab = TABS.includes(sp.s as never) ? sp.s! : 'all'
  const r = (await listings(me, { status: tab, q: sp.q }))!
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 pt-5">
        <h1 className="text-xl font-bold">{t('market.sell.products.title')}</h1>
        <Link href="/market/sell/products/new" className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="size-4" />{t('market.sell.products.add')}</Link>
      </div>
      <div className="space-y-3 border-b px-4 py-3">
        <SearchForm action="/market/sell/products" q={sp.q} placeholder={t('market.sell.products.searchPh')} hidden={{ s: tab === 'all' ? undefined : tab }} />
        <LinkChips active={tab} items={TABS.map((k) => ({ key: k, label: t(`market.sell.products.tabs.${k}`), href: k === 'all' ? '/market/sell/products' : `/market/sell/products?s=${k}` }))} />
      </div>
      {r.rows.length === 0 ? (
        <div className="space-y-4 px-8 py-14 text-center"><Package className="mx-auto size-12 text-muted-foreground" />
          <p className="text-muted-foreground">{tab === 'all' && !sp.q ? t('market.sell.products.empty') : t('market.sell.products.none')}</p></div>
      ) : (
        <ul className="divide-y" data-listings={r.rows.length}>{r.rows.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3" data-listing={p.status}>
            <Link href={`/market/sell/products/${p.id}/edit`} className="size-16 shrink-0 overflow-hidden rounded-xl border bg-muted">{p.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image} alt="" className="size-full object-cover" />}</Link>
            <div className="min-w-0 flex-1">
              <Link href={`/market/sell/products/${p.id}/edit`} className="line-clamp-1 font-semibold hover:underline">{p.title}</Link>
              <p className="text-sm"><b>{ghs(p.pricePesewas)}</b>{p.compareAtPesewas && <s className="ml-1 text-xs text-muted-foreground">{ghs(p.compareAtPesewas)}</s>}
                <span className={cn('ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold', p.status === 'active' ? 'bg-green-600/10 text-green-700 dark:text-green-400' : p.status === 'draft' ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive')}>
                  {p.status === 'active' ? t('market.sell.products.tabs.active') : p.status === 'draft' ? t('market.sell.products.tabs.draft') : t('market.sell.products.tabs.removed')}</span></p>
              <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                <span className={cn(p.stock <= LOW_STOCK && 'font-semibold text-brand-red')}>{p.stock ? t('market.sell.products.stock', { n: p.stock }) : t('market.sell.products.noStock')}</span>
                <span>{t('market.sell.products.sold', { n: p.sold })}</span><span>{t('market.sell.products.views', { n: p.views })}</span>
                {p.rating != null && <span className="flex items-center gap-0.5"><Star className="size-3 fill-amber-500 text-amber-500" />{p.rating.toFixed(1)}</span>}
              </p>
              {p.status === 'removed' && <p className="text-xs text-destructive">{t('market.sell.products.removedNote')}</p>}
            </div>
            <ListingMenu id={p.id} status={p.status} variants={p.variants} />
          </li>))}</ul>
      )}
    </>
  )
}
