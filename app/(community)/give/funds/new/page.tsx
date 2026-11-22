import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { isTreasurer } from '@/server/payments/payments'
import { PageHeader } from '@/components/common/page-header'
import { FundForm } from '@/components/give/fund-form'

export const metadata = { title: 'New project' }

export default async function NewFund() {
  const [me, t] = await Promise.all([requireUser('/give/funds/new'), getT()])
  return <><PageHeader title={t('give.reports.newFund')} back="/give/reports" />{await isTreasurer(me) ? <FundForm /> : <p className="m-4 rounded-xl border bg-muted/50 p-4 text-sm">{t('give.err.not_allowed')}</p>}</>
}
