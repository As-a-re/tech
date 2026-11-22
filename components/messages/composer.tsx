'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, Loader2, Mic, Paperclip, Pencil, SendHorizonal, Square, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { compressImage } from '@/lib/posts/image-compress'
import { duration as fmtDuration, fileSize } from '@/lib/messages/format'
import type { AttachmentInput } from '@/server/messages/chat'

type Pending = AttachmentInput & { key: string; preview?: string; uploading: boolean }
const kindOf = (f: File): AttachmentInput['kind'] => (f.type.startsWith('image/') ? 'image' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : 'file')

async function upload(file: File): Promise<{ url: string; size: number; mime: string }> {
  const fd = new FormData(); fd.append('file', file)
  const res = await fetch('/api/uploads?for=chat', { method: 'POST', body: fd })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'upload_failed')
  return json
}

/** Message box: text (Enter sends on computers), photos/videos/documents, and voice notes. */
export function ChatComposer({ onSend, onTyping, reply, onCancelReply, editing, onSaveEdit, onCancelEdit, onError }: {
  onSend: (body: string, atts: AttachmentInput[]) => void; onTyping: () => void
  reply: { name: string; text: string } | null; onCancelReply: () => void
  editing: { body: string } | null; onSaveEdit: (body: string) => void; onCancelEdit: () => void
  onError: (code: string) => void
}) {
  const { t } = useI18n()
  const [body, setBody] = useState('')
  const [atts, setAtts] = useState<Pending[]>([])
  const [rec, setRec] = useState<{ started: number; seconds: number } | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const lastTyping = useRef(0)

  useEffect(() => { if (editing) { setBody(editing.body); area.current?.focus() } }, [editing])
  useEffect(() => { if (reply) area.current?.focus() }, [reply])
  useEffect(() => {
    const el = area.current
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 160)}px` }
  }, [body])
  useEffect(() => {
    if (!rec) return
    const id = setInterval(() => setRec((r) => (r ? { ...r, seconds: Math.floor((Date.now() - r.started) / 1000) } : r)), 250)
    return () => clearInterval(id)
  }, [rec])

  const addFiles = async (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, 10 - atts.length)) {
      const key = crypto.randomUUID()
      const kind = kindOf(f)
      setAtts((a) => [...a, { key, kind, url: '', name: f.name, preview: kind === 'image' ? URL.createObjectURL(f) : undefined, uploading: true }])
      try {
        const p = kind === 'image' ? await compressImage(f) : { file: f, width: undefined, height: undefined }
        const r = await upload(p.file)
        setAtts((a) => a.map((x) => (x.key === key ? { ...x, url: r.url, size: r.size, mime: r.mime, width: p.width, height: p.height, uploading: false } : x)))
      } catch (e) {
        setAtts((a) => a.filter((x) => x.key !== key))
        const code = (e as Error).message
        onError(code === 'too_large' ? 'upload_too_large' : code === 'unsupported' ? 'upload_unsupported' : 'upload_failed')
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const send = () => {
    if (editing) { if (body.trim()) onSaveEdit(body); setBody(''); return }
    const ready = atts.filter((a) => !a.uploading && a.url)
    if (!body.trim() && !ready.length) return
    onSend(body, ready.map(({ key: _k, preview: _p, uploading: _u, ...a }) => a))
    setBody(''); setAtts([])
  }

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
      chunks.current = []
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      r.start(250)
      recorder.current = r
      setRec({ started: Date.now(), seconds: 0 })
    } catch { onError('mic') }
  }
  const stopRec = (keep: boolean) => {
    const r = recorder.current
    if (!r || !rec) return
    const seconds = Math.max(1, Math.round((Date.now() - rec.started) / 1000))
    r.onstop = async () => {
      r.stream.getTracks().forEach((tr) => tr.stop())
      if (!keep || seconds < 1) return
      const mime = (r.mimeType || 'audio/webm').split(';')[0]
      const file = new File(chunks.current, `voice.${mime === 'audio/mp4' ? 'm4a' : mime === 'audio/ogg' ? 'ogg' : 'weba'}`, { type: mime })
      try {
        const u = await upload(file)
        onSend('', [{ kind: 'audio', url: u.url, size: u.size, mime: u.mime, duration: seconds, name: t('messages.kinds.audio') }])
      } catch { onError('upload_failed') }
    }
    r.stop()
    recorder.current = null
    setRec(null)
  }

  const uploading = atts.some((a) => a.uploading)
  return (
    <div className="border-t bg-background px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
      {(reply || editing) && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border-l-4 border-primary bg-muted/60 px-3 py-1.5 text-sm">
          {editing ? <Pencil className="size-4 text-primary" /> : null}
          <span className="min-w-0 flex-1"><b className="block text-xs text-primary">{editing ? t('messages.editing') : t('messages.replyingTo', { name: reply!.name })}</b>
            <span className="line-clamp-1 text-muted-foreground">{editing ? editing.body : reply!.text}</span></span>
          <button type="button" aria-label={t('messages.cancel')} onClick={() => { editing ? (onCancelEdit(), setBody('')) : onCancelReply() }} className="rounded-full p-1 hover:bg-muted"><X className="size-4" /></button>
        </div>
      )}
      {atts.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {atts.map((a) => (
            <div key={a.key} className="relative size-20 shrink-0 overflow-hidden rounded-xl border bg-muted">
              {a.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.preview} alt="" className="size-full object-cover" />
              ) : <span className="flex size-full flex-col items-center justify-center gap-1 p-1 text-center text-[10px]"><FileText className="size-6" /><span className="line-clamp-2">{a.name}</span>{a.size ? fileSize(a.size) : null}</span>}
              {a.uploading && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"><Loader2 className="size-5 animate-spin" /></span>}
              <button type="button" aria-label={t('messages.remove')} onClick={() => setAtts((x) => x.filter((y) => y.key !== a.key))} className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white"><X className="size-3.5" /></button>
            </div>
          ))}
        </div>
      )}
      {rec ? (
        <div className="flex items-center gap-3 px-2 py-1.5">
          <span className="size-3 animate-pulse rounded-full bg-brand-red" />
          <span className="flex-1 text-sm font-medium tabular-nums">{t('messages.recording')} {fmtDuration(rec.seconds)}</span>
          <button type="button" onClick={() => stopRec(false)} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">{t('messages.cancel')}</button>
          <button type="button" onClick={() => stopRec(true)} aria-label={t('messages.sendVoice')} className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Square className="size-4 fill-current" /></button>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          {!editing && <button type="button" onClick={() => fileRef.current?.click()} aria-label={t('messages.attach')} className="mb-0.5 rounded-full p-2.5 text-muted-foreground hover:bg-muted hover:text-primary"><Paperclip className="size-5" /></button>}
          <textarea ref={area} value={body} rows={1} maxLength={4000} placeholder={t('messages.typePh')} aria-label={t('messages.typePh')}
            onChange={(e) => { setBody(e.target.value); if (Date.now() - lastTyping.current > 3000) { lastTyping.current = Date.now(); onTyping() } }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); send() } if (e.key === 'Escape' && editing) { onCancelEdit(); setBody('') } }}
            className="max-h-40 min-h-11 flex-1 resize-none rounded-3xl border bg-muted/50 px-4 py-2.5 text-[15px] outline-none focus:border-primary focus:bg-background" />
          {body.trim() || atts.length || editing ? (
            <button type="button" onClick={send} disabled={uploading} aria-label={t('messages.send')} className={cn('mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50')}>
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <SendHorizonal className="size-5" />}
            </button>
          ) : (
            <button type="button" onClick={startRec} aria-label={t('messages.record')} className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Mic className="size-5" /></button>
          )}
          <input ref={fileRef} type="file" hidden multiple accept="image/*,video/*,audio/*,application/pdf" onChange={(e) => addFiles(e.target.files)} />
        </div>
      )}
    </div>
  )
}
