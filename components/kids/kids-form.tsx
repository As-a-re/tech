'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { saveKidsAction } from '@/server/actions/library'
import type { AgeGroup, KidsInput, KidsKind } from '@/server/library/kids'
import { uploadFile } from '@/components/library/upload'

const KINDS: KidsKind[] = ['story', 'quiz', 'song', 'video', 'colouring', 'memory_verse', 'lesson']
const AGES: AgeGroup[] = ['all', '0_4', '5_8', '9_12']
const input = 'h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary'
const area = 'w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary'
type Q = NonNullable<KidsInput['questions']>[number]

function FileField({ label, hint, value, accept, onChange, onError }: { label: string; hint?: string; value: string | null | undefined; accept: string; onChange: (url: string | null) => void; onError: (c: string) => void }) {
  const { t } = useI18n()
  const [n, setN] = useState<number | null>(null)
  return (
    <div className="space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted">
          <Upload className="size-4" />{n !== null ? `${n}%` : t('kids.form.upload')}
          <input type="file" accept={accept} hidden onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return
            setN(0)
            try { onChange((await uploadFile(f, 'kids', setN)).url) } catch { onError('upload') } finally { setN(null); e.target.value = '' }
          }} />
        </label>
        {value && <span className="flex items-center gap-1 text-sm text-green-600"><Check className="size-4" />{value.split('/').pop()}</span>}
        {value && <button type="button" onClick={() => onChange(null)} className="text-sm text-muted-foreground hover:underline"><Trash2 className="inline size-4" /></button>}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Add or edit a story, quiz, song, video, colouring page, memory verse or Sunday school lesson. */
export function KidsForm({ id, initial, levels }: { id?: string; initial?: KidsInput; levels: ('national' | 'district' | 'local')[] }) {
  const { t } = useI18n()
  const router = useRouter()
  const [v, setV] = useState<KidsInput>(initial ?? { kind: 'story', ageGroup: 'all', title: '', summary: '', body: '', bibleRef: '', level: levels[0] ?? 'local', questions: [{ question: '', options: ['', ''], answer: 0 }], weekOf: null })
  const set = <K extends keyof KidsInput>(k: K, val: KidsInput[K]) => setV((x) => ({ ...x, [k]: val }))
  const [pending, start] = useTransition()
  const err = (c: string) => toast.error(t(`kids.err.${c}` as MessageKey))
  const qs = v.questions ?? []
  const setQ = (i: number, q: Partial<Q>) => set('questions', qs.map((x, j) => (j === i ? { ...x, ...q } : x)))
  const submit = (status: 'draft' | 'published') => start(async () => {
    const r = await saveKidsAction({ ...v, status }, id)
    if (!r.ok) { err(r.error); return }
    toast.success(t('kids.form.saved'))
    router.push(`/children/${r.id}`)
  })
  const bodyLabel = v.kind === 'story' ? 'kids.form.bodyStory' : v.kind === 'memory_verse' ? 'kids.form.bodyVerse' : v.kind === 'lesson' ? 'kids.form.bodyLesson' : 'kids.form.bodySong'
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit('published') }} className="space-y-5 px-4 py-5" data-kids-form>
      <div className="space-y-2">
        <span className="text-sm font-semibold">{t('kids.form.kind')}</span>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => <button key={k} type="button" aria-pressed={v.kind === k} onClick={() => set('kind', k)}
            className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium', v.kind === k ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>{t(`kids.kinds.${k}` as MessageKey)}</button>)}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('kids.form.age')}</span>
          <select value={v.ageGroup} onChange={(e) => set('ageGroup', e.target.value as AgeGroup)} className={input}>{AGES.map((a) => <option key={a} value={a}>{t(`kids.agesLong.${a}`)}</option>)}</select></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('kids.form.level')}</span>
          <select value={v.level} onChange={(e) => set('level', e.target.value as KidsInput['level'])} className={input}>{levels.map((l) => <option key={l} value={l}>{t(`admin.roles.${l}` as MessageKey)}</option>)}</select></label>
      </div>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t('kids.form.title')}</span><input name="title" required maxLength={120} value={v.title} onChange={(e) => set('title', e.target.value)} className={input} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('kids.form.bibleRef')}</span><input name="bibleRef" maxLength={60} placeholder={t('kids.form.bibleRefPh')} value={v.bibleRef ?? ''} onChange={(e) => set('bibleRef', e.target.value)} className={input} /></label>
        {v.kind === 'memory_verse'
          ? <label className="block space-y-1"><span className="text-sm font-semibold">{t('kids.form.weekOf')}</span><input name="weekOf" type="date" value={v.weekOf ?? ''} onChange={(e) => set('weekOf', e.target.value)} className={input} /></label>
          : <label className="block space-y-1"><span className="text-sm font-semibold">{t('kids.form.summary')}</span><input name="summary" maxLength={300} value={v.summary ?? ''} onChange={(e) => set('summary', e.target.value)} className={input} /></label>}
      </div>
      {['story', 'memory_verse', 'lesson', 'song'].includes(v.kind) && (
        <label className="block space-y-1"><span className="text-sm font-semibold">{t(bodyLabel as MessageKey)}</span>
          <textarea name="body" rows={v.kind === 'memory_verse' ? 3 : 10} maxLength={30000} value={v.body ?? ''} onChange={(e) => set('body', e.target.value)} className={area} /></label>
      )}
      {v.kind !== 'colouring' && <FileField label={t('kids.form.cover')} value={v.coverUrl} accept="image/jpeg,image/png,image/webp" onChange={(u) => set('coverUrl', u)} onError={err} />}
      {(v.kind === 'story' || v.kind === 'memory_verse' || v.kind === 'song') && <FileField label={t('kids.form.audio')} hint={v.kind === 'song' ? undefined : t('kids.form.audioHint')} value={v.audioUrl} accept="audio/*" onChange={(u) => set('audioUrl', u)} onError={err} />}
      {(v.kind === 'song' || v.kind === 'video') && (
        <div className="space-y-2">
          <FileField label={t('kids.form.video')} hint={t('kids.form.videoHint')} value={v.videoUrl?.startsWith('/media/') ? v.videoUrl : null} accept="video/mp4,video/webm,video/quicktime" onChange={(u) => set('videoUrl', u)} onError={err} />
          <input aria-label="YouTube" placeholder={t('kids.form.youtubePh')} value={v.videoUrl && !v.videoUrl.startsWith('/media/') ? v.videoUrl : ''} onChange={(e) => set('videoUrl', e.target.value)} className={input} />
        </div>
      )}
      {(v.kind === 'colouring' || v.kind === 'lesson') && <FileField label={v.kind === 'colouring' ? t('kids.form.file') : t('kids.form.handout')} value={v.fileUrl} accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(u) => set('fileUrl', u)} onError={err} />}
      {v.kind === 'quiz' && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t('kids.form.questions')}</h3>
          {qs.map((q, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-3">
              <div className="flex gap-2">
                <input aria-label={t('kids.form.question')} placeholder={`${i + 1}. ${t('kids.form.question')}`} maxLength={300} value={q.question} onChange={(e) => setQ(i, { question: e.target.value })} className={input} />
                <button type="button" disabled={qs.length === 1} onClick={() => set('questions', qs.filter((_, j) => j !== i))} aria-label={t('kids.form.removeQuestion')} className="rounded p-2 text-destructive hover:bg-muted disabled:opacity-30"><Trash2 className="size-4" /></button>
              </div>
              {q.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input type="radio" name={`answer-${i}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })} aria-label={t('kids.form.correct')} />
                  <input aria-label={t('kids.form.option', { n: k + 1 })} placeholder={t('kids.form.option', { n: k + 1 })} maxLength={120} value={o} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} className={cn(input, 'h-10')} />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {q.options.length < 4 && <button type="button" onClick={() => setQ(i, { options: [...q.options, ''] })} className="text-sm font-semibold text-primary hover:underline">{t('kids.form.addOption')}</button>}
                <input aria-label={t('kids.form.explain')} placeholder={t('kids.form.explain')} value={q.explain ?? ''} onChange={(e) => setQ(i, { explain: e.target.value })} className={cn(input, 'h-9 flex-1 text-sm')} />
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" className="rounded-full" onClick={() => set('questions', [...qs, { question: '', options: ['', ''], answer: 0 }])}>{t('kids.form.addQuestion')}</Button>
        </section>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="lg" className="flex-1 rounded-full" disabled={pending}>{t('kids.form.publish')}</Button>
        <Button type="button" size="lg" variant="outline" className="rounded-full" disabled={pending} onClick={() => submit('draft')}>{t('kids.form.draft')}</Button>
      </div>
    </form>
  )
}
