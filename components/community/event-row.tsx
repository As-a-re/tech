import Link from 'next/link'
import { MapPin, Users, Video } from 'lucide-react'
import type { EventView } from '@/server/community/events'
import { dayNumber, monthShort, whenLabel } from '@/lib/community/dates'
import { cn } from '@/lib/utils'
import { LevelBadge } from './level-badge'

export function DateBlock({ iso, className }: { iso: string; className?: string }) {
  return (
    <div className={cn('flex size-14 shrink-0 flex-col items-center justify-center rounded-xl border bg-background text-center leading-none', className)}>
      <span className="text-[11px] font-bold tracking-wider text-brand-red">{monthShort(iso)}</span>
      <span className="mt-1 text-xl font-extrabold">{dayNumber(iso)}</span>
    </div>
  )
}

/** One event in a list. */
export function EventRow({ e, labels }: { e: EventView; labels: { national: string; going: string; cancelled: string; online: string } }) {
  return (
    <Link href={`/events/${e.id}`} className={cn('flex gap-3 border-b px-4 py-3.5 hover:bg-muted/30', (e.cancelled || e.past) && 'opacity-70')}>
      <DateBlock iso={e.startsAt} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <LevelBadge level={e.level} label={labels.national} district={e.district} assembly={e.assembly} link={null} />
          {e.cancelled && <span className="rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-bold uppercase text-white">{labels.cancelled}</span>}
        </div>
        <p className={cn('mt-1 font-bold leading-snug', e.cancelled && 'line-through')}>{e.title}</p>
        <p className="text-sm text-muted-foreground">{whenLabel(e.startsAt, e.endsAt)}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          {e.venue && <span className="flex min-w-0 items-center gap-1"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{e.venue}</span></span>}
          {e.onlineUrl && <span className="flex items-center gap-1"><Video className="size-3.5" />{labels.online}</span>}
          {e.goingCount > 0 && <span className="flex items-center gap-1"><Users className="size-3.5" />{labels.going.replace('{n}', String(e.goingCount))}</span>}
        </p>
      </div>
      {e.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.coverUrl} alt="" loading="lazy" className="hidden size-20 shrink-0 rounded-xl object-cover sm:block" />
      )}
    </Link>
  )
}
