import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { ghs } from '@/lib/give/money'
import { longDate } from '@/lib/community/dates'
import { formatPhone } from '@/lib/identity/normalise'
import { requireUser } from '@/server/identity/session'
import { getOrder } from '@/server/market/orders'
import { PageHeader } from '@/components/common/page-header'
import { PrintButton } from '@/components/give/print-button'

export const metadata = { title: 'Invoice' }

/** Printable invoice for a paid order (buyer, seller and Tech Admins). */
export default async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [me, t] = await Promise.all([requireUser(`/market/orders/${id}/invoice`), getT()])
  const o = await getOrder(me, id)
  if (!o || !o.paidAt) notFound()
  return (
    <>
      <PageHeader title={t('market.invoice.title')} back={`/market/orders/${o.id}`} action={<PrintButton label={t('market.invoice.print')} />} />
      <article className="mx-auto max-w-2xl space-y-6 px-4 py-8 print:p-0" data-invoice={o.number}>
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={48} height={48} className="size-12 rounded-full bg-white" />
            <div><p className="text-lg font-black">PAPA Market</p><p className="text-xs text-muted-foreground">{t('app.church')}</p></div>
          </div>
          <div className="text-right text-sm"><p className="text-xl font-black">{t('market.invoice.number', { number: o.number })}</p><p className="text-muted-foreground">{t('market.invoice.date')}: {longDate(o.paidAt)}</p></div>
        </header>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div><p className="text-xs font-semibold uppercase text-muted-foreground">{t('market.invoice.billTo')}</p><p className="font-semibold">{o.recipientName ?? o.buyer?.fullName}</p>
            {o.phone && <p>{formatPhone(o.phone)}</p>}{o.address && <p>{[o.address, o.town].filter(Boolean).join(', ')}</p>}</div>
          <div><p className="text-xs font-semibold uppercase text-muted-foreground">{t('market.invoice.from')}</p><p className="font-semibold">{o.shopName}</p>{o.seller && <p>@{o.seller.username}</p>}</div>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="py-2">{t('market.order.items')}</th><th className="py-2 text-right">{t('market.invoice.qty')}</th><th className="py-2 text-right">{t('market.invoice.price')}</th><th className="py-2 text-right">{t('market.invoice.amount')}</th></tr></thead>
          <tbody>{o.items.map((i) => <tr key={i.id} className="border-b"><td className="py-2">{i.title}{i.variantName && <span className="text-muted-foreground"> · {i.variantName}</span>}</td><td className="py-2 text-right">{i.qty}</td><td className="py-2 text-right">{ghs(i.unitPesewas)}</td><td className="py-2 text-right">{ghs(i.totalPesewas)}</td></tr>)}</tbody>
        </table>
        <dl className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>{t('market.order.subtotal')}</dt><dd>{ghs(o.subtotalPesewas)}</dd></div>
          <div className="flex justify-between"><dt>{t('market.order.deliveryFee')}</dt><dd>{ghs(o.deliveryFeePesewas)}</dd></div>
          {o.discountPesewas > 0 && <div className="flex justify-between"><dt>{t('market.order.discount', { code: o.couponCode ?? '' })}</dt><dd>−{ghs(o.discountPesewas)}</dd></div>}
          <div className="flex justify-between border-t pt-1 text-base font-black"><dt>{t('market.order.total')}</dt><dd>{ghs(o.totalPesewas)}</dd></div>
          <div className="flex justify-between text-muted-foreground"><dt>{t('market.invoice.paid')}</dt><dd>{o.payment?.reference}</dd></div>
          {o.refundedPesewas > 0 && <div className="flex justify-between"><dt>{t('market.order.refunded')}</dt><dd>−{ghs(o.refundedPesewas)}</dd></div>}
        </dl>
        <p className="border-t pt-4 text-center text-xs text-muted-foreground">{t('market.invoice.note')}</p>
      </article>
    </>
  )
}
