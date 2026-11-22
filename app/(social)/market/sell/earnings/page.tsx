import Link from 'next/link'
import { Download, Wallet } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { dayLabel } from '@/lib/community/dates'
import { requireShop } from '@/server/market/require-shop'
import { earnings } from '@/server/market/seller'
import { myPayouts } from '@/server/market/payouts'
import { PayoutList } from '@/components/market/payout-list'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Earnings' }

export default async function Earnings({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [{ me, shop }, t, sp] = await Promise.all([requireShop('/market/sell/earnings'), getT(), searchParams])
  const page = Math.max(1, Number(sp.page) || 1)
  const [e0, payouts] = await Promise.all([earnings(me, page), myPayouts(me.id)])
  const e = e0!
  const mine = payouts.filter((p) => p.kind === 'seller')
  const where = shop.payoutMethod ? `${shop.payoutMethod === 'momo' ? t(`market.sell.form.${shop.payoutProvider as 'mtn'}`) : shop.payoutProvider} · ${shop.payoutNumber?.replace(/.(?=.{4})/g, '•')} · ${shop.payoutName}` : null
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 pt-5">
        <h1 className="text-xl font-bold">{t('market.sell.earnings.title')}</h1>
        <a href="/market/sell/earnings/export" className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted" data-export><Download className="size-4" />CSV</a>
      </div>
      <p className="px-4 text-sm text-muted-foreground">{t('market.sell.earnings.lead')}</p>
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-3" data-earnings>
        {([[e.held, 'held', 'heldSub'], [e.released, 'released'], [e.gross, 'gross'], [e.fees, 'fees'], [e.refunded, 'refunded']] as const).map(([v, k, sub]) => (
          <div key={k} className="rounded-2xl border p-3" data-earn={k}><p className={cn('text-xl font-black tabular-nums', k === 'held' || k === 'released' ? 'text-primary' : '')}>{ghs(v)}</p>
            <p className="text-sm font-medium">{t(`market.sell.earnings.${k}`)}</p>{sub && <p className="text-xs text-muted-foreground">{t(`market.sell.earnings.${sub}`)}</p>}</div>
        ))}
      </div>
      <Link href="/market/sell/settings#payout" className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm hover:bg-muted/50">
        <Wallet className="size-5 text-primary" /><span className="flex-1">{where ? t('market.sell.earnings.payoutTo', { where }) : t('market.sell.earnings.payoutMissing')}</span></Link>
      <p className="px-4 pt-2 text-xs text-muted-foreground">{t('market.sell.earnings.payoutsSoon')}</p>
      {mine.length > 0 && <section className="space-y-2 px-4 pt-4"><h2 className="text-lg font-bold">{t('market.sell.earnings.payouts')}</h2><PayoutList rows={mine} t={t} /></section>}
      {e.rows.length === 0 ? <p className="px-8 py-12 text-center text-muted-foreground">{t('market.sell.earnings.none')}</p> : (
        <div className="overflow-x-auto px-4 py-4">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">{t('market.sell.earnings.order')}</th><th className="py-2 text-right">{t('market.sell.earnings.total')}</th><th className="py-2 text-right">{t('market.sell.earnings.fee')}</th><th className="py-2 text-right">{t('market.sell.earnings.net')}</th></tr></thead>
            <tbody>{e.rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2"><Link href={`/market/orders/${r.id}`} className="font-mono font-semibold hover:underline">{r.number}</Link>
                  <span className="block text-xs text-muted-foreground">{dayLabel(r.paid_at)} · {t(`market.status.${r.status}` as MessageKey)}{r.escrow ? ` · ${t(`market.order.escrow.${r.escrow as 'held'}`)}` : ''}</span></td>
                <td className="whitespace-nowrap py-2 pl-2 text-right">{ghs(r.total_pesewas)}{r.refunded_pesewas > 0 && <span className="block text-xs text-brand-red">−{ghs(r.refunded_pesewas)}</span>}</td>
                <td className="whitespace-nowrap py-2 pl-2 text-right text-muted-foreground">{ghs(r.fee_pesewas)}</td>
                <td className={cn('whitespace-nowrap py-2 pl-2 text-right font-bold', r.status === 'cancelled' && 'text-muted-foreground line-through')}>{ghs(r.seller_net_pesewas)}</td>
              </tr>))}</tbody>
          </table>
          {(page > 1 || e.hasMore) && <nav className="flex justify-between pt-4 text-sm">
            {page > 1 ? <Link href={`/market/sell/earnings?page=${page - 1}`} className="rounded-full border px-4 py-2">{t('admin.pager.prev')}</Link> : <span />}
            {e.hasMore && <Link href={`/market/sell/earnings?page=${page + 1}`} className="rounded-full border px-4 py-2">{t('admin.pager.next')}</Link>}</nav>}
        </div>
      )}
    </>
  )
}
