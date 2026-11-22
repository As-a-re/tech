import Link from 'next/link'
import { Download, Plus } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { longDate, timeLabel } from '@/lib/community/dates'
import type { CurrentUser } from '@/server/identity/session'
import { givingReport, listFunds } from '@/server/payments/payments'
import { LinkChips } from '@/components/community/tabs'
import { PagerLinks } from '@/components/common/pager-links'
import { Progress } from './fund-card'

export const PERIODS = ['today', 'week', 'month', 'year'] as const
export type Period = (typeof PERIODS)[number]
export function periodRange(p: Period) {
  const now = new Date(), to = new Date(now.getTime() + 60_000)
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  if (p === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  if (p === 'month') d.setUTCDate(1)
  if (p === 'year') { d.setUTCMonth(0); d.setUTCDate(1) }
  return { from: d, to }
}

/** Totals, by purpose, by day, the payments list and projects — for treasurers and Tech Admins. */
export async function GivingReport({ me, base, period, page }: { me: CurrentUser; base: string; period: Period; page: number }) {
  const t = await getT()
  const { from, to } = periodRange(period)
  const [r, funds] = await Promise.all([givingReport(me, { from, to, page }), listFunds(false)])
  if (!r) return <p className="m-4 rounded-xl border bg-muted/50 p-4 text-sm">{t('give.err.not_allowed')}</p>
  const max = Math.max(1, ...r.byDay.map((d) => d.total))
  return (
    <div className="space-y-5 p-4" data-giving-report>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1"><LinkChips active={period} items={PERIODS.map((p) => ({ key: p, label: t(`give.reports.${p}`), href: `${base}?p=${p}` }))} /></div>
        <a href={`/give/reports/export?p=${period}`} className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><Download className="size-4" />{t('give.reports.export')}</a>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{t('give.reports.total')}</p><p className="text-xl font-black" data-report-total>{ghs(r.total)}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{t('give.reports.count')}</p><p className="text-xl font-black">{r.count}</p></div>
        <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{t('give.reports.givers')}</p><p className="text-xl font-black">{r.givers}</p></div>
      </div>
      {r.count > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border p-4">
            <h3 className="mb-2 font-bold">{t('give.reports.byPurpose')}</h3>
            <ul className="space-y-2">{Object.entries(r.byPurpose).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([k, v]) => (
              <li key={k} className="text-sm"><div className="flex justify-between"><span>{t(`give.purposes.${k}` as MessageKey)}</span><b>{ghs(v ?? 0)}</b></div>
                <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${((v ?? 0) / Math.max(1, r.total)) * 100}%` }} /></div></li>
            ))}</ul>
          </section>
          <section className="rounded-xl border p-4">
            <div className="flex h-40 items-end gap-1" aria-hidden>{r.byDay.map((d) => (
              <div key={d.day} title={`${d.day}: ${ghs(d.total)}`} className="flex-1 rounded-t bg-green-600/80" style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }} />
            ))}</div>
            <p className="mt-2 text-xs text-muted-foreground">{r.byDay[0]?.day} → {r.byDay.at(-1)?.day}</p>
          </section>
        </div>
      )}
      <section>
        <h3 className="mb-2 font-bold">{t('give.reports.list')}</h3>
        {r.items.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t('give.reports.none')}</p> : (
          <ul className="divide-y rounded-xl border">{r.items.map((p) => (
            <li key={p.reference} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1"><b>{p.giver ?? t('give.receipt.anonymous')}</b> · {t(`give.purposes.${p.purpose}` as MessageKey)}{p.fundName ? ` · ${p.fundName}` : ''}
                <span className="block text-xs text-muted-foreground">{p.recipient} · {p.paidAt && `${longDate(p.paidAt)} ${timeLabel(p.paidAt)}`} · {p.channel?.replace('_', ' ')} · {p.reference}</span></span>
              <b>{ghs(p.amountPesewas)}</b>
            </li>
          ))}</ul>
        )}
        <PagerLinks base={base} params={{ p: period }} page={r.page} hasMore={r.hasMore} labels={{ prev: t('announcements.prev'), next: t('announcements.next') }} />
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-bold">{t('give.reports.funds')}</h3>
          <Link href="/give/funds/new" className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"><Plus className="size-4" />{t('give.reports.newFund')}</Link></div>
        <ul className="divide-y rounded-xl border">{funds.map((f) => (
          <li key={f.id} className="space-y-1.5 px-3 py-2.5 text-sm">
            <div className="flex justify-between gap-2"><Link href={`/give/funds/${f.id}`} className="font-bold hover:underline">{f.name}</Link><span className="text-muted-foreground">{f.levelName}{!f.active && ' · closed'}</span></div>
            <Progress raised={f.raised} target={f.targetPesewas} /><p>{ghs(f.raised)}{f.targetPesewas ? ` / ${ghs(f.targetPesewas)}` : ''}</p>
          </li>
        ))}</ul>
      </section>
    </div>
  )
}
