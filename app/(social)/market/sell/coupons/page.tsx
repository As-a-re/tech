import Link from 'next/link'
import { Tag } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { ghs } from '@/lib/give/money'
import { longDate } from '@/lib/community/dates'
import { requireShop } from '@/server/market/require-shop'
import { listCoupons } from '@/server/market/seller'
import { listProducts } from '@/server/market/catalog'
import { CouponDialog, RemoveCoupon } from '@/components/market/coupon-form'
import { ProductGrid } from '@/components/market/product-card'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Coupons & deals' }

export default async function Coupons() {
  const [{ me, shop }, t] = await Promise.all([requireShop('/market/sell/coupons'), getT()])
  const [coupons, deals] = await Promise.all([listCoupons(me), listProducts({ shopId: shop.id, deals: true, limit: 24 })])
  const now = Date.now()
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 pt-5"><h1 className="text-xl font-bold">{t('market.sell.coupons.title')}</h1><CouponDialog /></div>
      <p className="px-4 text-sm text-muted-foreground">{t('market.sell.coupons.lead')}</p>
      {!coupons?.length ? <p className="px-8 py-10 text-center text-muted-foreground">{t('market.sell.coupons.none')}</p> : (
        <ul className="mt-3 divide-y border-y" data-coupons={coupons.length}>{coupons.map((c) => {
          const ended = !!c.endsAt && new Date(c.endsAt).getTime() < now
          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3" data-coupon={c.code}>
              <span className={cn('flex size-10 items-center justify-center rounded-full', c.active && !ended ? 'bg-green-600/10 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground')}><Tag className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-mono font-bold">{c.code}{(!c.active || ended) && <span className="ml-2 font-sans text-xs font-semibold text-muted-foreground">{ended ? t('market.sell.coupons.expired') : t('market.sell.coupons.inactive')}</span>}</p>
                <p className="text-sm">{t('market.sell.coupons.off', { value: c.kind === 'percent' ? `${c.value}%` : ghs(c.value) })}{c.minSpendPesewas > 0 && ` ${t('market.sell.coupons.minSpend', { amount: ghs(c.minSpendPesewas) })}`}</p>
                <p className="text-xs text-muted-foreground">{t('market.sell.coupons.used', { n: c.usedCount })}{c.maxUses ? ` / ${c.maxUses}` : ''}{c.endsAt && ` · ${t('market.sell.coupons.until', { date: longDate(c.endsAt) })}`}</p>
              </div>
              <CouponDialog id={c.id} initial={{ code: c.code, kind: c.kind, value: c.kind === 'percent' ? c.value : c.value / 100, minSpendGhs: c.minSpendPesewas / 100, maxUses: c.maxUses, startsAt: c.startsAt, endsAt: c.endsAt, active: c.active }} />
              <RemoveCoupon id={c.id} />
            </li>
          )
        })}</ul>
      )}
      <section className="space-y-2 px-4 py-5">
        <h2 className="text-lg font-bold">{t('market.sell.coupons.dealsTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('market.sell.coupons.dealsLead')} <Link href="/market/sell/products" className="text-primary hover:underline">{t('market.sell.nav.products')} →</Link></p>
        {deals.items.length ? <ProductGrid items={deals.items} t={t} /> : <p className="py-6 text-center text-sm text-muted-foreground">{t('market.sell.coupons.dealsNone')}</p>}
      </section>
    </>
  )
}
