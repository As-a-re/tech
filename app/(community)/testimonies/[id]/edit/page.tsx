import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { getTestimony } from '@/server/devotion/testimonies'
import { PageHeader } from '@/components/common/page-header'
import { TestimonyForm } from '@/components/devotion/testimony-form'

export const metadata = { title: 'Edit testimony' }

export default async function EditTestimony({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t] = await Promise.all([params, getT()])
  const me = await requireUser(`/testimonies/${id}/edit`)
  const x = await getTestimony(id, me.id)
  if (!x || !x.viewer.isAuthor) notFound()
  return <><PageHeader title={t('testimonies.edit')} back={`/testimonies/${id}`} /><TestimonyForm prayer={x.prayer} initial={{ id, title: x.title, body: x.body, media: x.media }} /></>
}
