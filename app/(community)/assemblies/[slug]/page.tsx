import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Church, Mail, MapPin, Navigation, Phone, Users } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'
import { assemblyBySlug } from '@/server/community/directory'
import { listAnnouncements } from '@/server/community/announcements'
import { listEvents } from '@/server/community/events'
import { isSubscribed } from '@/server/community/levels'
import { clock } from '@/lib/community/dates'
import { directionsUrl } from '@/lib/community/maps'
import { PageHeader } from '@/components/common/page-header'
import { UserAvatar } from '@/components/common/user-avatar'
import { MapView } from '@/components/maps/map-view'
import { NotifyToggle } from '@/components/community/notify-toggle'
import { EventRow } from '@/components/community/event-row'
import { AnnouncementCard } from '@/components/community/announcement-card'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await assemblyBySlug((await params).slug)
  return { title: a?.name ?? 'Assembly', description: a?.about?.slice(0, 160) ?? undefined }
}

export default async function AssemblyPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const a = await assemblyBySlug(slug)
  if (!a) notFound()
  const key = `a:${a.id}`
  const [ann, ev, on] = await Promise.all([
    listAnnouncements({ scope: { level: 'local', assemblyId: a.id }, viewerId: me?.id ?? null }),
    listEvents({ assemblyId: a.id, viewerId: me?.id ?? null, limit: 5 }),
    me ? isSubscribed(me.id, key) : false,
  ])
  const labels = { national: t('levels.national'), going: t('events.rsvp.goingCount'), cancelled: t('events.cancelled'), online: t('events.joinOnline') }
  return (
    <>
      <PageHeader title={a.name} subtitle={a.district.name} back="/assemblies" />
      {a.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.photoUrl} alt="" className="aspect-[2/1] w-full object-cover" />
      )}
      <div className="space-y-3 border-b px-4 py-5">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Church className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold leading-tight">{a.name}</h1>
            <p className="text-sm text-muted-foreground">{[a.town, <Link key="d" href={`/districts/${a.district.slug}`} className="hover:underline">{a.district.name}</Link>].filter(Boolean).reduce<React.ReactNode[]>((acc, x, i) => (i ? [...acc, ' · ', x] : [x]), [])}</p>
          </div>
          {me && <NotifyToggle scopeKey={key} initial={on} />}
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="size-4" />{t('directory.members', { n: a.members })} · {t('directory.onPapa', { n: a.accounts })}</p>
        {a.about && <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{a.about}</p>}
        {me?.role === 'tech_admin' && <Link href={`/admin/structure/assembly/${a.id}`} className="inline-block text-sm font-medium text-primary hover:underline">{t('directory.edit')}</Link>}
      </div>

      <section className="border-b px-4 py-4">
        <h2 className="mb-2 font-bold">{t('directory.services')}</h2>
        {a.serviceTimes.length === 0 ? <p className="text-sm text-muted-foreground">{t('directory.noServices')}</p> : (
          <ul className="divide-y rounded-xl border">
            {a.serviceTimes.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[15px]">
                <span><b className="font-semibold">{s.label}</b><span className="block text-sm text-muted-foreground">{t(`directory.days.${s.day}` as MessageKey)}</span></span>
                <span className="text-sm font-medium tabular-nums">{clock(s.start)}{s.end && ` – ${clock(s.end)}`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {a.leaders.length > 0 && (
        <section className="border-b px-4 py-4">
          <h2 className="mb-2 font-bold">{t('directory.leaders')}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {a.leaders.map((l, i) => {
              const inner = <><UserAvatar name={l.name} src={l.avatarUrl} className="size-10" /><span className="min-w-0"><b className="block truncate font-semibold">{l.name}</b><span className="block truncate text-sm text-muted-foreground">{l.role}</span></span></>
              return <li key={i}>{l.username ? <Link href={`/u/${l.username}`} className="flex items-center gap-3 rounded-xl border p-2.5 hover:bg-muted/50">{inner}</Link> : <div className="flex items-center gap-3 rounded-xl border p-2.5">{inner}</div>}</li>
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3 border-b px-4 py-4">
        <h2 className="font-bold">{t('directory.location')}</h2>
        {a.address && <p className="flex gap-2 text-[15px]"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" />{a.address}</p>}
        {a.lat != null && a.lng != null ? (
          <>
            <MapView pins={[{ lat: a.lat, lng: a.lng, label: a.name }]} className="h-60" />
            <a href={directionsUrl(a.lat, a.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium hover:bg-muted"><Navigation className="size-4" />{t('directory.directions')}</a>
          </>
        ) : <p className="text-sm text-muted-foreground">{t('directory.noMap')}</p>}
        {(a.phone || a.email) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {a.phone && <a href={`tel:${a.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium hover:bg-muted"><Phone className="size-4" />{a.phone}</a>}
            {a.email && <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium hover:bg-muted"><Mail className="size-4" />{a.email}</a>}
          </div>
        )}
      </section>

      <section className="border-b">
        <div className="flex items-center justify-between px-4 pb-1 pt-4"><h2 className="font-bold">{t('directory.events')}</h2></div>
        {ev.items.length ? ev.items.map((e) => <EventRow key={e.id} e={e} labels={labels} />) : <p className="px-4 pb-4 text-sm text-muted-foreground">{t('events.none')}</p>}
      </section>
      <section>
        <div className="flex items-center justify-between px-4 pb-1 pt-4"><h2 className="font-bold">{t('directory.announcements')}</h2>
          <Link href={`/announcements/a/${a.slug}`} className="text-sm text-primary hover:underline">{t('directory.seeAll')}</Link></div>
        {ann.items.length ? ann.items.slice(0, 3).map((x) => <AnnouncementCard key={x.id} a={x} signedIn={!!me} isAdmin={me?.role === 'tech_admin'} />) : <p className="px-4 pb-4 text-sm text-muted-foreground">{t('announcements.none')}</p>}
      </section>
    </>
  )
}
