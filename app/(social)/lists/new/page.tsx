import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { PageHeader } from '@/components/common/page-header'
import { ListForm } from '@/components/lists/list-form'

export const metadata = { title: 'New list' }
export default async function NewList() {
  const [, t] = await Promise.all([requireUser('/lists/new'), getT()])
  return <><PageHeader title={t('lists.new')} back="/lists" /><div className="p-4 sm:p-6"><ListForm /></div></>
}
