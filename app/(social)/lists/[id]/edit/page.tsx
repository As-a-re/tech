import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { getList } from '@/server/discovery/lists'
import { PageHeader } from '@/components/common/page-header'
import { ListForm } from '@/components/lists/list-form'
import { DeleteListButton } from '@/components/lists/list-controls'

export const metadata = { title: 'Edit list' }
export default async function EditList({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t] = await Promise.all([params, getT()])
  const me = await requireUser(`/lists/${id}/edit`)
  const list = await getList(id, me.id)
  if (!list || list.ownerId !== me.id) notFound()
  return (
    <>
      <PageHeader title={t('lists.edit')} back={`/lists/${id}`} />
      <div className="space-y-6 p-4 sm:p-6"><ListForm list={list} /><DeleteListButton id={id} /></div>
    </>
  )
}
