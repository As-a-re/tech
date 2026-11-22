import Link from 'next/link'
import { Radio, PlayCircle, Users } from 'lucide-react'
import type { TFunction } from '@/lib/i18n/config'
import { dayLabel, timeLabel } from '@/lib/community/dates'
import { cn } from '@/lib/utils'
import type { LiveCard } from '@/server/live/live'

export const whenText = (iso: string) => `${dayLabel(iso)} · ${timeLabel(iso)}`

export function LiveBadge({ t, className }: { t: TFunction; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-md bg-[#FF3333] px-2 py-0.5 text-[11px] font-black tracking-wider text-white', className)}><span className="size-1.5 animate-pulse rounded-full bg-white" />{t('live.liveNow')}</span>
}

/** A live service: cover with LIVE / time badge. */
export function LiveTile({ l, t }: { l: LiveCard; t: TFunction }) {
  return (
    <Link href={`/live/${l.id}`} className="group block" data-live-card={l.status}>
      <div className="relative aspect-video overflow-hidden rounded-xl border bg-gradient-to-br from-brand-blue to-brand-red">
        {l.coverUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.coverUrl} alt="" className="size-full object-cover transition group-hover:scale-[1.02]" />
          : <Radio className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-white/80" />}
        <span className="absolute left-2 top-2">{l.status === 'live' ? <LiveBadge t={t} /> : l.status === 'ended'
          ? <span className="flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white"><PlayCircle className="size-3.5" />{t('live.replay')}</span>
          : <span className="rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">{whenText(l.scheduledAt)}</span>}</span>
        {l.status === 'live' && <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-xs text-white"><Users className="size-3.5" />{l.viewers}</span>}
      </div>
      <p className="mt-1.5 line-clamp-2 font-bold leading-snug">{l.title}</p>
      <p className="text-xs text-muted-foreground">{l.levelName}{l.status === 'ended' && l.endedAt ? ` · ${dayLabel(l.endedAt)}` : ''}</p>
    </Link>
  )
}

/** Red bar on Home while a service is live. */
export function LiveNowBar({ lives, t }: { lives: LiveCard[]; t: TFunction }) {
  if (!lives.length) return null
  const l = lives[0]
  return (
    <Link href={`/live/${l.id}`} className="flex items-center gap-3 border-b bg-[#FF3333]/10 px-4 py-2.5 hover:bg-[#FF3333]/15" data-live-now>
      <LiveBadge t={t} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.title}</span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3.5" />{t('live.watchers', { n: l.viewers })}</span>
    </Link>
  )
}
