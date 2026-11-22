import type { TFunction } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { dayLabel } from '@/lib/community/dates'
import { cn } from '@/lib/utils'
import type { PayoutRow } from '@/server/market/payouts'

/** Payouts as a list (sellers, riders and Tech Admins). */
export function PayoutList({ rows, t, actions }: { rows: PayoutRow[]; t: TFunction; actions?: (p: PayoutRow) => React.ReactNode }) {
  return (
    <ul className="divide-y rounded-2xl border" data-payouts={rows.length}>{rows.map((p) => (
      <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3" data-payout={p.status}>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{ghs(p.amountPesewas)}{p.payee && <span className="ml-2 font-normal text-muted-foreground">{p.payee}</span>}</p>
          <p className="text-xs text-muted-foreground">{p.reference} · {dayLabel(p.paidAt ?? p.createdAt)} · {t('market.payout.to', { where: [p.method === 'momo' ? t(`market.sell.form.${p.provider as 'mtn'}`) : p.provider, p.number].filter(Boolean).join(' ') })}
            {p.count > 0 && ` · ${p.kind === 'seller' ? t('market.sell.earnings.count', { n: p.count }) : t('market.ride.items', { n: p.count })}`}</p>
          {p.failureReason && p.status === 'failed' && <p className="text-xs text-destructive">{p.failureReason}</p>}
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', p.status === 'paid' ? 'bg-green-600/10 text-green-700 dark:text-green-400' : p.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400')}>
          {t(`market.payout.status.${p.status as 'paid'}`)}</span>
        {actions?.(p)}
      </li>))}</ul>
  )
}
