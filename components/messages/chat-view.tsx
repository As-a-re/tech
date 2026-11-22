'use client'

import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArrowDown, ArrowLeft, Ban, Bell, BellOff, Eraser, Loader2, MoreVertical, Info, Pin, PinOff, User, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { useLive } from '@/hooks/use-live'
import { cn } from '@/lib/utils'
import { dayHeading, sameDay, listTime } from '@/lib/messages/format'
import type { AttachmentInput, ChatHeader, MessageView } from '@/server/messages/chat'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  chatOptionAction, editMessageAction, hideMessageAction, reactMessageAction, sendMessageAction, unsendAction,
} from '@/server/actions/messages'
import { blockAction } from '@/server/actions/social'
import { getJson, postJson } from '@/lib/live-fetch'
import { MessageBubble, type UiMessage } from './message-bubble'
import { ChatComposer } from './composer'
import { PickChatsDialog } from './pick-chats'
import { CallButtons, OngoingCallBar } from '@/components/calls/call-buttons'

type Me = { id: string; fullName: string; username: string; avatarUrl: string | null }

/** One chat: header, messages (live), and the message box. */
export function ChatView({ header: initialHeader, initial, hasMore: initialMore, me }: { header: ChatHeader; initial: MessageView[]; hasMore: boolean; me: Me }) {
  const { t } = useI18n()
  const router = useRouter()
  const id = initialHeader.id
  const [header, setHeader] = useState(initialHeader)
  // Group name, photo, members or settings changed (the page reloads its header)
  useEffect(() => { setHeader(initialHeader) }, [initialHeader])
  const [msgs, setMsgs] = useState<UiMessage[]>(initial)
  const [hasMore, setHasMore] = useState(initialMore)
  const [reply, setReply] = useState<UiMessage | null>(null)
  const [editing, setEditing] = useState<UiMessage | null>(null)
  const [forwarding, setForwarding] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'clear' | 'block'>(null)
  const [typers, setTypers] = useState<Record<string, number>>({})
  const [below, setBelow] = useState(0)
  const [loadingOlder, startOlder] = useTransition()
  const scroller = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const keepOffset = useRef<number | null>(null)
  const latest = useRef(msgs)
  latest.current = msgs

  const toBottom = (smooth = false) => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); setBelow(0) }
  useLayoutEffect(() => { toBottom() }, [])
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (keepOffset.current !== null) { el.scrollTop = el.scrollHeight - keepOffset.current; keepOffset.current = null }
  }, [msgs])

  const read = useCallback(() => { if (document.visibilityState === 'visible') void postJson(`/api/messages/${id}/read`) }, [id])
  useEffect(() => {
    read()
    const onVis = () => read()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [read])

  /** New messages since the last one we have, plus fresh ticks/reactions/edits for the ones on screen. */
  const sync = useCallback(async () => {
    const real = latest.current.filter((m) => !m.pending && !m.failed)
    const last = real.at(-1)
    const [fresh, updated] = await Promise.all([
      getJson<{ items: MessageView[] }>(`/api/messages/${id}${last ? `?after=${last.id}` : ''}`),
      real.length ? postJson<MessageView[]>(`/api/messages/${id}/refresh`, { ids: real.slice(-80).map((m) => m.id) }) : Promise.resolve([] as MessageView[]),
    ])
    const byId = new Map((updated ?? []).map((m) => [m.id, m]))
    if (!fresh) { router.refresh(); return }
    const incoming = fresh.items
    if (incoming.some((m) => m.kind === 'system')) router.refresh()
    setMsgs((cur) => {
      const have = new Set(cur.map((m) => m.id))
      const merged = cur.map((m) => byId.get(m.id) ?? m)
      return [...merged, ...incoming.filter((m) => !have.has(m.id))]
    })
    if (incoming.some((m) => !m.mine)) {
      read()
      if (nearBottom.current) requestAnimationFrame(() => toBottom(true)); else setBelow((n) => n + incoming.filter((m) => !m.mine).length)
      const from = new Set(incoming.map((m) => m.sender?.id))
      setTypers((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => !from.has(k))))
    }
  }, [id, read, router])

  useLive((e) => {
    if (e.kind === 'hello') { void sync(); return }
    if (e.conversationId !== id) return
    if (e.kind === 'message' || e.kind === 'read') void sync()
    // A call started or ended here: refresh the header (call buttons, "Join" bar)
    if (e.kind === 'call') router.refresh()
    if (e.kind === 'typing' && e.by && e.by !== me.id) { const by = e.by; setTypers((cur) => ({ ...cur, [by]: Date.now() + 5000 })) }
  })
  const [, tick] = useState(0)
  const typingIds = Object.entries(typers).filter(([, until]) => until > Date.now()).map(([k]) => k)
  useEffect(() => {
    const next = Math.min(...Object.values(typers).filter((u) => u > Date.now()))
    if (!Number.isFinite(next)) return
    const tm = setTimeout(() => tick((x) => x + 1), next - Date.now() + 50)
    return () => clearTimeout(tm)
  }, [typers])

  const older = () => startOlder(async () => {
    const first = msgs.find((m) => !m.pending)
    if (!first) return
    const r = await getJson<{ items: MessageView[]; hasMore: boolean }>(`/api/messages/${id}?before=${first.id}`)
    if (!r) return
    keepOffset.current = (scroller.current?.scrollHeight ?? 0) - (scroller.current?.scrollTop ?? 0)
    setMsgs((cur) => [...r.items, ...cur]); setHasMore(r.hasMore)
  })

  const err = (code: string) => toast.error(t(`messages.err.${code}` as MessageKey))
  const send = async (body: string, atts: AttachmentInput[], retry?: UiMessage) => {
    const clientId = retry?.id.startsWith('tmp-') ? retry.id.slice(4) : crypto.randomUUID()
    const temp: UiMessage = retry ?? {
      id: `tmp-${clientId}`, conversationId: id, kind: atts[0]?.kind ?? 'text', body: body.trim(), createdAt: new Date().toISOString(), editedAt: null, deleted: false, forwarded: false,
      sender: { id: me.id, username: me.username, fullName: me.fullName, avatarUrl: me.avatarUrl, verified: false }, mine: true,
      replyTo: reply ? { id: reply.id, senderName: reply.sender?.fullName ?? '', body: reply.body, kind: reply.kind, deleted: false } : null,
      attachments: atts.map((a) => ({ kind: a.kind, url: a.url, name: a.name ?? null, size: a.size ?? null, mime: a.mime ?? null, width: a.width ?? null, height: a.height ?? null, duration: a.duration ?? null })),
      reactions: [], status: null, pending: true,
    }
    const replyId = retry ? retry.replyTo?.id ?? null : reply?.id ?? null
    setMsgs((cur) => (retry ? cur.map((m) => (m.id === retry.id ? { ...m, pending: true, failed: false } : m)) : [...cur, temp]))
    setReply(null)
    requestAnimationFrame(() => toBottom(true))
    const r = await sendMessageAction(id, { body: temp.body, attachments: atts.length ? atts : temp.attachments.map((a) => ({ ...a })), replyToId: replyId, clientId })
    if (r.ok) setMsgs((cur) => { const without = cur.filter((m) => m.id !== temp.id && m.id !== r.message.id); return [...without, r.message] })
    else { setMsgs((cur) => cur.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m))); err(r.error) }
  }

  const option = async (opt: Parameters<typeof chatOptionAction>[1]) => {
    if (!(await chatOptionAction(id, opt))) return
    if (opt.cleared) setMsgs([])
    setHeader((h) => ({ ...h, ...(opt.muted !== undefined ? { muted: opt.muted } : {}), ...(opt.pinned !== undefined ? { pinned: opt.pinned } : {}), ...(opt.archived !== undefined ? { archived: opt.archived } : {}) }))
    router.refresh()
  }

  const typing = typingIds.length > 0
  const status = !typing ? null : header.kind !== 'group' ? t('messages.typing')
    : typingIds.length === 1 ? t('messages.typingOne', { name: header.names[typingIds[0]] ?? '…' }) : t('messages.typingMany')
  const line = status ?? (header.kind === 'group' ? t('messages.members', { n: header.members })
    : header.other?.online ? t('messages.online') : header.other?.lastSeenAt ? t('messages.lastSeen', { when: listTime(header.other.lastSeenAt, new Date(), t('messages.yesterday')) }) : '')

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-2">
        <Link href="/messages" aria-label={t('messages.back')} className="rounded-full p-2 hover:bg-muted md:hidden"><ArrowLeft className="size-5" /></Link>
        <Link href={header.kind === 'group' ? `/messages/${id}/info` : header.other ? `/u/${header.other.username}` : '#'} data-chat-title className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 hover:bg-muted/50">
          {header.kind === 'group' && !header.avatarUrl ? <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="size-5" /></span>
            : <UserAvatar name={header.title} src={header.avatarUrl} />}
          <span className="min-w-0">
            <span className="flex items-center gap-1 font-bold"><span className="truncate">{header.title}</span>{header.other?.verified && <VerifiedBadge />}</span>
            <span className={cn('block truncate text-xs', typing || header.other?.online ? 'text-green-600' : 'text-muted-foreground')}>{line}</span>
          </span>
        </Link>
        <CallButtons header={header} />
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={t('messages.options')} className="rounded-full p-2 hover:bg-muted"><MoreVertical className="size-5" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {header.other && <DropdownMenuItem asChild><Link href={`/u/${header.other.username}`}><User />{t('messages.viewProfile')}</Link></DropdownMenuItem>}
            {header.kind === 'group' && <DropdownMenuItem asChild><Link href={`/messages/${id}/info`}><Info />{t('messages.info')}</Link></DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => option({ muted: !header.muted })}>{header.muted ? <Bell /> : <BellOff />}{header.muted ? t('messages.unmute') : t('messages.mute')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => option({ pinned: !header.pinned })}>{header.pinned ? <PinOff /> : <Pin />}{header.pinned ? t('messages.unpin') : t('messages.pin')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => option({ archived: !header.archived })}><Archive />{header.archived ? t('messages.unarchive') : t('messages.archive')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setConfirm('clear')}><Eraser />{t('messages.clear')}</DropdownMenuItem>
            {header.other && header.blockedReason !== 'blocked' && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm('block')}><Ban />{t('messages.block', { name: header.other.fullName.split(' ')[0] })}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <OngoingCallBar header={header} />
      <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; if (nearBottom.current) setBelow(0) }}
        className="relative min-h-0 flex-1 overflow-y-auto bg-muted/20 py-3">
        {hasMore && <div className="flex justify-center pb-2"><button type="button" onClick={older} disabled={loadingOlder} className="rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-muted">{loadingOlder ? <Loader2 className="size-4 animate-spin" /> : t('messages.older')}</button></div>}
        {msgs.length === 0 && <p className="px-8 py-16 text-center text-sm text-muted-foreground">{t('messages.empty')}</p>}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1]
          return (
            <div key={m.id}>
              {(!prev || !sameDay(prev.createdAt, m.createdAt)) && (
                <p className="my-3 text-center"><span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">{dayHeading(m.createdAt, new Date(), { today: t('messages.today'), yesterday: t('messages.yesterday') })}</span></p>
              )}
              <MessageBubble m={m} meId={me.id} group={header.kind === 'group'} showName={header.kind === 'group' && !m.mine && (prev?.kind === 'system' || prev?.sender?.id !== m.sender?.id)}
                onReply={() => { setEditing(null); setReply(m) }} onEdit={() => { setReply(null); setEditing(m) }} onForward={() => setForwarding(m.id)}
                onRetry={() => send(m.body, [], m)}
                onUnsend={async () => { if (await unsendAction(m.id)) setMsgs((c) => c.map((x) => (x.id === m.id ? { ...x, deleted: true, body: '', attachments: [], reactions: [] } : x))) }}
                onHide={async () => { if (await hideMessageAction(m.id)) setMsgs((c) => c.filter((x) => x.id !== m.id)) }}
                onReact={async (e) => { if (await reactMessageAction(m.id, e)) void sync() }} />
            </div>
          )
        })}
        {typing && <div className="px-3 py-1"><span className="inline-flex gap-1 rounded-2xl bg-muted px-3 py-2.5">{[0, 1, 2].map((k) => <span key={k} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${k * 150}ms` }} />)}</span></div>}
      </div>
      {below > 0 && (
        <button type="button" onClick={() => toBottom(true)} className="absolute bottom-24 right-6 z-10 flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-lg">
          <ArrowDown className="size-4" />{t('messages.newBelow', { n: below })}
        </button>
      )}

      {header.canSend ? (
        <ChatComposer onSend={(b, a) => send(b, a)} onTyping={() => void postJson(`/api/messages/${id}/typing`)} onError={err}
          reply={reply ? { name: reply.mine ? t('messages.you') : reply.sender?.fullName ?? '', text: reply.body || t(`messages.kinds.${reply.kind}` as MessageKey) } : null} onCancelReply={() => setReply(null)}
          editing={editing ? { body: editing.body } : null} onCancelEdit={() => setEditing(null)}
          onSaveEdit={async (b) => { const m = editing!; setEditing(null); const r = await editMessageAction(m.id, b); if (r.ok) void sync(); else err(r.error) }} />
      ) : (
        <p className="border-t px-4 py-4 text-center text-sm text-muted-foreground">{t(`messages.cant.${header.blockedReason ?? 'not_allowed'}` as MessageKey)}</p>
      )}

      <PickChatsDialog open={!!forwarding} onOpenChange={(o) => !o && setForwarding(null)} forwardId={forwarding ?? undefined} />
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'clear' ? t('messages.clear') : t('messages.block', { name: header.other?.fullName.split(' ')[0] ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{confirm === 'clear' ? t('messages.clearConfirm') : t('profile.blockConfirmText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={async () => {
              if (confirm === 'clear') await option({ cleared: true })
              if (confirm === 'block' && header.other) { await blockAction(header.other.id); setHeader((h) => ({ ...h, canSend: false, blockedReason: 'blocked' })) }
              setConfirm(null)
            }}>{t('profile.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
