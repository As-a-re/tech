import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { env } from '@/lib/env'
import { getAssembly, getDistrict, listDistricts } from '@/server/admin/structure'
import { PageHeader } from '@/components/common/page-header'
import { Panel } from '@/components/admin/ui'
import { AssemblyForm } from '@/components/admin/structure-forms'
import { AssemblyProfileForm } from '@/components/admin/assembly-profile-form'
import { assemblyProfile } from '@/server/community/directory'
import Link from 'next/link'

export const metadata = { title: 'Assembly' }

export default async function AssemblyPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t] = await Promise.all([params, getT()])
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const a = await getAssembly(id)
  if (!a) notFound()
  const [district, districts, profile] = await Promise.all([getDistrict(a.districtId), listDistricts(), assemblyProfile(a.id)])
  return (
    <>
      <PageHeader title={a.name} subtitle={district?.name} back={`/admin/structure/${a.districtId}`} />
      <div className="space-y-5 p-4 sm:p-6">
        {env.churchDbMode === 'local'
          ? <Panel title={t('admin.structure.edit')}><AssemblyForm id={a.id} values={{ name: a.name, town: a.town, districtId: a.districtId }} districts={districts} /></Panel>
          : <p className="rounded-lg bg-muted px-3 py-2 text-sm">{t('admin.apiMode')}</p>}
        <Panel title={t('admin.profile.title')} note={t('admin.profile.note')}>
          <Link href={`/assemblies/${a.slug}`} className="mb-4 inline-block text-sm font-medium text-primary hover:underline">{t('directory.title')} →</Link>
          <AssemblyProfileForm assemblyId={a.id} initial={{ about: profile?.about ?? null, address: profile?.address ?? null, lat: profile?.lat ?? null, lng: profile?.lng ?? null,
            phone: profile?.phone ?? null, email: profile?.email ?? null, photoUrl: profile?.photoUrl ?? null, serviceTimes: profile?.serviceTimes ?? [], leaders: profile?.leaders ?? [] }} />
        </Panel>
      </div>
    </>
  )
}
