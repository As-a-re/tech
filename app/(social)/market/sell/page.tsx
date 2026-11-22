import Link from 'next/link'
import { AlertTriangle, BadgeCheck, CheckCircle2, ExternalLink, HandCoins, MessageCircleQuestion, Package, PackageCheck, Plus, ShieldCheck, Star, Store, Truck, Undo2, Users, Wallet, Eye } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { ghs } from '@/lib/give/money'
import { requireUser } from '@/server/identity/session'
import { getSetting } from '@/server/admin/platform-settings'
import { dashboard, lowStock, salesByDay } from '@/server/market/seller'
import { PageHeader } from '@/components/common/page-header'
import { ShopLogo } from '@/components/market/product-card'
import { ShopForm } from '@/components/market/shop-form'
import { cn } from '@/lib/utils'

export const metadata = { title: 'My shop' }

export default async function SellHome() {
  const [me, t] = await Promise.all([requireUser('/market/sell'), getT()])
  const d = await dashboard(me)
  if (!d) {
    const fee = await getSetting('marketFeePercent')
    const points = [[Store, 'p1'], [ShieldCheck, 'p2'], [Package, 'p3'], [Users, 'p4']] as const
    return (
      <>
        <PageHeader title={t('market.sell.become.title')} back="/market" />
        <section className="space-y-3 bg-primary/5 px-4 py-6" data-become-seller>
          <h1 className="text-2xl font-black">{t('market.sell.become.title')}</h1>
          <p className="text-muted-foreground">{t('market.sell.become.lead')}</p>
          <ul className="grid gap-3 sm:grid-cols-2">{points.map(([Icon, k]) => (
            <li key={k} className="flex gap-3 rounded-2xl border bg-background p-3 text-sm"><Icon className="size-5 shrink-0 text-primary" />{t(`market.sell.become.${k}`, { fee })}</li>
          ))}</ul>
        </section>
        <h2 className="px-4 pt-5 text-lg font-bold">{t('market.sell.form.createTitle')}</h2>
        <ShopForm mode="open" initial={{ name: '', bio: '', offersPickup: true, offersDelivery: true, deliveryFeeGhs: 15, returnDays: 7, pickupAddress: me.assemblyName ?? '', town: '' }} />
      </>
    )
  }
  const [days, low] = await Promise.all([salesByDay(d.shop.id), lowStock(d.shop.id)])
  const max = Math.max(1, ...days.map((x) => x.total))
  const tasks = [
    [d.to_accept, 'toAccept', '/market/sell/orders?s=paid', HandCoins], [d.to_pack, 'toPack', '/market/sell/orders?s=accepted', Package],
    [d.to_ship, 'toShip', '/market/sell/orders?s=packed', Truck], [d.shipped, 'shipped', '/market/sell/orders?s=shipped', PackageCheck],
    [d.requests, 'requests', '/market/sell/orders?s=requests', Undo2], [d.questions, 'questions', '/market/sell/questions', MessageCircleQuestion],
    [d.low, 'low', '/market/sell/products?s=low', AlertTriangle],
  ] as const
  const due = tasks.filter(([n]) => n > 0)
  return (
    <div data-seller-dashboard>
      <section className="flex items-center gap-3 px-4 py-4">
        <ShopLogo name={d.shop.name} src={d.shop.logoUrl} className="size-14" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1 text-xl font-black leading-tight">{d.shop.name}{d.shop.verifiedAt && <BadgeCheck className="size-5 shrink-0 text-primary" />}</h1>
          <p className={cn('text-sm font-semibold', d.shop.status === 'active' ? 'text-green-700 dark:text-green-400' : 'text-brand-red')}>{t(`market.sell.status.${d.shop.status}`)}</p>
        </div>
        <Link href={`/market/shop/${d.shop.slug}`} aria-label={t('market.sell.dash.view')} className="flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><ExternalLink className="size-4" /><span className="hidden sm:inline">{t('market.sell.dash.view')}</span></Link>
      </section>
      {d.shop.status !== 'active' && <p className="mx-4 mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm">{d.shop.status === 'paused' ? t('market.sell.dash.paused') : t('market.sell.dash.suspended')}</p>}
      {!d.shop.payoutMethod && <Link href="/market/sell/settings#payout" className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm" data-no-payout>
        <Wallet className="size-5 shrink-0 text-primary" /><span className="flex-1">{t('market.sell.dash.noPayout')}</span><b className="text-primary">{t('market.sell.dash.addPayout')}</b></Link>}
      <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-4">
        {([[ghs(d.sales), t('market.sell.dash.sales'), t('market.sell.dash.orders', { n: d.orders })], [ghs(d.held), t('market.sell.dash.held'), t('market.sell.dash.heldSub')],
          [d.rating != null ? `${d.rating.toFixed(1)} ★` : '—', t('market.sell.dash.rating'), t('market.reviews.count', { n: d.rating_count })], [d.products, t('market.sell.dash.products'), t('market.sell.dash.drafts', { n: d.drafts })]] as const).map(([v, l, s]) => (
          <div key={l} className="rounded-2xl border p-3"><p className="text-xl font-black tabular-nums text-primary">{v}</p><p className="text-sm font-medium">{l}</p><p className="text-xs text-muted-foreground">{s}</p></div>
        ))}
      </div>
      <section className="px-4 pt-5" aria-label={t('market.sell.dash.sales')}>
        <div className="flex h-28 items-end gap-[3px] rounded-2xl border p-3" data-sales-chart>
          {days.map((x) => <div key={x.day} title={`${x.day} · ${ghs(x.total)}`} className={cn('flex-1 rounded-t', x.total ? 'bg-primary' : 'bg-muted')} style={{ height: `${Math.max(4, (x.total / max) * 100)}%` }} />)}
        </div>
        <p className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{days[0]?.day.slice(5)}</span><span>{days.at(-1)?.day.slice(5)}</span></p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="size-4" />{t('market.sell.dash.views')}: <b className="text-foreground">{d.views}</b></span>
          <span className="flex items-center gap-1"><Users className="size-4" />{t('market.sell.dash.followers')}: <b className="text-foreground">{d.followers}</b></span>
          <span>{t('market.sell.dash.fees')}: <b className="text-foreground">{ghs(d.fees)}</b></span>
        </p>
      </section>
      <section className="space-y-2 px-4 pt-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{t('market.sell.dash.needs')}</h2>
          <Link href="/market/sell/products/new" className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" data-add-product><Plus className="size-4" />{t('market.sell.dash.add')}</Link></div>
        {due.length === 0 ? <p className="flex items-center gap-2 rounded-2xl border p-4 text-sm"><CheckCircle2 className="size-5 text-green-600" />{t('market.sell.dash.nothing')}</p> : (
          <ul className="divide-y rounded-2xl border">{due.map(([n, k, href, Icon]) => (
            <li key={k}><Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50" data-task={k}><Icon className="size-5 text-primary" /><span className="flex-1 font-medium">{t(`market.sell.dash.${k}`)}</span>
              <span className="rounded-full bg-brand-red px-2 py-0.5 text-xs font-bold text-white">{n}</span></Link></li>))}</ul>
        )}
      </section>
      {low.length > 0 && <section className="space-y-2 px-4 py-5">
        <h2 className="text-lg font-bold">{t('market.sell.dash.low')}</h2>
        <ul className="divide-y rounded-2xl border">{low.map((v) => (
          <li key={v.id}><Link href={`/market/sell/products/${v.product_id}/edit`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
            <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted">{v.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.image} alt="" className="size-full object-cover" />}</span>
            <span className="min-w-0 flex-1"><b className="block truncate text-sm">{v.title}</b>{v.name && <span className="text-xs text-muted-foreground">{v.name}</span>}</span>
            <span className={cn('text-sm font-bold', v.stock ? 'text-amber-600' : 'text-brand-red')}>{v.stock ? t('market.sell.products.stock', { n: v.stock }) : t('market.sell.products.noStock')}</span>
          </Link></li>))}</ul>
      </section>}
      <p className="flex items-center justify-center gap-1 px-4 pb-6 pt-2 text-xs text-muted-foreground"><Star className="size-3" />{t('market.sell.become.p2')}</p>
    </div>
  )
}
