import Link from 'next/link'
import { SlidersHorizontal } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { CATEGORIES, isCategory, SORTS, type SortKey } from '@/lib/market/categories'
import { getCurrentUser } from '@/server/identity/session'
import { listProducts } from '@/server/market/catalog'
import { PageHeader } from '@/components/common/page-header'
import { LinkChips, SearchForm } from '@/components/community/tabs'
import { ProductGrid } from '@/components/market/product-card'

export const metadata = { title: 'Market search' }

type SP = { q?: string; cat?: string; min?: string; max?: string; cond?: string; sort?: string; stock?: string; deals?: string; delivery?: string; near?: string; rating?: string; page?: string }

export default async function MarketSearch({ searchParams }: { searchParams: Promise<SP> }) {
  const [t, me, sp] = await Promise.all([getT(), getCurrentUser(), searchParams])
  const q = (sp.q ?? '').trim().slice(0, 80)
  const cat = isCategory(sp.cat) ? sp.cat : null
  const sort: SortKey = SORTS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : q ? 'best' : 'popular'
  const ghsToP = (v?: string) => { const n = Number(v); return v && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null }
  const page = Math.max(1, Number(sp.page) || 1)
  const r = await listProducts({
    q, category: cat, minPesewas: ghsToP(sp.min), maxPesewas: ghsToP(sp.max), condition: sp.cond, sort, inStock: sp.stock === '1', deals: sp.deals === '1', delivery: sp.delivery === '1',
    districtId: sp.near === '1' ? me?.districtId : null, ratingMin: sp.rating === '4' ? 4 : null, page, limit: 24,
  })
  const keep = (o: Partial<SP>) => {
    const all = { ...sp, page: undefined, ...o }
    return '/market/search?' + new URLSearchParams(Object.entries(all).filter(([, v]) => v) as [string, string][]).toString()
  }
  const active = [sp.min, sp.max, sp.cond, sp.stock, sp.deals, sp.delivery, sp.near, sp.rating].filter(Boolean).length
  const title = cat ? t(`market.cat.${cat}`) : q ? `“${q}”` : t('market.filters.resultsMore')
  return (
    <>
      <PageHeader title={title} back="/market" />
      <div className="space-y-3 border-b px-4 py-3">
        <SearchForm action="/market/search" q={q} placeholder={t('market.searchPh')} hidden={{ cat: cat ?? undefined, sort: sp.sort }} />
        <LinkChips active={cat ?? 'all'} items={[{ key: 'all', label: t('market.allCategories'), href: keep({ cat: undefined }) },
          ...CATEGORIES.map((c) => ({ key: c.key, label: t(`market.cat.${c.key}`), href: keep({ cat: c.key }) }))]} />
        <details className="group rounded-2xl border" open={active > 0 || undefined} data-filters>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 font-semibold">
            <SlidersHorizontal className="size-4" />{t('market.filters.title')}{active > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{active}</span>}
            <span className="ml-auto text-sm font-normal text-muted-foreground">{t(`market.sort.${sort}`)}</span>
          </summary>
          <form action="/market/search" className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
            {q && <input type="hidden" name="q" value={q} />}
            {cat && <input type="hidden" name="cat" value={cat} />}
            <label className="space-y-1 text-sm"><span className="font-medium">{t('market.filters.sort')}</span>
              <select name="sort" defaultValue={sort} className="h-10 w-full rounded-lg border bg-background px-3">{SORTS.map((s) => <option key={s} value={s}>{t(`market.sort.${s}`)}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="font-medium">{t('market.filters.condition')}</span>
              <select name="cond" defaultValue={sp.cond ?? ''} className="h-10 w-full rounded-lg border bg-background px-3">
                <option value="">{t('market.filters.any')}</option>{(['new', 'used', 'refurbished'] as const).map((c) => <option key={c} value={c}>{t(`market.condition.${c}`)}</option>)}</select></label>
            <fieldset className="space-y-1 text-sm"><legend className="font-medium">{t('market.filters.price')}</legend>
              <div className="flex gap-2">
                <input name="min" type="number" min={0} step="1" inputMode="numeric" defaultValue={sp.min} placeholder={t('market.filters.min')} aria-label={t('market.filters.min')} className="h-10 w-full rounded-lg border bg-background px-3" />
                <input name="max" type="number" min={0} step="1" inputMode="numeric" defaultValue={sp.max} placeholder={t('market.filters.max')} aria-label={t('market.filters.max')} className="h-10 w-full rounded-lg border bg-background px-3" />
              </div></fieldset>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 self-end text-sm">
              {([['stock', 'inStock'], ['deals', 'deals'], ['delivery', 'delivery'], ...(me ? [['near', 'near']] : []), ['rating', 'rating']] as [keyof SP, string][]).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" name={k} value={k === 'rating' ? '4' : '1'} defaultChecked={!!sp[k]} className="size-4 accent-[var(--primary)]" />{t(`market.filters.${label}` as MessageKey)}</label>
              ))}
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button className="flex-1 rounded-full bg-primary py-2.5 font-semibold text-primary-foreground">{t('market.filters.apply')}</button>
              {active > 0 && <Link href={keep({ min: undefined, max: undefined, cond: undefined, stock: undefined, deals: undefined, delivery: undefined, near: undefined, rating: undefined })} className="rounded-full border px-4 py-2.5 font-semibold hover:bg-muted">{t('market.filters.clear')}</Link>}
            </div>
          </form>
        </details>
      </div>
      <div className="px-4 py-4" data-results={r.items.length}>
        {r.items.length === 0 ? <p className="px-4 py-12 text-center text-muted-foreground">{t('market.filters.none')}</p> : <ProductGrid items={r.items} t={t} />}
      </div>
      {(page > 1 || r.hasMore) && (
        <nav className="flex justify-between px-4 pb-6 text-sm">
          {page > 1 ? <Link href={keep({ page: page > 2 ? String(page - 1) : undefined })} className="rounded-full border px-4 py-2 hover:bg-muted">{t('admin.pager.prev')}</Link> : <span />}
          {r.hasMore && <Link href={keep({ page: String(page + 1) })} className="rounded-full border px-4 py-2 hover:bg-muted">{t('market.filters.more')}</Link>}
        </nav>
      )}
    </>
  )
}
