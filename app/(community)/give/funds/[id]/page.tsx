import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { longDate } from '@/lib/community/dates'
import { ghs } from '@/lib/give/money'
import { getCurrentUser } from '@/server/identity/session'
import { getFund, isTreasurer } from '@/server/payments/payments'
import { PageHeader } from '@/components/common/page-header'
import { GiveForm } from '@/components/give/give-form'
import { Progress } from '@/components/give/fund-card'

export default async function FundPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const f = await getFund(id)
  if (!f) notFound()
  const treasurer = await isTreasurer(me)
  return (
    <>
      <PageHeader title={f.name} subtitle={f.levelName} back="/give" action={treasurer && <Link href={`/give/funds/${f.id}/edit`} aria-label={t('give.reports.editFund')} className="rounded-full border p-2 hover:bg-muted"><Pencil className="size-4" /></Link>} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {f.coverUrl && <img src={f.coverUrl} alt="" className="aspect-[2/1] w-full object-cover" />}
      <section className="space-y-3 border-b px-4 py-4">
        <Progress raised={f.raised} target={f.targetPesewas} />
        <p className="text-lg"><b data-raised>{t('give.raised', { raised: ghs(f.raised) })}</b>{f.targetPesewas ? <span className="text-muted-foreground"> {t('give.of', { target: ghs(f.targetPesewas) })}</span> : null}</p>
        <p className="text-sm text-muted-foreground">{t('give.givers', { n: f.givers })}{f.endsOn ? ` · ${t('give.ends', { date: longDate(f.endsOn.toISOString()) })}` : ''}</p>
        {f.description && <p className="whitespace-pre-line text-[15px]">{f.description}</p>}
      </section>
      <section className="px-4 py-5">
        <h2 className="mb-3 text-lg font-bold">{t('give.giveToProject')}</h2>
        {!f.active ? <p className="text-muted-foreground">{t('give.err.fund')}</p> : me ? <GiveForm fundId={f.id} assemblyName={me.assemblyName} districtName={me.districtName} />
          : <Link href={`/login?next=/give/funds/${f.id}`} className="block rounded-full bg-primary py-3 text-center font-bold text-primary-foreground">{t('auth.signIn')}</Link>}
      </section>
    </>
  )
}
