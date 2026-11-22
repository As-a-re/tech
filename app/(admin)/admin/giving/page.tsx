import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { AdminHeading } from '@/components/admin/ui'
import { GivingReport, PERIODS, type Period } from '@/components/give/giving-report'

export const metadata = { title: 'Giving' }

export default async function AdminGiving({ searchParams }: { searchParams: Promise<{ p?: string; page?: string }> }) {
  const [me, t, sp] = await Promise.all([requireUser('/admin/giving'), getT(), searchParams])
  const period = (PERIODS as readonly string[]).includes(sp.p ?? '') ? sp.p as Period : 'month'
  return <><AdminHeading title={t('admin.tabs.giving')} /><GivingReport me={me} base="/admin/giving" period={period} page={Number(sp.page) || 1} /></>
}
