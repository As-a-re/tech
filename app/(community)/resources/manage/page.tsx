import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { longDate } from '@/lib/community/dates'
import { requireUser } from '@/server/identity/session'
import { managerView } from '@/server/resources/resources'
import { PageHeader } from '@/components/common/page-header'
import { LinkChips, LinkTabs } from '@/components/community/tabs'
import { OrderActions } from '@/components/resources/order-actions'

export const metadata = { title: 'Manage resources' }

export default async function Manage({ searchParams }: { searchParams: Promise<{ tab?: string; s?: string }> }) {
  const [me, t, sp] = await Promise.all([requireUser('/resources/manage'), getT(), searchParams])
  const v = await managerView(me, sp.s)
  const tab = sp.tab === 'items' ? 'items' : 'orders'
  return (
    <>
      <PageHeader title={t('res.mgr.title')} subtitle={t('res.mgr.lead')} back="/resources"
        action={v && <Link href="/resources/new" className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"><Plus className="size-4" />{t('res.new')}</Link>} />
      {!v ? <p className="m-4 rounded-xl border bg-muted/50 p-4 text-sm">{t('res.form.notAllowed')}</p> : <>
        <LinkTabs sticky={false} active={tab} items={[{ key: 'orders', label: `${t('res.mgr.orders')}${v.counts.paid ? ` · ${v.counts.paid}` : ''}`, href: '/resources/manage' }, { key: 'items', label: t('res.mgr.items'), href: '/resources/manage?tab=items' }]} />
        {tab === 'orders' ? <>
          <div className="px-4 py-3"><LinkChips active={v.status} items={(['paid', 'ready', 'collected', 'cancelled'] as const).map((s) => ({ key: s, label: `${t(`res.orders.status.${s}` as MessageKey)}${v.counts[s] ? ` (${v.counts[s]})` : ''}`, href: `/resources/manage?s=${s}` }))} /></div>
          {v.orders.length === 0 ? <p className="px-8 py-12 text-center text-muted-foreground">{t('res.mgr.none')}</p> : (
            <ul className="divide-y border-t">{v.orders.map((o) => (
              <li key={o.id} className="space-y-2 px-4 py-3" data-mgr-order={o.status}>
                <p className="text-sm"><b>{o.buyer ?? '—'}</b> <span className="text-muted-foreground">@{o.buyerUsername}</span></p>
                <p className="text-sm">{o.title} · <b>{o.size}</b> × {o.qty} · {ghs(o.totalPesewas)} <span className="text-muted-foreground">· {o.levelName} · {longDate(o.paidAt ?? o.createdAt)}</span></p>
                <OrderActions id={o.id} status={o.status} />
              </li>
            ))}</ul>
          )}
        </> : (
          <ul className="divide-y border-t">{v.items.map((i) => (
            <li key={i.id}><Link href={`/resources/${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.image ? <img src={i.image} alt="" className="size-12 rounded-lg object-cover" /> : <span className="size-12 rounded-lg bg-muted" />}
              <span className="min-w-0 flex-1"><b className="block truncate">{i.title}{!i.active && ` · ${t('res.mgr.inactive')}`}</b>
                <span className="text-sm text-muted-foreground">{t(`res.kinds.${i.kind}`)} · {i.levelName} · {i.pricePesewas ? ghs(i.pricePesewas) : t('res.free')}
                  {i.kind === 'uniform' && ` · ${t('res.mgr.stock')}: ${i.sizes.map((s) => `${s.size} ${s.stock}`).join(', ')}`}</span></span>
            </Link></li>
          ))}</ul>
        )}
      </>}
    </>
  )
}
