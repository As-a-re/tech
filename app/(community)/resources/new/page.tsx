import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { allowedLevels } from '@/server/library/permissions'
import { PageHeader } from '@/components/common/page-header'
import { ResourceForm } from '@/components/resources/resource-form'

export const metadata = { title: 'Add resource' }

export default async function NewResource() {
  const [me, t] = await Promise.all([requireUser('/resources/new'), getT()])
  const levels = await allowedLevels(me, 'resource_manager')
  return <><PageHeader title={t('res.new')} back="/resources/manage" />{levels.length ? <ResourceForm levels={levels} /> : <p className="m-4 rounded-xl border bg-muted/50 p-4 text-sm" data-not-allowed>{t('res.form.notAllowed')}</p>}</>
}
