import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { requireUser } from '@/server/identity/session'
import { confirmPayment } from '@/server/payments/payments'
import { PageHeader } from '@/components/common/page-header'
import { WaitRefresh } from '@/components/give/wait-refresh'

export const metadata = { title: 'Payment' }

/** Where the payment page sends members back: we confirm with the provider and show the result. */
export default async function Done({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const [sp, t] = await Promise.all([searchParams, getT()])
  const me = await requireUser(`/give/done?reference=${sp.reference ?? ''}`)
  const p = sp.reference ? await confirmPayment(sp.reference) : null
  if (!p || p.userId !== me.id) notFound()
  // Market checkouts have their own confirmation page (one order per shop)
  if (p.marketCheckoutId) redirect(`/market/orders/placed?checkout=${p.marketCheckoutId}`)
  const purpose = t(`give.purposes.${p.purpose}` as MessageKey).toLowerCase()
  const back = p.publicationId ? `/publications/${p.publicationId}` : p.liveTitle ? '/live' : '/give'
  return (
    <>
      <PageHeader title={t('give.title')} />
      <div className="mx-auto max-w-sm space-y-4 px-4 py-10 text-center" data-payment-status={p.status}>
        {p.status === 'success' ? <CheckCircle2 className="mx-auto size-16 text-green-600" /> : p.status === 'pending' ? <Clock className="mx-auto size-16 text-amber-500" /> : <XCircle className="mx-auto size-16 text-destructive" />}
        <h1 className="text-2xl font-black">{p.status === 'success' ? t('give.done.success') : p.status === 'pending' ? t('give.done.pending') : t('give.done.failed')}</h1>
        <p className="text-muted-foreground">{p.status === 'success' ? t('give.done.successLead', { purpose, amount: ghs(p.amountPesewas) }) : p.status === 'pending' ? t('give.done.pendingLead') : t('give.done.failedLead')}</p>
        {p.status === 'pending' && <WaitRefresh />}
        <div className="flex flex-col gap-2 pt-2">
          {p.status === 'success' && p.publicationId && <Link href={`/publications/${p.publicationId}/read`} className="rounded-full bg-primary py-3 font-bold text-primary-foreground">{t('give.done.read')}</Link>}
          {p.status === 'success' && <Link href={`/give/receipt/${p.reference}`} className="rounded-full border py-3 font-semibold hover:bg-muted">{t('give.done.receipt')}</Link>}
          <Link href={back} className="rounded-full border py-3 font-semibold hover:bg-muted">{p.status === 'success' ? t('give.done.back') : t('give.done.again')}</Link>
        </div>
      </div>
    </>
  )
}
