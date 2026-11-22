'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Upload, Video, Youtube } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ImagePicker, toPicked, type PickedImage } from '@/components/common/image-picker'
import { saveLiveAction } from '@/server/actions/live'
import type { LiveInput } from '@/server/live/live'
import { uploadFile } from '@/components/library/upload'

const input = 'h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary'

/** Schedule a live service (or edit it, and add the replay afterwards). */
export function LiveForm({ id, initial, levels, studioOn }: { id?: string; initial?: LiveInput; levels: ('national' | 'district' | 'local')[]; studioOn: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const soon = new Date(Date.now() + 3600_000)
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  const [v, setV] = useState<LiveInput>(initial ?? { title: '', description: '', level: levels[0] ?? 'local', source: studioOn ? 'studio' : 'youtube', youtubeUrl: '', scheduledAt: local(soon), replayUrl: '', giving: true })
  const set = <K extends keyof LiveInput>(k: K, val: LiveInput[K]) => setV((x) => ({ ...x, [k]: val }))
  const [cover, setCover] = useState<PickedImage[]>(initial?.coverUrl ? toPicked([{ url: initial.coverUrl }]) : [])
  const [up, setUp] = useState<number | null>(null)
  const [pending, start] = useTransition()
  const err = (c: string) => toast.error(t(`live.err.${c}` as MessageKey))
  const submit = () => start(async () => {
    if (cover.some((c) => c.uploading) || up !== null) return
    const r = await saveLiveAction({ ...v, coverUrl: cover[0]?.url ?? null, scheduledAt: new Date(v.scheduledAt).toISOString() }, id)
    if (!r.ok) { err(r.error); return }
    toast.success(t('live.form.saved'))
    router.push(`/live/${r.id}`)
  })
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-5 px-4 py-5" data-live-form>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t('live.form.title')}</span>
        <input name="title" required maxLength={120} placeholder={t('live.form.titlePh')} value={v.title} onChange={(e) => set('title', e.target.value)} className={input} /></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t('live.form.description')}</span>
        <textarea name="description" rows={3} maxLength={2000} value={v.description ?? ''} onChange={(e) => set('description', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('live.form.when')}</span>
          <input name="scheduledAt" type="datetime-local" required value={v.scheduledAt} onChange={(e) => set('scheduledAt', e.target.value)} className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('live.form.level')}</span>
          <select name="level" value={v.level} onChange={(e) => set('level', e.target.value as LiveInput['level'])} className={input}>{levels.map((l) => <option key={l} value={l}>{t(`admin.roles.${l}` as MessageKey)}</option>)}</select></label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t('live.form.source')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['studio', 'youtube'] as const).map((s) => (
            <label key={s} className={cn('flex cursor-pointer gap-3 rounded-xl border p-3', v.source === s && 'border-primary bg-primary/5', s === 'studio' && !studioOn && 'opacity-50')}>
              <input type="radio" name="source" disabled={s === 'studio' && !studioOn} checked={v.source === s} onChange={() => set('source', s)} className="mt-1" />
              {s === 'studio' ? <Video className="mt-0.5 size-5 shrink-0 text-[#FF3333]" /> : <Youtube className="mt-0.5 size-5 shrink-0 text-[#FF3333]" />}
              <span><b className="block">{t(`live.form.${s}`)}</b><span className="text-sm text-muted-foreground">{s === 'studio' && !studioOn ? t('live.host.studioOff') : t(`live.form.${s}Hint`)}</span></span>
            </label>
          ))}
        </div>
        {v.source === 'youtube' && <input name="youtubeUrl" placeholder={t('live.form.youtubePh')} value={v.youtubeUrl ?? ''} onChange={(e) => set('youtubeUrl', e.target.value)} className={input} />}
      </fieldset>
      <div className="space-y-1"><span className="text-sm font-semibold">{t('live.form.cover')}</span>
        <ImagePicker value={cover} onChange={setCover} max={1} wide label={t('live.form.cover')} onError={() => err('cover')} /></div>
      {id && (
        <div className="space-y-2">
          <span className="text-sm font-semibold">{t('live.form.replay')}</span>
          <p className="text-xs text-muted-foreground">{t('live.form.replayHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted">
              <Upload className="size-4" />{up !== null ? `${up}%` : t('live.form.upload')}
              <input type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return
                setUp(0)
                try { set('replayUrl', (await uploadFile(f, 'live', setUp)).url) } catch { err('upload') } finally { setUp(null); e.target.value = '' }
              }} />
            </label>
            {v.replayUrl?.startsWith('/media/') && <span className="flex items-center gap-1 text-sm text-green-600"><Check className="size-4" />{v.replayUrl.split('/').pop()}</span>}
          </div>
          <input name="replayUrl" placeholder={t('live.form.youtubePh')} value={v.replayUrl && !v.replayUrl.startsWith('/media/') ? v.replayUrl : ''} onChange={(e) => set('replayUrl', e.target.value)} className={input} />
        </div>
      )}
      <label className="flex items-center gap-3"><input type="checkbox" checked={v.giving ?? true} onChange={(e) => set('giving', e.target.checked)} className="size-5" /><span className="text-sm font-medium">{t('live.form.giving')}</span></label>
      <Button type="submit" size="lg" className="w-full rounded-full" disabled={pending || up !== null || !v.title.trim()}>{t('live.form.save')}</Button>
    </form>
  )
}
