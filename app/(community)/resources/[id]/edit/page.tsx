import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { allowedLevels } from '@/server/library/permissions'
import { getResource } from '@/server/resources/resources'
import { PageHeader } from '@/components/common/page-header'
import { ResourceForm } from '@/components/resources/resource-form'
import { DeleteResource } from '@/components/resources/delete-resource'

export const metadata = { title: 'Edit resource' }

export default async function EditResource({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [me, t] = await Promise.all([requireUser(`/resources/${id}/edit`), getT()])
  const r = await getResource(id, me)
  if (!r || !r.canManage) notFound()
  const levels = await allowedLevels(me, 'resource_manager')
  return <><PageHeader title={t('res.edit')} back={`/resources/${id}`} action={<DeleteResource id={id} />} />
    <ResourceForm id={id} levels={levels.includes(r.level) ? levels : [r.level, ...levels]} initial={{ kind: r.kind, level: r.level, title: r.title, description: r.description, images: r.images,
      priceGhs: r.pricePesewas / 100, sizes: r.sizes, pickupInfo: r.pickupInfo, fileUrl: r.fileUrl, active: r.active }} /></>
}
