'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellRing, Pencil, Radio, Send, Share2, Trash2, Users, Video } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { timeLabel } from '@/lib/community/dates'
import type { LiveComment, LiveDetail } from '@/server/live/live'
import { UserAvatar } from '@/components/common/user-avatar'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteLiveAction, endLiveAction, goLiveAction, liveReminderAction, removeLiveCommentAction } from '@/server/actions/live'
import { GiveButton } from './give-sheet'
import { StudioViewer } from './studio-viewer'
import { LiveBadge, whenText } from './live-card'

const REACTIONS = ['🙏🏾', '🔥', '❤️', '🙌', '👏']
type Float = { id: number; emoji: string; left: number }

function viewerKey() {
  try {
    let k = localStorage.getItem('papa_viewer')
    if (!k) { k = crypto.randomUUID(); localStorage.setItem('papa_viewer', k) }
    return k
  } catch { return crypto.randomUUID() }
}

/** Watch a service: the player, live chat, reactions, viewers and Give. Updates every few seconds. */
export function LiveWatch({ l, me, initialComments }: { l: LiveDetail; me: { id: string } | null; initialComments: LiveComment[] }) {
  const { t } = useI18n()
  const router = useRouter()
  const [key, setKey] = useState('')
  const [status, setStatus] = useState(l.status)
  const [viewers, setViewers] = useState(l.viewers)
  const [comments, setComments] = useState(initialComments)
  const [text, setText] = useState('')
  const [floats, setFloats] = useState<Float[]>([])
  const [reminded, setReminded] = useState(l.reminded)
  const [confirm, setConfirm] = useState<null | 'end' | 'delete'>(null)
  const [pending, start] = useTransition()
  const counts = useRef<Record<string, number>>(l.reactions)
  const chatBox = useRef<HTMLDivElement>(null)
  const latest = useRef(comments)
  latest.current = comments

  useEffect(() => { setKey(viewerKey()) }, [])
  const float = useCallback((emoji: string) => {
    const id = Math.random()
    setFloats((f) => [...f.slice(-20), { id, emoji, left: 10 + Math.random() * 70 }])
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2600)
  }, [])

  // Poll: status, viewers, reactions (others' reactions float up too) and new comments
  useEffect(() => {
    if (!key) return
    let stop = false
    const tick = async () => {
      const after = latest.current.at(-1)?.id
      const r = await fetch(`/api/live/${l.id}/poll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, after }) }).then((x) => x.ok ? x.json() : null).catch(() => null) as
        null | { status: typeof status; viewers: number; reactions: Record<string, number>; comments: LiveComment[]; removed: string[] }
      if (!r || stop) return
      if (r.status !== status) { setStatus(r.status); router.refresh() }
      setViewers(r.viewers)
      for (const [e, n] of Object.entries(r.reactions)) { const d = Math.min(5, n - (counts.current[e] ?? 0)); for (let i = 0; i < d; i++) setTimeout(() => float(e), i * 200) }
      counts.current = r.reactions
      if (r.comments.length || r.removed.length) setComments((cur) => {
        const have = new Set(cur.map((c) => c.id))
        return [...cur, ...r.comments.filter((c) => !have.has(c.id))].filter((c) => !r.removed.includes(c.id)).slice(-200)
      })
    }
    void tick()
    const id = setInterval(tick, status === 'ended' ? 30_000 : 3000)
    return () => { stop = true; clearInterval(id) }
  }, [key, l.id, status, router, float])

  useEffect(() => { const el = chatBox.current; if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight }, [comments])

  const react = (e: string) => {
    float(e); counts.current = { ...counts.current, [e]: (counts.current[e] ?? 0) + 1 }
    void fetch(`/api/live/${l.id}/react`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, emoji: e }) })
  }
  const send = () => {
    const body = text.trim()
    if (!body) return
    setText('')
    void fetch(`/api/live/${l.id}/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) }).then((x) => x.json()).then((r) => {
      if (r?.ok) setComments((cur) => cur.some((c) => c.id === r.comment.id) ? cur : [...cur, r.comment])
      else toast.error(t(`live.chat.err.${r?.error ?? 'closed'}` as MessageKey))
    })
  }
  const share = async () => {
    const url = `${location.origin}/live/${l.id}`
    if (navigator.share) await navigator.share({ title: l.title, url }).catch(() => {})
    else { await navigator.clipboard.writeText(url).catch(() => {}); toast.success(url) }
  }

  const player = status === 'live'
    ? (l.source === 'youtube' && l.youtube ? <iframe src={`https://www.youtube-nocookie.com/embed/${l.youtube}?autoplay=1&rel=0&modestbranding=1`} title={l.title} className="size-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      : key ? <StudioViewer liveId={l.id} viewerKey={key} /> : null)
    : status === 'ended'
      ? (l.replayYoutube ? <iframe src={`https://www.youtube-nocookie.com/embed/${l.replayYoutube}?rel=0&modestbranding=1`} title={l.title} className="size-full" allow="encrypted-media; picture-in-picture" allowFullScreen />
        : l.replayFile ? <video src={l.replayFile} controls playsInline preload="metadata" poster={l.coverUrl ?? undefined} className="size-full bg-black object-contain" data-replay />
          : l.source === 'youtube' && l.youtube ? <iframe src={`https://www.youtube-nocookie.com/embed/${l.youtube}?rel=0`} title={l.title} className="size-full" allowFullScreen />
            : <Cover l={l} text={t('live.noReplay')} />)
      : <Cover l={l} text={t('live.startsIn', { when: whenText(l.scheduledAt) })} sub={t('live.waiting')} />

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col lg:h-[calc(100dvh-4rem)] lg:flex-row" data-live-watch={status}>
      <section className="lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:overflow-y-auto">
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          {player}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {floats.map((f) => <span key={f.id} className="absolute bottom-2 animate-[float_2.6s_ease-out_forwards] text-3xl" style={{ left: `${f.left}%` }}>{f.emoji}</span>)}
          </div>
          {status === 'live' && <span className="absolute left-3 top-3 flex items-center gap-2"><LiveBadge t={t} /><span className="flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-xs text-white" data-viewers><Users className="size-3.5" />{viewers}</span></span>}
        </div>
        <div className="space-y-3 border-b px-4 py-3">
          <h1 className="text-xl font-extrabold leading-tight" data-live-title>{l.title}</h1>
          <p className="text-sm text-muted-foreground">{t('live.fromLevel', { name: l.levelName })} · {status === 'live' ? t('live.watchers', { n: viewers }) : status === 'ended' ? (l.endedAt ? t('live.endedAt', { when: whenText(l.endedAt) }) : '') : whenText(l.scheduledAt)}</p>
          <div className="flex flex-wrap gap-2">
            {l.giving && status !== 'ended' && <GiveButton liveId={l.id} />}
            {status === 'scheduled' && me && <button type="button" disabled={pending} aria-pressed={reminded} onClick={() => start(async () => { setReminded(!reminded); await liveReminderAction(l.id, !reminded); if (!reminded) toast.success(t('live.remindHint')) })}
              className={cn('flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted', reminded && 'border-primary text-primary')}>{reminded ? <BellRing className="size-4" /> : <Bell className="size-4" />}{reminded ? t('live.reminded') : t('live.remind')}</button>}
            <button type="button" onClick={share} className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted"><Share2 className="size-4" />{t('live.share')}</button>
          </div>
          {l.canHost && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-dashed p-2" data-host-controls>
              {l.source === 'studio' && status !== 'ended' && <Link href={`/live/${l.id}/studio`} className="flex items-center gap-1.5 rounded-full bg-[#FF3333] px-4 py-2 text-sm font-bold text-white"><Video className="size-4" />{t('live.host.studio')}</Link>}
              {l.source === 'youtube' && status === 'scheduled' && <button type="button" disabled={pending} onClick={() => start(async () => { if (await goLiveAction(l.id)) { setStatus('live'); router.refresh() } })}
                className="flex items-center gap-1.5 rounded-full bg-[#FF3333] px-4 py-2 text-sm font-bold text-white"><Radio className="size-4" />{t('live.host.goLive')}</button>}
              {status === 'live' && <button type="button" onClick={() => setConfirm('end')} className="rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted">{t('live.host.end')}</button>}
              <Link href={`/live/${l.id}/edit`} className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted"><Pencil className="size-4" />{t('live.host.edit')}</Link>
              <button type="button" onClick={() => setConfirm('delete')} className="flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold text-destructive hover:bg-muted"><Trash2 className="size-4" />{t('live.host.delete')}</button>
            </div>
          )}
          {l.description && <p className="whitespace-pre-line text-[15px]">{l.description}</p>}
        </div>
      </section>

      <aside className="flex min-h-[420px] flex-1 flex-col border-l lg:w-96 lg:flex-none">
        <h2 className="border-b px-4 py-2.5 font-bold">{t('live.chat.title')}</h2>
        <div ref={chatBox} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3" data-live-chat>
          {comments.map((c) => (
            <div key={c.id} className="group flex gap-2 text-sm" data-comment>
              <UserAvatar name={c.user.fullName} src={c.user.avatarUrl} className="size-7 text-[10px]" />
              <p className="min-w-0 flex-1"><b className="mr-1">{c.user.fullName}</b><span className="break-words">{c.body}</span> <span className="text-xs text-muted-foreground">{timeLabel(c.at)}</span></p>
              {me && (me.id === c.user.id || l.canHost) && <button type="button" aria-label={t('live.chat.remove')} onClick={async () => { if (await removeLiveCommentAction(c.id)) setComments((cur) => cur.filter((x) => x.id !== c.id)) }}
                className="opacity-0 group-hover:opacity-100 pointer-coarse:opacity-60"><Trash2 className="size-3.5 text-muted-foreground" /></button>}
            </div>
          ))}
        </div>
        {status !== 'ended' && (
          <div className="flex justify-around border-t px-2 py-1.5">
            {REACTIONS.map((e) => <button key={e} type="button" onClick={() => react(e)} aria-label={e} className="rounded-full p-1.5 text-2xl transition hover:scale-125 active:scale-90">{e}</button>)}
          </div>
        )}
        <div className="border-t p-2">
          {status === 'ended' ? <p className="py-2 text-center text-sm text-muted-foreground">{t('live.chat.closed')}</p>
            : me ? (
              <form onSubmit={(e) => { e.preventDefault(); send() }} className="flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder={t('live.chat.placeholder')} aria-label={t('live.chat.placeholder')}
                  className="h-10 min-w-0 flex-1 rounded-full border bg-muted/60 px-4 text-sm outline-none focus:border-primary" />
                <button type="submit" aria-label={t('live.chat.send')} className="rounded-full bg-primary p-2.5 text-primary-foreground"><Send className="size-4" /></button>
              </form>
            ) : <Link href={`/login?next=/live/${l.id}`} className="block py-2 text-center text-sm font-semibold text-primary">{t('live.chat.signIn')}</Link>}
        </div>
      </aside>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{confirm === 'end' ? t('live.host.endConfirm') : t('live.host.deleteConfirm')}</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => start(async () => {
              if (confirm === 'end') { if (await endLiveAction(l.id)) { setStatus('ended'); router.refresh() } }
              else if (await deleteLiveAction(l.id)) router.push('/live')
            })}>{confirm === 'end' ? t('live.host.end') : t('live.host.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Cover({ l, text, sub }: { l: LiveDetail; text: string; sub?: string }) {
  return (
    <div className="relative size-full">
      {l.coverUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.coverUrl} alt="" className="absolute inset-0 size-full object-cover opacity-50" />}
      <div className="relative flex size-full flex-col items-center justify-center gap-1 p-4 text-center text-white">
        <Radio className="size-10" /><p className="text-lg font-bold">{text}</p>{sub && <p className="max-w-sm text-sm text-white/80">{sub}</p>}
      </div>
    </div>
  )
}
