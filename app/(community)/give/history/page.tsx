import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { longDate } from '@/lib/community/dates'
import { cn } from '@/lib/utils'
import { requireUser } from '@/server/identity/session'
import { myGiving } from '@/server/payments/payments'
import { PageHeader } from '@/components/common/page-header'
import { LinkChips } from '@/components/community/tabs'
import { PrintButton } from '@/components/give/print-button'

export const metadata = { title: 'My giving' }

export default async function History({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const [me, t, sp] = await Promise.all([requireUser('/give/history'), getT(), searchParams])
  const now = new Date().getUTCFullYear()
  const year = Math.min(now, Math.max(2024, Number(sp.year) || now))
  const g = await myGiving(me.id, year)
  const years = Array.from({ length: Math.min(4, now - 2024 + 1) }, (_, i) => now - i)
  return (
    <>
      <PageHeader title={t('give.history')} back="/give" action={<PrintButton label={t('give.statement')} />} />
      <div className="space-y-3 border-b px-4 py-4">
        <LinkChips active={String(year)} items={years.map((y) => ({ key: String(y), label: String(y), href: `/give/history?year=${y}` }))} />
        <p className="text-sm text-muted-foreground">{t('give.thisYear', { year })}</p>
        <p className="text-3xl font-black" data-year-total>{ghs(g.total)}</p>
        <div className="flex flex-wrap gap-2">{Object.entries(g.byPurpose).filter(([, v]) => v > 0).map(([k, v]) => (
          <span key={k} className="rounded-full bg-muted px-3 py-1 text-sm"><b>{t(`give.purposes.${k}` as MessageKey)}</b> {ghs(v)}</span>
        ))}</div>
      </div>
      {g.items.length === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{t('give.none')}</p> : (
        <ul className="divide-y">{g.items.map((p) => (
          <li key={p.reference}><Link href={`/give/receipt/${p.reference}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50" data-gift={p.status}>
            <span className="min-w-0 flex-1"><b className="block">{t(`give.purposes.${p.purpose}` as MessageKey)}{p.fundName ? ` · ${p.fundName}` : ''}{p.publicationTitle ? ` · ${p.publicationTitle}` : ''}</b>
              <span className="text-sm text-muted-foreground">{p.recipient} · {longDate(p.createdAt)}</span></span>
            <span className="text-right"><b className="block">{ghs(p.amountPesewas)}</b>
              <span className={cn('text-xs font-semibold', p.status === 'success' ? 'text-green-600' : p.status === 'pending' ? 'text-amber-600' : 'text-muted-foreground')}>{t(`give.status.${p.status}` as MessageKey)}</span></span>
          </Link></li>
        ))}</ul>
      )}
    </>
  )
}
