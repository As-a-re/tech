import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { ghs } from '@/lib/give/money'
import { requireUser } from '@/server/identity/session'
import { checkoutSummary } from '@/server/market/cart'
import { PageHeader } from '@/components/common/page-header'
import { WaitRefresh } from '@/components/give/wait-refresh'
import { CartReset } from '@/components/market/cart-reset'

export const metadata = { title: 'Order placed' }

/** After paying: the orders of this checkout, one per shop. */
export default async function Placed({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const [sp, t] = await Promise.all([searchParams, getT()])
  const me = await requireUser(`/market/orders/placed?checkout=${sp.checkout ?? ''}`)
  const s = sp.checkout ? await checkoutSummary(me.id, sp.checkout) : null
  if (!s) notFound()
  const paid = s.paymentStatus === 'success' || s.orders.some((o) => o.status !== 'pending_payment' && o.status !== 'cancelled')
  const waiting = !paid && s.paymentStatus === 'pending'
  return (
    <>
      <PageHeader title={t('market.placed.title')} />
      <div className="mx-auto max-w-md space-y-4 px-4 py-8 text-center" data-placed={paid ? 'paid' : waiting ? 'pending' : 'failed'}>
        {paid ? <CheckCircle2 className="mx-auto size-16 text-green-600" /> : waiting ? <Clock className="mx-auto size-16 text-amber-500" /> : <XCircle className="mx-auto size-16 text-destructive" />}
        <h1 className="text-2xl font-black">{paid ? t('market.placed.thanks') : waiting ? t('market.placed.pending') : t('market.placed.failed')}</h1>
        {paid && <p className="text-muted-foreground">{t('market.placed.lead')}</p>}
        {paid && <CartReset />}
        {waiting && <WaitRefresh />}
        {paid && <ul className="divide-y rounded-2xl border text-left">{s.orders.map((o) => (
          <li key={o.id}><Link href={`/market/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
            <span><b className="block">{o.shopName}</b><span className="text-sm text-muted-foreground">{o.number} · {t(`market.status.${o.status}`)}</span></span>
            <span className="text-right"><b className="block">{ghs(o.totalPesewas)}</b><span className="text-sm text-primary">{t('market.placed.view')}</span></span>
          </Link></li>))}</ul>}
        <div className="flex flex-col gap-2 pt-2">
          {paid ? <Link href="/market/orders" className="rounded-full bg-primary py-3 font-bold text-primary-foreground">{t('market.placed.orders')}</Link>
            : !waiting && <Link href="/cart" className="rounded-full bg-primary py-3 font-bold text-primary-foreground">{t('market.placed.tryAgain')}</Link>}
          <Link href="/market" className="rounded-full border py-3 font-semibold hover:bg-muted">{t('market.placed.keepShopping')}</Link>
        </div>
      </div>
    </>
  )
}
