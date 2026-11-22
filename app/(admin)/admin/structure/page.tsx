import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { env } from '@/lib/env'
import { listAssemblies, listDistricts } from '@/server/admin/structure'
import { AdminHeading, Panel, SearchBox } from '@/components/admin/ui'
import { DistrictForm } from '@/components/admin/structure-forms'

export const metadata = { title: 'Districts & assemblies' }

export default async function Structure({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [t, { q }] = await Promise.all([getT(), searchParams])
  const [districts, hits] = await Promise.all([listDistricts(), q ? listAssemblies({ q }) : Promise.resolve([])])
  const local = env.churchDbMode === 'local'
  return (
    <>
      <AdminHeading title={t('admin.tabs.structure')} />
      <div className="space-y-5 p-4 sm:p-6">
        {!local && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{t('admin.apiMode')}</p>}
        {local && <Panel title={t('admin.structure.addDistrict')}><DistrictForm /></Panel>}
        <Panel title={`${t('admin.structure.districts')} (${districts.length})`}>
          <ul className="-mx-4 divide-y sm:-mx-5">
            {districts.map((d) => (
              <li key={d.id}><Link href={`/admin/structure/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50 sm:px-5">
                <span className="font-medium">{d.name}</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">{t('admin.structure.assembliesCount', { n: d.assemblies })}<ChevronRight className="size-4" /></span>
              </Link></li>
            ))}
          </ul>
        </Panel>
        <Panel title={t('admin.structure.assemblies')}>
          <SearchBox value={q} placeholder={t('admin.structure.search')} />
          {q && (
            <ul className="-mx-4 mt-3 divide-y sm:-mx-5">
              {hits.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground sm:px-5">{t('admin.structure.none')}</li>}
              {hits.map((a) => (
                <li key={a.id}><Link href={`/admin/structure/assembly/${a.id}`} className="flex justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 sm:px-5">
                  <span><b>{a.name}</b><span className="text-muted-foreground"> · {a.town ? `${a.town}, ` : ''}{a.districtName}</span></span>
                  <span className="text-muted-foreground">{t('admin.structure.members', { n: a.members })}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
