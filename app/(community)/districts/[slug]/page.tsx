import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPinned } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'
import { districtBySlug } from '@/server/community/directory'
import { listAnnouncements } from '@/server/community/announcements'
import { listEvents } from '@/server/community/events'
import { isSubscribed } from '@/server/community/levels'
import { PageHeader } from '@/components/common/page-header'
import { MapView } from '@/components/maps/map-view'
import { NotifyToggle } from '@/components/community/notify-toggle'
import { AssemblyRow } from '@/components/community/assembly-row'
import { EventRow } from '@/components/community/event-row'
import { AnnouncementCard } from '@/components/community/announcement-card'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await districtBySlug((await params).slug)
  return { title: d?.name ?? 'District' }
}

export default async function DistrictPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const d = await districtBySlug(slug)
  if (!d) notFound()
  const key = `d:${d.id}`
  const [ann, ev, on] = await Promise.all([
    listAnnouncements({ scope: { level: 'district', districtId: d.id }, viewerId: me?.id ?? null }),
    listEvents({ districtId: d.id, viewerId: me?.id ?? null, limit: 5 }),
    me ? isSubscribed(me.id, key) : false,
  ])
  const days = Array.from({ length: 7 }, (_, i) => t(`directory.days.${i}` as MessageKey))
  const pins = d.assemblies.filter((a) => a.lat != null && a.lng != null).map((a) => ({ lat: a.lat!, lng: a.lng!, label: a.name, sub: a.town ?? undefined, href: `/assemblies/${a.slug}` }))
  const labels = { national: t('levels.national'), going: t('events.rsvp.goingCount'), cancelled: t('events.cancelled'), online: t('events.joinOnline') }
  return (
    <>
      <PageHeader title={d.name} subtitle={t('levels.district')} back="/assemblies" />
      <div className="flex items-start gap-3 border-b px-4 py-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><MapPinned className="size-6" /></span>
        <div className="min-w-0 flex-1"><h1 className="text-2xl font-extrabold leading-tight">{d.name}</h1>
          <p className="text-sm text-muted-foreground">{t('directory.assemblies', { n: d.assemblies.length })} · {t('directory.onPapa', { n: d.accounts })}</p></div>
        {me && <NotifyToggle scopeKey={key} initial={on} />}
      </div>
      {pins.length > 0 && <div className="border-b p-4"><MapView pins={pins} className="h-64" /></div>}
      <section className="border-b">
        <h2 className="px-4 pb-1 pt-4 font-bold">{t('directory.assemblies', { n: d.assemblies.length })}</h2>
        <div className="divide-y">{d.assemblies.map((a) => <AssemblyRow key={a.id} a={a} days={days} nextLabel={t('directory.nextService')} onPapa={t('directory.onPapa')} />)}</div>
      </section>
      <section className="border-b">
        <h2 className="px-4 pb-1 pt-4 font-bold">{t('directory.events')}</h2>
        {ev.items.length ? ev.items.map((e) => <EventRow key={e.id} e={e} labels={labels} />) : <p className="px-4 pb-4 text-sm text-muted-foreground">{t('events.none')}</p>}
      </section>
      <section>
        <div className="flex items-center justify-between px-4 pb-1 pt-4"><h2 className="font-bold">{t('directory.announcements')}</h2>
          <Link href={`/announcements/d/${d.slug}`} className="text-sm text-primary hover:underline">{t('directory.seeAll')}</Link></div>
        {ann.items.length ? ann.items.slice(0, 3).map((x) => <AnnouncementCard key={x.id} a={x} signedIn={!!me} isAdmin={me?.role === 'tech_admin'} />) : <p className="px-4 pb-4 text-sm text-muted-foreground">{t('announcements.none')}</p>}
      </section>
    </>
  )
}
