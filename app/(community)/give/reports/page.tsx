import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { PageHeader } from '@/components/common/page-header'
import { GivingReport, PERIODS, type Period } from '@/components/give/giving-report'

export const metadata = { title: 'Giving reports' }

export default async function Reports({ searchParams }: { searchParams: Promise<{ p?: string; page?: string }> }) {
  const [me, t, sp] = await Promise.all([requireUser('/give/reports'), getT(), searchParams])
  const period = (PERIODS as readonly string[]).includes(sp.p ?? '') ? sp.p as Period : 'month'
  return <><PageHeader title={t('give.reports.title')} subtitle={t('give.reports.lead')} back="/give" /><GivingReport me={me} base="/give/reports" period={period} page={Number(sp.page) || 1} /></>
}
