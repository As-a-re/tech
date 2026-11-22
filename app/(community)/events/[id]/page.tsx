import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarClock, ExternalLink, MapPin, Navigation, Video } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { attendees, getEvent } from '@/server/community/events'
import { whenLabel } from '@/lib/community/dates'
import { directionsUrl } from '@/lib/community/maps'
import { PageHeader } from '@/components/common/page-header'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { RichText } from '@/components/posts/rich-text'
import { MapView } from '@/components/maps/map-view'
import { LevelBadge } from '@/components/community/level-badge'
import { DateBlock } from '@/components/community/event-row'
import { EventMenu, RsvpButtons } from '@/components/community/event-actions'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const e = await getEvent((await params).id, null)
  return { title: e?.title ?? 'Event', description: e?.description.slice(0, 160) }
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const e = await getEvent(id, me?.id ?? null)
  if (!e) notFound()
  const going = await attendees(id, 'going')
  return (
    <>
      <PageHeader title={t('events.title')} back="/events" action={<EventMenu id={id} isAuthor={e.viewer.isAuthor} isAdmin={me?.role === 'tech_admin'} signedIn={!!me} cancelled={e.cancelled} />} />
      {e.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.coverUrl} alt="" className="aspect-[2/1] w-full object-cover" />
      )}
      <div className="space-y-4 border-b px-4 py-5">
        {e.cancelled && <p className="rounded-lg bg-brand-red/10 px-3 py-2 text-sm font-semibold text-brand-red">{t('events.cancelledNote')}</p>}
        {!e.cancelled && e.past && <p className="rounded-lg bg-muted px-3 py-2 text-sm font-medium">{t('events.ended')}</p>}
        <div className="flex gap-3">
          <DateBlock iso={e.startsAt} />
          <div className="min-w-0">
            <LevelBadge level={e.level} label={t('levels.national')} district={e.district} assembly={e.assembly} link="directory" />
            <h1 className={`mt-1 text-2xl font-extrabold leading-tight ${e.cancelled ? 'line-through' : ''}`}>{e.title}</h1>
          </div>
        </div>
        <ul className="space-y-2.5 text-[15px]">
          <li className="flex gap-2.5"><CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" /><span>{whenLabel(e.startsAt, e.endsAt)}</span></li>
          {(e.venue || e.address) && <li className="flex gap-2.5"><MapPin className="mt-0.5 size-5 shrink-0 text-primary" /><span><b className="font-semibold">{e.venue}</b>{e.address && <span className="block text-muted-foreground">{e.address}</span>}</span></li>}
          {e.onlineUrl && <li className="flex gap-2.5"><Video className="mt-0.5 size-5 shrink-0 text-primary" /><a href={e.onlineUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 font-medium text-primary hover:underline">{t('events.joinOnline')}<ExternalLink className="size-3.5" /></a></li>}
        </ul>
        {!e.cancelled && !e.past && <RsvpButtons id={id} initial={e.viewer.rsvp} signedIn={!!me} />}
        {e.viewer.rsvp && !e.past && !e.cancelled && <p className="text-xs text-muted-foreground">{t('events.reminderNote')}</p>}
        <p className="text-sm text-muted-foreground">
          <Link href={`/events/${id}/attendees`} className="hover:underline"><b className="text-foreground">{e.goingCount}</b> {t('events.rsvp.going').toLowerCase()}</Link>
          {' · '}<Link href={`/events/${id}/attendees?tab=interested`} className="hover:underline"><b className="text-foreground">{e.interestedCount}</b> {t('events.rsvp.interested').toLowerCase()}</Link>
        </p>
      </div>
      {e.description && <div className="border-b px-4 py-4"><RichText body={e.description} className="whitespace-pre-wrap text-[15px] leading-relaxed" /></div>}
      {e.lat != null && e.lng != null && (
        <div className="space-y-2 border-b px-4 py-4">
          <MapView pins={[{ lat: e.lat, lng: e.lng, label: e.venue ?? e.title }]} className="h-60" />
          <a href={directionsUrl(e.lat, e.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium hover:bg-muted"><Navigation className="size-4" />{t('events.directions')}</a>
        </div>
      )}
      <div className="border-b px-4 py-4">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{t('events.hostedBy')}</h2>
        <Link href={`/u/${e.author.username}`} className="flex items-center gap-3 hover:underline">
          <UserAvatar name={e.author.fullName} src={e.author.avatarUrl} />
          <span><b className="inline-flex items-center gap-1">{e.author.fullName}{e.author.verified && <VerifiedBadge />}</b><span className="block text-sm text-muted-foreground">@{e.author.username}</span></span>
        </Link>
      </div>
      {going.length > 0 && (
        <div className="px-4 py-4">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{t('events.attendees')}</h2>
          <Link href={`/events/${id}/attendees`} className="flex -space-x-2">
            {going.slice(0, 12).map((p) => <UserAvatar key={p.id} name={p.fullName} src={p.avatarUrl} className="size-9 border-2 border-background text-[11px]" />)}
          </Link>
        </div>
      )}
    </>
  )
}
