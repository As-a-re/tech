import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { allowedLevels } from '@/server/library/permissions'
import { seriesOptions } from '@/server/library/publications'
import { PageHeader } from '@/components/common/page-header'
import { PublicationForm } from '@/components/library/publication-form'

export const metadata = { title: 'New publication' }

export default async function NewPublication() {
  const [me, t] = await Promise.all([requireUser('/publications/new'), getT()])
  const [levels, series] = await Promise.all([allowedLevels(me, 'publications_editor'), seriesOptions()])
  return (
    <>
      <PageHeader title={t('pubs.new')} back="/publications" />
      {levels.length ? <PublicationForm levels={levels} series={series} /> : <p className="m-4 rounded-xl border bg-muted/50 p-4 text-sm" data-not-allowed>{t('pubs.form.notAllowed')}</p>}
    </>
  )
}
