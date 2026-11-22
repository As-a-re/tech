import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { getFund, isTreasurer } from '@/server/payments/payments'
import { PageHeader } from '@/components/common/page-header'
import { FundForm } from '@/components/give/fund-form'

export const metadata = { title: 'Edit project' }

export default async function EditFund({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [me, t] = await Promise.all([requireUser(`/give/funds/${id}/edit`), getT()])
  const f = await getFund(id)
  if (!f || !(await isTreasurer(me))) notFound()
  return <><PageHeader title={t('give.reports.editFund')} back={`/give/funds/${id}`} />
    <FundForm id={id} initial={{ name: f.name, description: f.description, coverUrl: f.coverUrl, level: f.level, targetGhs: f.targetPesewas ? f.targetPesewas / 100 : null, endsOn: f.endsOn?.toISOString().slice(0, 10) ?? null, active: f.active }} /></>
}
