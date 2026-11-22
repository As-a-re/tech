'use client'

import { useRef, useState, useTransition } from 'react'
import { BarChart3, CalendarClock, Globe2, ImagePlus, Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { MAX_POST_LENGTH } from '@/lib/posts/rich-text'
import { compressImage } from '@/lib/posts/image-compress'
import type { PostView } from '@/lib/posts/types'
import { createPostAction } from '@/server/actions/posts'
import { UserAvatar } from '@/components/common/user-avatar'
import { Button } from '@/components/ui/button'
import { QuoteCard } from './quote-card'
import { cn } from '@/lib/utils'

type Me = { fullName: string; avatarUrl: string | null }
type Media = { key: string; url?: string; preview: string; kind: 'image' | 'video'; alt: string; width?: number; height?: number; uploading: boolean }
type Mode = 'post' | 'reply' | 'quote'

export const POSTED_EVENT = 'papa:posted'

export function Composer({ me, mode = 'post', target, onDone, autoFocus, compact, initialText }: { me: Me; mode?: Mode; target?: PostView; onDone?: () => void; autoFocus?: boolean; compact?: boolean; initialText?: string }) {
  const { t } = useI18n()
  const [body, setBody] = useState(initialText ?? '')
  const [media, setMedia] = useState<Media[]>([])
  const [poll, setPoll] = useState<{ options: string[]; minutes: number } | null>(null)
  const [publishAt, setPublishAt] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [replySetting, setReplySetting] = useState<'everyone' | 'following' | 'mentioned'>('everyone')
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(!compact)
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const err = (k: string) => t(`compose.err.${k}` as MessageKey)

  const uploading = media.some((m) => m.uploading)
  const len = body.trim().length
  const over = len > MAX_POST_LENGTH
  const canSend = !pending && !uploading && !over && (len > 0 || media.length > 0 || !!poll || mode === 'quote')

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    const list = [...files]
    const isVideo = list.some((f) => f.type.startsWith('video/'))
    if ((isVideo && (list.length > 1 || media.length)) || media.some((m) => m.kind === 'video')) return setError(err('media_mixed'))
    if (media.length + list.length > 4) return setError(err('media_count'))
    for (const f of list) {
      const key = crypto.randomUUID()
      const kind = f.type.startsWith('video/') ? 'video' : 'image'
      setMedia((m) => [...m, { key, preview: URL.createObjectURL(f), kind, alt: '', uploading: true }])
      try {
        const prepared = kind === 'image' ? await compressImage(f) : { file: f, width: undefined, height: undefined }
        const fd = new FormData(); fd.append('file', prepared.file)
        const res = await fetch('/api/uploads', { method: 'POST', body: fd })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error === 'too_large' ? 'upload_too_large' : json.error === 'unsupported' ? 'upload_unsupported' : 'upload_failed')
        setMedia((m) => m.map((x) => (x.key === key ? { ...x, url: json.url, uploading: false, width: prepared.width, height: prepared.height } : x)))
      } catch (e) {
        setMedia((m) => m.filter((x) => x.key !== key))
        setError(err((e as Error).message.startsWith('upload_') ? (e as Error).message : 'upload_failed'))
      }
    }
  }

  function send(draft = false) {
    setError(null)
    start(async () => {
      const r = await createPostAction({
        body, draft,
        replyToId: mode === 'reply' ? target?.id : null, quoteOfId: mode === 'quote' ? target?.id : null,
        media: media.filter((m) => m.url).map((m) => ({ url: m.url!, kind: m.kind, alt: m.alt || null, width: m.width ?? null, height: m.height ?? null })),
        poll: poll ? { options: poll.options, minutes: poll.minutes } : null,
        replySetting, publishAt: publishAt ? new Date(publishAt).toISOString() : null,
      })
      if (!r.ok) return setError(err(r.error))
      toast.success(r.draft ? t('compose.drafted') : r.scheduled ? t('compose.scheduled') : t('compose.posted'))
      if (r.post) window.dispatchEvent(new CustomEvent(POSTED_EVENT, { detail: r.post }))
      setBody(''); setMedia([]); setPoll(null); setPublishAt(''); setShowSchedule(false); setReplySetting('everyone')
      if (compact) setExpanded(false)
      onDone?.()
    })
  }

  const placeholder = mode === 'reply' ? t('compose.replyPlaceholder') : mode === 'quote' ? t('compose.quotePlaceholder') : t('compose.placeholder')
  const minLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000 + 5 * 60000).toISOString().slice(0, 16)

  return (
    <div className="flex gap-3">
      <UserAvatar name={me.fullName} src={me.avatarUrl} className="mt-1" />
      <div className="min-w-0 flex-1">
        {mode === 'reply' && target && <p className="mb-1 text-sm text-muted-foreground">{t('compose.replyingTo', { username: target.author.username })}</p>}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} onFocus={() => setExpanded(true)} autoFocus={autoFocus} placeholder={placeholder} aria-label={placeholder}
          rows={expanded ? 3 : 1} className="w-full resize-none bg-transparent py-2 text-[17px] leading-relaxed outline-none placeholder:text-muted-foreground"
          onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 420)}px` }} />

        {media.length > 0 && (
          <div className={cn('mt-2 grid gap-2', media.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
            {media.map((m) => (
              <div key={m.key} className="relative overflow-hidden rounded-xl border bg-muted">
                {m.kind === 'video'
                  ? <video src={m.preview} className="max-h-72 w-full" controls={!m.uploading} />
                  : /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.preview} alt="" className="max-h-72 w-full object-cover" />}
                {m.uploading && <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 text-sm text-white"><Loader2 className="size-4 animate-spin" />{t('compose.uploading')}</span>}
                <button type="button" aria-label={t('compose.removeMedia')} onClick={() => setMedia((x) => x.filter((y) => y.key !== m.key))} className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white"><X className="size-4" /></button>
                {m.kind === 'image' && !m.uploading && (
                  <input value={m.alt} maxLength={500} onChange={(e) => setMedia((x) => x.map((y) => (y.key === m.key ? { ...y, alt: e.target.value } : y)))}
                    placeholder={t('compose.altText')} aria-label={t('compose.altText')} className="w-full border-t bg-background px-2 py-1.5 text-xs outline-none" />
                )}
              </div>
            ))}
          </div>
        )}

        {poll && (
          <div className="mt-2 space-y-2 rounded-xl border p-3">
            {poll.options.map((o, i) => (
              <input key={i} value={o} maxLength={30} onChange={(e) => setPoll({ ...poll, options: poll.options.map((x, j) => (j === i ? e.target.value : x)) })}
                placeholder={t('compose.choice', { n: i + 1 })} aria-label={t('compose.choice', { n: i + 1 })} className="h-10 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus:border-primary" />
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {poll.options.length < 4 ? <button type="button" onClick={() => setPoll({ ...poll, options: [...poll.options, ''] })} className="flex items-center gap-1 text-sm font-medium text-primary"><Plus className="size-4" />{t('compose.addChoice')}</button> : <span />}
              <label className="flex items-center gap-2 text-sm">{t('compose.pollLength')}
                <select value={poll.minutes} onChange={(e) => setPoll({ ...poll, minutes: Number(e.target.value) })} className="rounded-md border bg-background px-2 py-1">
                  {[[60, 'h1'], [360, 'h6'], [1440, 'd1'], [4320, 'd3'], [10080, 'd7']].map(([m, k]) => <option key={m} value={m}>{t(`compose.${k}` as MessageKey)}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => setPoll(null)} className="text-sm text-destructive">{t('compose.removePoll')}</button>
            </div>
          </div>
        )}

        {mode === 'quote' && target && <div className="mt-2"><QuoteCard post={target} /></div>}

        {showSchedule && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm">
            <label htmlFor="publishAt">{t('compose.scheduleFor')}</label>
            <input id="publishAt" type="datetime-local" min={minLocal} value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="rounded-md border bg-background px-2 py-1" />
            <button type="button" onClick={() => { setPublishAt(''); setShowSchedule(false) }} className="text-muted-foreground hover:underline">{t('compose.clearSchedule')}</button>
          </div>
        )}

        {error && <p role="alert" className="mt-2 text-sm font-medium text-destructive">{error}</p>}

        {expanded && (
          <>
            {mode === 'post' && (
              <label className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-primary hover:bg-primary/5">
                <Globe2 className="size-4" />
                <select value={replySetting} onChange={(e) => setReplySetting(e.target.value as typeof replySetting)} aria-label={t('compose.whoCanReply')} className="bg-transparent outline-none">
                  <option value="everyone">{t('compose.everyone')}</option><option value="following">{t('compose.followingReply')}</option><option value="mentioned">{t('compose.mentioned')}</option>
                </select>
              </label>
            )}
            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
              <div className="flex items-center gap-0.5 text-primary">
                <input ref={fileRef} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
                <IconBtn label={t('compose.addPhoto')} disabled={!!poll || media.length >= 4 || media.some((m) => m.kind === 'video')} onClick={() => fileRef.current?.click()}><ImagePlus className="size-5" /></IconBtn>
                {mode !== 'reply' && <IconBtn label={t('compose.addPoll')} disabled={media.length > 0 || !!poll} onClick={() => setPoll({ options: ['', ''], minutes: 1440 })}><BarChart3 className="size-5" /></IconBtn>}
                {mode === 'post' && <IconBtn label={t('compose.addSchedule')} onClick={() => setShowSchedule((s) => !s)}><CalendarClock className="size-5" /></IconBtn>}
              </div>
              <div className="flex items-center gap-3">
                {len > 0 && <Counter len={len} />}
                {mode === 'post' && (len > 0 || media.length > 0 || poll) && <Button type="button" variant="ghost" size="sm" disabled={!canSend} onClick={() => send(true)}>{t('compose.saveDraft')}</Button>}
                <Button type="button" disabled={!canSend} onClick={() => send(false)} className="rounded-full px-5 font-semibold">
                  {pending && <Loader2 className="animate-spin" />}{mode === 'reply' ? t('compose.reply') : publishAt ? t('compose.schedule') : t('compose.post')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="rounded-full p-2 hover:bg-primary/10 disabled:opacity-40">{children}</button>
}

/** Ring that fills toward the 1,000-character limit; shows the count near the end. */
function Counter({ len }: { len: number }) {
  const r = 9, c = 2 * Math.PI * r, pct = Math.min(len / MAX_POST_LENGTH, 1), left = MAX_POST_LENGTH - len
  return (
    <span className="flex items-center gap-1 text-xs tabular-nums" aria-live="polite">
      <svg viewBox="0 0 24 24" className="size-6 -rotate-90"><circle cx="12" cy="12" r={r} fill="none" strokeWidth="2.5" className="stroke-muted" />
        <circle cx="12" cy="12" r={r} fill="none" strokeWidth="2.5" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className={left < 0 ? 'stroke-destructive' : left < 50 ? 'stroke-amber-500' : 'stroke-primary'} /></svg>
      {left < 100 && <span className={left < 0 ? 'text-destructive' : 'text-muted-foreground'}>{left}</span>}
    </span>
  )
}
