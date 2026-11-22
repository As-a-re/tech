import { notFound } from 'next/navigation'
import { MapPin, Package, Phone, Store, StickyNote, User } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { ghs } from '@/lib/give/money'
import { formatPhone } from '@/lib/identity/normalise'
import { requireUser } from '@/server/identity/session'
import { getJob } from '@/server/market/riders'
import { PageHeader } from '@/components/common/page-header'
import { JobActions } from '@/components/market/job-actions'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Delivery' }
const STEPS = ['accepted', 'picked_up', 'delivered'] as const

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [me, t] = await Promise.all([requireUser(`/market/ride/jobs/${id}`), getT()])
  const j = await getJob(me, id)
  if (!j) notFound()
  const at = STEPS.indexOf(j.status as (typeof STEPS)[number])
  const call = (n: string | null) => n && <a href={`tel:+${n}`} className="ml-auto flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><Phone className="size-4" />{t('market.ride.call')}</a>
  return (
    <>
      <PageHeader title={j.number} subtitle={t('market.ride.pay', { amount: ghs(j.feePesewas) })} back="/market/ride" />
      <div className="space-y-4 px-4 py-4" data-job-page={j.status}>
        <p className="text-3xl font-black text-green-700 dark:text-green-400">{ghs(j.feePesewas)}</p>
        {j.mine && at >= 0 && <ol className="flex gap-2">{STEPS.map((s, i) => (
          <li key={s} className={cn('flex-1 rounded-full py-1.5 text-center text-xs font-semibold', i < at ? 'bg-primary/15 text-primary' : i === at ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{t(`market.ride.steps.${s}`)}</li>
        ))}</ol>}
        <section className="space-y-3 rounded-2xl border p-4">
          <div className="flex items-start gap-3"><Store className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0"><p className="text-xs text-muted-foreground">{t('market.ride.from')} · {t('market.ride.seller')}</p><p className="font-bold">{j.shopName}</p>
              <p className="text-sm">{j.pickupAddress}</p>{j.sellerName && j.mine && <p className="text-sm text-muted-foreground">{j.sellerName}{j.sellerPhone && ` · ${formatPhone(j.sellerPhone)}`}</p>}</div>
            {j.mine && j.status === 'accepted' && call(j.shopPhone ?? j.sellerPhone)}
          </div>
          <div className="flex items-start gap-3 border-t pt-3"><MapPin className="mt-0.5 size-5 shrink-0 text-brand-red" />
            <div className="min-w-0"><p className="text-xs text-muted-foreground">{t('market.ride.to')} · {t('market.ride.buyer')}</p><p className="font-bold">{j.dropoffTown ?? '—'}</p>
              {j.dropoffAddress && <p className="text-sm">{j.dropoffAddress}</p>}{j.buyerName && <p className="flex items-center gap-1 text-sm text-muted-foreground"><User className="size-3.5" />{j.buyerName}{j.buyerPhone && ` · ${formatPhone(j.buyerPhone)}`}</p>}</div>
            {j.mine && j.status === 'picked_up' && call(j.buyerPhone)}
          </div>
          <p className="flex items-center gap-2 border-t pt-3 text-sm text-muted-foreground"><Package className="size-4" />{t('market.ride.items', { n: j.items })}</p>
          {j.note && <p className="flex items-start gap-2 text-sm"><StickyNote className="mt-0.5 size-4 shrink-0 text-amber-500" />{j.note}</p>}
        </section>
        <JobActions id={j.id} status={j.status} mine={j.mine} canAccept={j.canAccept} />
      </div>
    </>
  )
}
