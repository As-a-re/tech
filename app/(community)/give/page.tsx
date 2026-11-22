import Link from 'next/link'
import { BarChart3, Receipt } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { isTreasurer, listFunds } from '@/server/payments/payments'
import { PageHeader } from '@/components/common/page-header'
import { GiveForm } from '@/components/give/give-form'
import { FundCard } from '@/components/give/fund-card'

export const metadata = { title: 'Give' }

export default async function GivePage({ searchParams }: { searchParams: Promise<{ live?: string; purpose?: string }> }) {
  const [t, me, sp] = await Promise.all([getT(), getCurrentUser(), searchParams])
  const [funds, treasurer] = await Promise.all([listFunds(), isTreasurer(me)])
  return (
    <>
      <PageHeader title={t('give.title')} action={me && (
        <span className="flex gap-2">
          {treasurer && <Link href="/give/reports" aria-label={t('give.reports.title')} className="rounded-full border p-2 hover:bg-muted"><BarChart3 className="size-4" /></Link>}
          <Link href="/give/history" className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><Receipt className="size-4" />{t('give.history')}</Link>
        </span>
      )} />
      <section className="space-y-4 border-b px-4 py-5">
        <p className="text-[15px] text-muted-foreground">{t('give.lead')}</p>
        {me ? <GiveForm assemblyName={me.assemblyName} districtName={me.districtName} liveId={sp.live} initialPurpose={(['offering', 'tithe', 'seed', 'thanksgiving', 'welfare'] as const).find((p) => p === sp.purpose)} />
          : <Link href="/login?next=/give" className="block rounded-full bg-primary py-3 text-center font-bold text-primary-foreground">{t('auth.signIn')}</Link>}
      </section>
      {funds.length > 0 && (
        <section className="space-y-3 px-4 py-5">
          <h2 className="text-lg font-bold">{t('give.projects')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">{funds.map((f) => <FundCard key={f.id} f={f} t={t} />)}</div>
        </section>
      )}
    </>
  )
}
