import Link from 'next/link'
import { ChevronRight, Package } from 'lucide-react'
import type { TFunction } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { dayLabel } from '@/lib/community/dates'
import { cn } from '@/lib/utils'
import type { OrderRow as Row } from '@/server/market/orders'

export function OrderRow({ o, t, seller }: { o: Row; t: TFunction; seller?: boolean }) {
  const status = o.status === 'shipped' && o.fulfilment === 'pickup' ? t('market.pickupStatus.shipped') : t(`market.status.${o.status}`)
  return (
    <li>
      <Link href={`/market/orders/${o.id}`} className="flex gap-3 px-4 py-3 hover:bg-muted/50" data-order-row={o.number}>
        <span className="relative size-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
          {o.images[0] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={o.images[0]} alt="" className="size-full object-cover" /> : <Package className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2"><b className="truncate">{seller ? o.buyerName : o.shopName}</b><b className="shrink-0 text-sm">{ghs(o.totalPesewas)}</b></span>
          <span className="line-clamp-1 text-sm">{o.firstTitle}{o.itemCount > 1 && <span className="text-muted-foreground"> · {t('market.orders.items', { n: o.itemCount })}</span>}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className={cn('font-semibold', o.status === 'cancelled' ? 'text-brand-red' : o.status === 'delivered' || o.status === 'completed' ? 'text-green-700 dark:text-green-400' : 'text-primary')}>{status}</span>
            <span>{o.number}</span><span>{dayLabel(o.createdAt)}</span>
            {o.openRequest && <span className="font-semibold text-amber-600">{t('market.orders.request', { kind: t(`market.requestKind.${o.openRequest as 'cancel'}`) })}</span>}
          </span>
        </span>
        <ChevronRight className="mt-5 size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  )
}
