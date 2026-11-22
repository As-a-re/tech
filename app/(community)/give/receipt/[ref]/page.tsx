import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { longDate, timeLabel } from '@/lib/community/dates'
import { requireUser } from '@/server/identity/session'
import { getReceipt } from '@/server/payments/payments'
import { PageHeader } from '@/components/common/page-header'
import { PrintButton } from '@/components/give/print-button'

export const metadata = { title: 'Receipt' }

export default async function ReceiptPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const [me, t] = await Promise.all([requireUser(`/give/receipt/${ref}`), getT()])
  const p = await getReceipt(me, ref)
  if (!p) notFound()
  const when = p.paidAt ?? p.createdAt
  const rows: [string, string | null][] = [
    [t('give.receipt.reference'), p.reference], [t('give.receipt.date'), `${longDate(when)} · ${timeLabel(when)}`],
    [t('give.receipt.purpose'), t(`give.purposes.${p.purpose}` as MessageKey)], [t('give.receipt.to'), p.recipient], [t('give.receipt.fund'), p.fundName],
    [t('give.receipt.publication'), p.publicationTitle], [t('give.receipt.live'), p.liveTitle],
    [t('give.receipt.method'), p.channel ? p.channel.replace('_', ' ') : null], [t('give.receipt.giver'), p.anonymous && p.userId !== me.id ? t('give.receipt.anonymous') : p.giver],
  ]
  return (
    <>
      <PageHeader title={t('give.receipt.title')} back="/give/history" action={<PrintButton label={t('give.receipt.print')} />} />
      <article className="mx-auto max-w-md space-y-5 px-4 py-8" data-receipt={p.status}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="size-12 rounded-full" />
          <div><p className="font-black">Christ Anointed Church</p><p className="text-sm text-muted-foreground">PAPA · {t('give.receipt.title')}</p></div>
        </div>
        <p className="text-4xl font-black">{ghs(p.amountPesewas)}</p>
        <p className="text-sm font-semibold">{t(`give.status.${p.status}` as MessageKey)}</p>
        <dl className="divide-y rounded-xl border">
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        </dl>
        {p.note && <p className="text-sm italic">“{p.note}”</p>}
      </article>
    </>
  )
}
