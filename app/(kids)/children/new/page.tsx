import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { allowedLevels } from '@/server/library/permissions'
import { PageHeader } from '@/components/common/page-header'
import { KidsForm } from '@/components/kids/kids-form'

export const metadata = { title: 'Add kids content' }

export default async function NewKids() {
  const [me, t] = await Promise.all([requireUser('/children/new'), getT()])
  const levels = await allowedLevels(me, 'childrens_ministry')
  return (
    <>
      <PageHeader title={t('kids.add')} back="/children" />
      {levels.length ? <KidsForm levels={levels} /> : <p className="m-4 rounded-xl border bg-muted/50 p-4 text-sm" data-not-allowed>{t('kids.form.notAllowed')}</p>}
    </>
  )
}
