import { Check } from 'lucide-react'
import type { TFunction } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'

const STEPS = ['paid', 'accepted', 'packed', 'shipped', 'delivered'] as const

/** Paid → Accepted → Packed → On the way (or Ready for pickup) → Delivered. */
export function OrderProgress({ status, pickup, t }: { status: string; pickup: boolean; t: TFunction }) {
  const at = status === 'completed' ? 4 : STEPS.indexOf(status as (typeof STEPS)[number])
  return (
    <ol className="flex items-start" data-progress={status}>
      {STEPS.map((s, i) => (
        <li key={s} className="relative flex flex-1 flex-col items-center gap-1 text-center">
          {i > 0 && <span className={cn('absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2', i <= at ? 'bg-primary' : 'bg-border')} />}
          <span className={cn('relative z-10 flex size-6 items-center justify-center rounded-full border-2 text-[11px] font-bold', i <= at ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground')}>
            {i < at || at === 4 ? <Check className="size-3.5" /> : i + 1}</span>
          <span className={cn('text-[11px] leading-tight', i <= at ? 'font-semibold' : 'text-muted-foreground')}>{t(`market.order.steps.${s === 'shipped' && pickup ? 'shippedPickup' : s}`)}</span>
        </li>
      ))}
    </ol>
  )
}
