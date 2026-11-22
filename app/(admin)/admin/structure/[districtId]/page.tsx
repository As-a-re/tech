import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { env } from '@/lib/env'
import { getDistrict, listAssemblies, listDistricts } from '@/server/admin/structure'
import { PageHeader } from '@/components/common/page-header'
import { Panel } from '@/components/admin/ui'
import { AssemblyForm, DistrictForm } from '@/components/admin/structure-forms'

export const metadata = { title: 'District' }

export default async function DistrictPage({ params }: { params: Promise<{ districtId: string }> }) {
  const [{ districtId }, t] = await Promise.all([params, getT()])
  if (!/^[0-9a-f-]{36}$/.test(districtId)) notFound()
  const d = await getDistrict(districtId)
  if (!d) notFound()
  const [assemblies, districts] = await Promise.all([listAssemblies({ districtId }), listDistricts()])
  const local = env.churchDbMode === 'local'
  return (
    <>
      <PageHeader title={d.name} subtitle={t('admin.structure.assembliesCount', { n: assemblies.length })} back="/admin/structure" />
      <div className="space-y-5 p-4 sm:p-6">
        {local && <Panel title={t('admin.structure.rename')}><DistrictForm id={d.id} name={d.name} /></Panel>}
        <Panel title={t('admin.structure.assemblies')}>
          {assemblies.length === 0 ? <p className="text-sm text-muted-foreground">{t('admin.structure.none')}</p> : (
            <ul className="-mx-4 divide-y sm:-mx-5">
              {assemblies.map((a) => (
                <li key={a.id}><Link href={`/admin/structure/assembly/${a.id}`} className="flex justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 sm:px-5">
                  <span><b>{a.name}</b>{a.town && <span className="text-muted-foreground"> · {a.town}</span>}</span>
                  <span className="text-muted-foreground">{t('admin.structure.members', { n: a.members })}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </Panel>
        {local && <Panel title={t('admin.structure.addAssembly')}><AssemblyForm districts={districts} fixedDistrictId={d.id} /></Panel>}
      </div>
    </>
  )
}
