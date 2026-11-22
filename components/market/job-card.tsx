import Link from 'next/link'
import { ArrowDown, MapPin, Package, Store } from 'lucide-react'
import type { TFunction } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { cn } from '@/lib/utils'
import type { Job } from '@/server/market/riders'

/** One delivery job: pay, from (shop) and to (buyer's town), items. */
export function JobCard({ j, t }: { j: Job; t: TFunction }) {
  return (
    <Link href={`/market/ride/jobs/${j.id}`} className="block space-y-2 rounded-2xl border p-4 hover:bg-muted/40" data-job={j.status}>
      <div className="flex items-center justify-between gap-2">
        <b className="text-xl text-green-700 dark:text-green-400">{t('market.ride.pay', { amount: ghs(j.feePesewas) })}</b>
        {j.near && j.status === 'open' && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{t('market.ride.near')}</span>}
        {j.status !== 'open' && <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', j.status === 'delivered' ? 'bg-green-600/10 text-green-700 dark:text-green-400' : j.status === 'cancelled' ? 'bg-muted text-muted-foreground' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400')}>
          {j.status === 'cancelled' ? t('market.status.cancelled') : t(`market.ride.steps.${j.status as 'accepted'}`)}</span>}
      </div>
      <p className="flex items-start gap-2 text-sm"><Store className="mt-0.5 size-4 shrink-0 text-primary" /><span><span className="text-muted-foreground">{t('market.ride.from')}:</span> <b>{j.shopName}</b>{j.pickupTown && ` · ${j.pickupTown}`}</span></p>
      <ArrowDown className="ml-0.5 size-3 text-muted-foreground" />
      <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-red" /><span><span className="text-muted-foreground">{t('market.ride.to')}:</span> <b>{j.dropoffTown ?? '—'}</b>{j.dropoffAddress && ` · ${j.dropoffAddress}`}</span></p>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Package className="size-3.5" />{t('market.ride.items', { n: j.items })} · {j.number}</p>
    </Link>
  )
}
