'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Search, Users, Video } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { listTime } from '@/lib/messages/format'
import { callDuration } from '@/lib/calls/text'
import { useLive } from '@/hooks/use-live'
import { getJson } from '@/lib/live-fetch'
import type { CallHistoryItem } from '@/server/calls/calls'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/common/user-avatar'
import { searchMembersAction } from '@/server/actions/search'
import { startChatAction } from '@/server/actions/messages'
import { useCalls } from './call-provider'

/** Calls tab: history with incoming/outgoing/missed, tap to call back. Opening it clears the missed-call badge. */
export function CallHistory({ onSeen }: { onSeen?: () => void }) {
  const { t } = useI18n()
  const { start } = useCalls()
  const [items, setItems] = useState<CallHistoryItem[] | null>(null)
  const load = useCallback(async () => { const r = await getJson<CallHistoryItem[]>('/api/calls/history?seen=1'); if (r) { setItems(r); onSeen?.() } }, [onSeen])
  useEffect(() => { void load() }, [load])
  useLive((e) => { if (e.kind === 'call' || e.kind === 'hello') void load() })
  if (!items) return <p className="px-6 py-12 text-center text-sm text-muted-foreground">…</p>
  if (!items.length) return <p className="px-6 py-12 text-center text-sm text-muted-foreground">{t('calls.none')}</p>
  return (
    <ul data-call-history>
      {items.map((c) => {
        const Arrow = c.missed ? PhoneMissed : c.outgoing ? PhoneOutgoing : PhoneIncoming
        return (
          <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
            <Link href={`/messages/${c.conversationId}`} className="flex min-w-0 flex-1 items-center gap-3">
              {c.kind === 'group' && !c.avatarUrl ? <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="size-6" /></span>
                : <UserAvatar name={c.title} src={c.avatarUrl} className="size-12" />}
              <span className="min-w-0">
                <b className={cn('block truncate', c.missed && 'text-[#FF3333]')}>{c.title}</b>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Arrow className={cn('size-4 shrink-0', c.missed ? 'text-[#FF3333]' : 'text-green-600')} />
                  <span className="truncate">{listTime(c.startedAt, new Date(), t('messages.yesterday'))}{c.duration > 0 && ` · ${callDuration(c.duration)}`}</span>
                </span>
              </span>
            </Link>
            <button type="button" onClick={() => start(c.conversationId, c.media)} aria-label={c.media === 'video' ? t('calls.videoCall') : t('calls.voiceCall')}
              className="rounded-full p-2.5 text-primary hover:bg-primary/10">{c.media === 'video' ? <Video className="size-5" /> : <Phone className="size-5" />}</button>
          </li>
        )
      })}
    </ul>
  )
}

/** New call: find a member, then voice or video. */
export function NewCallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n()
  const { start } = useCalls()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Awaited<ReturnType<typeof searchMembersAction>>>([])
  const [pending, run] = useTransition()
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const id = setTimeout(() => run(async () => setHits(await searchMembersAction(q))), 200)
    return () => clearTimeout(id)
  }, [q])
  const call = (userId: string, media: 'voice' | 'video') => run(async () => {
    const r = await startChatAction(userId)
    if (!r.ok) { toast.error(t(`messages.err.${r.error}` as MessageKey)); return }
    onOpenChange(false)
    start(r.id, media)
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('calls.pickPerson')}</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('messages.findPerson')} aria-label={t('messages.findPerson')}
            className="h-11 w-full rounded-full border bg-muted/60 pl-9 pr-3 text-sm outline-none focus:border-primary" />
        </div>
        <ul className="max-h-80 divide-y overflow-y-auto">
          {hits.map((h) => (
            <li key={h.id} className="flex items-center gap-3 px-1 py-2.5">
              <UserAvatar name={h.full_name} src={h.avatar_url} />
              <span className="min-w-0 flex-1"><b className="block truncate">{h.full_name}</b><span className="block truncate text-sm text-muted-foreground">@{h.username} · {h.assembly_name}</span></span>
              <button type="button" disabled={pending} onClick={() => call(h.id, 'voice')} aria-label={t('calls.voiceCall')} className="rounded-full p-2 text-primary hover:bg-primary/10"><Phone className="size-5" /></button>
              <button type="button" disabled={pending} onClick={() => call(h.id, 'video')} aria-label={t('calls.videoCall')} className="rounded-full p-2 text-primary hover:bg-primary/10"><Video className="size-5" /></button>
            </li>
          ))}
          {q.trim().length >= 2 && !hits.length && !pending && <li className="py-6 text-center text-sm text-muted-foreground">{t('messages.noPeople')}</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
