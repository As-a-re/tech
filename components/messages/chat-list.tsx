'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { Archive, BellOff, PhoneCall, Pin, Search, SquarePen, Users } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { useLive } from '@/hooks/use-live'
import { cn } from '@/lib/utils'
import { listTime } from '@/lib/messages/format'
import { systemText } from '@/lib/messages/system'
import { callLine, parseCallLog } from '@/lib/calls/text'
import type { ChatFilter, ChatListItem } from '@/server/messages/chat'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { fetchCounts, getJson } from '@/lib/live-fetch'
import { CallHistory, NewCallDialog } from '@/components/calls/call-history'
import { searchMessagesAction } from '@/server/actions/messages'
import { NewChatDialog } from './new-chat'
import { Ticks } from './ticks'

const PREVIEW: Record<string, string> = { image: '📷', video: '🎥', audio: '🎤', file: '📄' }

/** Left column of Messages: chats with the newest first, unread counts, search and filters. Updates live. */
export function ChatList({ initial, meId }: { initial: ChatListItem[]; meId: string }) {
  const { t } = useI18n()
  const pathname = usePathname()
  const active = pathname.split('/')[2]
  const [items, setItems] = useState(initial)
  const [filter, setFilter] = useState<ChatFilter>('all')
  const [q, setQ] = useState('')
  const [newChat, setNewChat] = useState(false)
  const [newCall, setNewCall] = useState(false)
  const [tab, setTab] = useState<'chats' | 'calls'>('chats')
  const [missed, setMissed] = useState(0)
  const countMissed = useCallback(() => { void fetchCounts().then((c) => setMissed(c?.calls ?? 0)) }, [])
  useEffect(() => { countMissed() }, [countMissed])
  const seen = useCallback(() => setMissed(0), [])
  const [found, setFound] = useState<Awaited<ReturnType<typeof searchMessagesAction>>>([])
  useEffect(() => {
    if (q.trim().length < 2) { setFound([]); return }
    const tm = setTimeout(() => { searchMessagesAction(q).then(setFound).catch(() => {}) }, 350)
    return () => clearTimeout(tm)
  }, [q])
  const [, start] = useTransition()
  const reload = (f = filter) => start(async () => { const r = await getJson<ChatListItem[]>(`/api/messages/chats?filter=${f}`); if (r) setItems(r) })
  useLive((e) => { if (e.kind === 'message' || e.kind === 'read' || e.kind === 'hello') reload(); if ((e.kind === 'call' || e.kind === 'hello') && tab === 'chats') countMissed() })
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return term ? items.filter((i) => i.title.toLowerCase().includes(term) || i.other?.username.toLowerCase().includes(term)) : items
  }, [items, q])
  const preview = (i: ChatListItem) => {
    if (!i.last) return t('messages.startTalking')
    if (i.last.deleted) return t('messages.deleted')
    if (i.last.kind === 'system') return systemText(i.last.body, t, meId)
    if (i.last.kind === 'call') {
      const log = parseCallLog(i.last.body)
      if (log) { const l = callLine(log, t, i.last.mine, i.kind === 'group'); return `${log.media === 'video' ? '🎥' : '📞'} ${l.title}${l.sub && !l.missed ? ` · ${l.sub}` : ''}` }
    }
    const who = i.kind === 'group' && i.last.senderName && !i.last.mine ? `${i.last.senderName.split(' ')[0]}: ` : ''
    const media = PREVIEW[i.last.kind]
    return `${who}${media ? `${media} ` : ''}${i.last.body || (media ? t(`messages.kinds.${i.last.kind}` as 'messages.kinds.image') : '')}`
  }
  return (
    <aside className={cn('flex h-full w-full shrink-0 flex-col border-r max-md:pb-14 md:w-80 lg:w-96', active && 'max-md:hidden')}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <h1 className="flex-1 text-xl font-extrabold">{t('messages.title')}</h1>
        {tab === 'chats'
          ? <button type="button" onClick={() => setNewChat(true)} aria-label={t('messages.newChat')} title={t('messages.newChat')} className="rounded-full p-2 text-primary hover:bg-primary/10"><SquarePen className="size-5" /></button>
          : <button type="button" onClick={() => setNewCall(true)} aria-label={t('calls.newCall')} title={t('calls.newCall')} className="rounded-full p-2 text-primary hover:bg-primary/10"><PhoneCall className="size-5" /></button>}
      </div>
      <div className="grid grid-cols-2 border-b px-4" role="tablist">
        {(['chats', 'calls'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn('relative py-2.5 text-sm font-semibold', tab === k ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
            {t(`messages.tabs.${k}`)}
            {k === 'calls' && missed > 0 && <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[11px] font-bold text-white">{missed}</span>}
            {tab === k && <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>
      {tab === 'calls' ? <div className="min-h-0 flex-1 overflow-y-auto"><CallHistory onSeen={seen} /></div> : <>
      <div className="px-4 pb-2 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('messages.searchPh')} aria-label={t('messages.searchPh')}
            className="h-10 w-full rounded-full border bg-muted/60 pl-9 pr-3 text-sm outline-none focus:border-primary focus:bg-background" />
        </div>
        <div className="mt-2 flex gap-2">
          {(['all', 'unread', 'archived'] as const).map((f) => (
            <button key={f} type="button" onClick={() => { setFilter(f); reload(f) }} aria-pressed={filter === f}
              className={cn('rounded-full border px-3 py-1 text-sm font-medium', filter === f ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              {f === 'archived' && <Archive className="mr-1 inline size-3.5" />}{t(`messages.filters.${f}`)}
            </button>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 && <li className="px-6 py-12 text-center text-sm text-muted-foreground">{filter === 'all' && !q ? t('messages.none') : t('messages.noneHere')}</li>}
        {shown.map((i) => (
          <li key={i.id}>
            <Link href={`/messages/${i.id}`} aria-current={active === i.id ? 'page' : undefined}
              className={cn('flex items-center gap-3 px-4 py-3 hover:bg-muted/50', active === i.id && 'bg-primary/5')}>
              <span className="relative shrink-0">
                {i.kind === 'group' && !i.avatarUrl ? <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="size-6" /></span>
                  : <UserAvatar name={i.title} src={i.avatarUrl} className="size-12" />}
                {i.other?.online && <span className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-background bg-green-500" aria-label={t('messages.online')} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <b className="truncate">{i.title}</b>{i.other?.verified && <VerifiedBadge />}
                  <span className={cn('ml-auto shrink-0 text-xs', i.unread ? 'font-semibold text-primary' : 'text-muted-foreground')}>{i.last && listTime(i.last.at, new Date(), t('messages.yesterday'))}</span>
                </span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  {i.last?.mine && !i.last.deleted && i.last.kind !== 'system' && <Ticks status={i.last.status} className="shrink-0" />}
                  <span className={cn('min-w-0 flex-1 truncate', i.last?.deleted && 'italic', i.unread && 'font-medium text-foreground')}>{preview(i)}</span>
                  {i.muted && <BellOff className="size-3.5 shrink-0" aria-label={t('messages.muted')} />}
                  {i.pinned && <Pin className="size-3.5 shrink-0" aria-label={t('messages.pinned')} />}
                  {i.unread > 0 && <span className={cn('flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold', i.muted ? 'bg-muted-foreground text-background' : 'bg-primary text-primary-foreground')}>{i.unread}</span>}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {found.length > 0 && <li className="border-y bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('messages.foundMessages')}</li>}
        {found.map((m) => (
          <li key={m.id}><Link href={`/messages/${m.conversationId}`} className="block px-4 py-2.5 hover:bg-muted/50">
            <span className="flex items-center gap-2 text-sm"><b className="truncate">{m.title}</b><span className="ml-auto shrink-0 text-xs text-muted-foreground">{listTime(m.at, new Date(), t('messages.yesterday'))}</span></span>
            <span className="line-clamp-2 text-sm text-muted-foreground">{m.sender && `${m.sender.split(' ')[0]}: `}{m.body}</span>
          </Link></li>
        ))}
      </ul>
      </>}
      <NewChatDialog open={newChat} onOpenChange={setNewChat} />
      <NewCallDialog open={newCall} onOpenChange={setNewCall} />
    </aside>
  )
}
