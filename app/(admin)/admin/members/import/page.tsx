import { redirect } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { env } from '@/lib/env'
import { PageHeader } from '@/components/common/page-header'
import { ImportForm } from './form'

export const metadata = { title: 'Import members' }

export default async function ImportPage() {
  if (env.churchDbMode === 'api') redirect('/admin/members')
  const t = await getT()
  return (
    <>
      <PageHeader title={t('admin.members.import')} back="/admin/members" />
      <div className="space-y-4 p-4 sm:p-6">
        <p className="text-sm leading-relaxed text-muted-foreground">{t('admin.members.importLead')}</p>
        <ImportForm />
      </div>
    </>
  )
}
