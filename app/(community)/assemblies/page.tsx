import Link from 'next/link'
import { List, Map as MapIcon } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { directory } from '@/server/community/directory'
import { PageHeader } from '@/components/common/page-header'
import { SearchForm } from '@/components/community/tabs'
import { AssemblyRow } from '@/components/community/assembly-row'
import { MapView } from '@/components/maps/map-view'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Assembly directory' }

export default async function Directory({ searchParams }: { searchParams: Promise<{ q?: string; view?: string }> }) {
  const [t, sp] = await Promise.all([getT(), searchParams])
  const q = sp.q?.trim() || undefined
  const view = sp.view === 'map' ? 'map' : 'list'
  const districts = await directory(q)
  const days = Array.from({ length: 7 }, (_, i) => t(`directory.days.${i}` as MessageKey))
  const total = districts.reduce((n, d) => n + d.assemblies.length, 0)
  const href = (v: string) => `/assemblies?${new URLSearchParams(Object.entries({ q, view: v === 'list' ? undefined : v }).filter(([, x]) => x) as [string, string][])}`
  const pins = districts.flatMap((d) => d.assemblies.filter((a) => a.lat != null && a.lng != null).map((a) => ({ lat: a.lat!, lng: a.lng!, label: a.name, sub: [a.town, d.name].filter(Boolean).join(', '), href: `/assemblies/${a.slug}` })))
  return (
    <>
      <PageHeader title={t('directory.title')} subtitle={t('directory.assemblies', { n: total })} />
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1"><SearchForm action="/assemblies" q={q} placeholder={t('directory.searchPh')} hidden={{ view: view === 'map' ? 'map' : undefined }} /></div>
        <div className="flex shrink-0 overflow-hidden rounded-full border">
          <Link href={href('list')} aria-label={t('directory.list')} aria-current={view === 'list' ? 'page' : undefined} className={cn('p-2', view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}><List className="size-4" /></Link>
          <Link href={href('map')} aria-label={t('directory.map')} aria-current={view === 'map' ? 'page' : undefined} className={cn('p-2', view === 'map' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}><MapIcon className="size-4" /></Link>
        </div>
      </div>
      {total === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{q ? t('directory.none', { q }) : t('directory.empty')}</p>
        : view === 'map' ? <div className="p-4"><MapView pins={pins} className="h-[60vh]" /></div> : districts.map((d) => (
          <section key={d.id}>
            <Link href={`/districts/${d.slug}`} className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 hover:bg-muted/60">
              <h2 className="font-bold">{d.name}</h2><span className="text-xs text-muted-foreground">{t('directory.assemblies', { n: d.assemblies.length })}</span>
            </Link>
            <div className="divide-y border-b">{d.assemblies.map((a) => <AssemblyRow key={a.id} a={a} days={days} nextLabel={t('directory.nextService')} onPapa={t('directory.onPapa')} />)}</div>
          </section>
        ))}
    </>
  )
}
