'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, FileText, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ImagePicker, toPicked, type PickedImage } from '@/components/common/image-picker'
import { savePublicationAction } from '@/server/actions/library'
import type { PublicationInput, PublicationKind } from '@/server/library/publications'
import { uploadFile } from './upload'

const KINDS: PublicationKind[] = ['magazine', 'devotional', 'book', 'newsletter', 'bulletin', 'manual']
const input = 'h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary'
const area = 'w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary'

export type PublicationInitial = Omit<PublicationInput, 'status'> & { status: PublicationInput['status']; scopeName?: string }

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-sm font-semibold">{label}</span>{children}{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</label>
}

/** Create or edit a publication: PDF or written chapters, series, level, price and when it goes out. */
export function PublicationForm({ id, initial, levels, series }: { id?: string; initial?: PublicationInitial; levels: ('national' | 'district' | 'local')[]; series: { id: string; name: string }[] }) {
  const { t } = useI18n()
  const router = useRouter()
  const [v, setV] = useState<PublicationInitial>(initial ?? {
    kind: 'magazine', format: 'pdf', title: '', subtitle: '', description: '', author: '', seriesId: null, newSeries: null, edition: '', language: 'en',
    level: levels[0] ?? 'local', coverUrl: null, fileUrl: null, chapters: [{ title: '', body: '' }], pricePesewas: 0, previewPages: 3, status: 'published', publishAt: null,
  })
  const set = <K extends keyof PublicationInitial>(k: K, val: PublicationInitial[K]) => setV((x) => ({ ...x, [k]: val }))
  const [cover, setCover] = useState<PickedImage[]>(initial?.coverUrl ? toPicked([{ url: initial.coverUrl }]) : [])
  const [progress, setProgress] = useState<number | null>(null)
  const [newSeries, setNewSeries] = useState(false)
  const [pending, start] = useTransition()
  const pdfInput = useRef<HTMLInputElement>(null)
  const err = (code: string) => toast.error(t(`pubs.err.${code}` as MessageKey))
  const chapters = v.chapters ?? []
  const setCh = (i: number, k: 'title' | 'body', val: string) => set('chapters', chapters.map((c, j) => (j === i ? { ...c, [k]: val } : c)))
  const move = (i: number, d: number) => { const a = [...chapters]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); set('chapters', a) }

  const pickPdf = async (f: File | undefined) => {
    if (!f) return
    if (f.type !== 'application/pdf') { err('unsupported'); return }
    setProgress(0)
    try { const r = await uploadFile(f, 'pub', setProgress); set('fileUrl', r.url) } catch (e) { err((e as Error).message) } finally { setProgress(null); if (pdfInput.current) pdfInput.current.value = '' }
  }

  const submit = () => start(async () => {
    if (cover.some((c) => c.uploading) || progress !== null) return
    const r = await savePublicationAction({ ...v, coverUrl: cover[0]?.url ?? null, newSeries: newSeries ? v.newSeries : null, seriesId: newSeries ? null : v.seriesId,
      publishAt: v.status === 'scheduled' && v.publishAt ? new Date(v.publishAt).toISOString() : null }, id)
    if (!r.ok) { err(r.error); return }
    toast.success(t('pubs.form.saved'))
    router.push(`/publications/${r.id}`)
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-5 px-4 py-5" data-publication-form>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('pubs.form.kind')}>
          <select name="kind" value={v.kind} onChange={(e) => set('kind', e.target.value as PublicationKind)} className={input}>
            {KINDS.map((k) => <option key={k} value={k}>{t(`pubs.kinds.${k}` as MessageKey)}</option>)}
          </select>
        </Field>
        <Field label={t('pubs.form.level')} hint={initial?.scopeName}>
          <select name="level" value={v.level} onChange={(e) => set('level', e.target.value as typeof v.level)} className={input}>
            {levels.map((l) => <option key={l} value={l}>{t(`admin.roles.${l}` as MessageKey)}</option>)}
          </select>
        </Field>
      </div>
      <Field label={t('pubs.form.title')}><input name="title" required maxLength={120} value={v.title} onChange={(e) => set('title', e.target.value)} className={input} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('pubs.form.subtitle')}><input name="subtitle" maxLength={160} value={v.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} className={input} /></Field>
        <Field label={t('pubs.form.author')}><input name="author" maxLength={120} value={v.author ?? ''} onChange={(e) => set('author', e.target.value)} className={input} /></Field>
      </div>
      <Field label={t('pubs.form.description')}><textarea name="description" rows={4} maxLength={4000} value={v.description ?? ''} onChange={(e) => set('description', e.target.value)} className={area} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('pubs.form.series')}>
          {newSeries ? <input name="newSeries" autoFocus maxLength={80} placeholder={t('pubs.form.newSeriesName')} value={v.newSeries ?? ''} onChange={(e) => set('newSeries', e.target.value)} className={input} />
            : <select name="seriesId" value={v.seriesId ?? ''} onChange={(e) => { if (e.target.value === '__new') setNewSeries(true); else set('seriesId', e.target.value || null) }} className={input}>
              <option value="">{t('pubs.form.noSeries')}</option>{series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="__new">{t('pubs.form.newSeries')}</option>
            </select>}
        </Field>
        <Field label={t('pubs.form.edition')}><input name="edition" maxLength={80} placeholder={t('pubs.form.editionPh')} value={v.edition ?? ''} onChange={(e) => set('edition', e.target.value)} className={input} /></Field>
        <Field label={t('pubs.form.language')}>
          <select name="language" value={v.language} onChange={(e) => set('language', e.target.value)} className={input}>{LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}</select>
        </Field>
      </div>
      <div className="space-y-1"><span className="text-sm font-semibold">{t('pubs.form.cover')}</span>
        <ImagePicker value={cover} onChange={setCover} max={1} label={t('pubs.form.cover')} onError={(c) => err(c === 'upload_too_large' ? 'too_large' : c === 'upload_unsupported' ? 'cover' : 'upload')} /></div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t('pubs.form.format')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['pdf', 'article'] as const).map((f) => (
            <label key={f} className={cn('flex cursor-pointer gap-3 rounded-xl border p-3', v.format === f && 'border-primary bg-primary/5')}>
              <input type="radio" name="format" checked={v.format === f} onChange={() => set('format', f)} className="mt-1" />
              <span><b className="block">{t(`pubs.form.${f}`)}</b><span className="text-sm text-muted-foreground">{t(`pubs.form.${f}Hint`)}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {v.format === 'pdf' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">
          <FileText className="size-8 text-primary" />
          <span className="min-w-0 flex-1 text-sm">{progress !== null ? t('pubs.form.uploading', { n: progress }) : v.fileUrl ? <b className="text-green-600" data-pdf-ready>{t('pubs.form.pdfReady')}</b> : t('pubs.form.pdfHint')}</span>
          <Button type="button" variant="outline" className="rounded-full" disabled={progress !== null} onClick={() => pdfInput.current?.click()}><Upload />{v.fileUrl ? t('pubs.form.replacePdf') : t('pubs.form.uploadPdf')}</Button>
          <input ref={pdfInput} type="file" accept="application/pdf" hidden data-pdf-input onChange={(e) => pickPdf(e.target.files?.[0])} />
        </div>
      ) : (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t('pubs.form.chapters')}</h3>
          {chapters.map((c, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-muted-foreground">{i + 1}.</span>
                <input aria-label={t('pubs.form.chapterTitle')} placeholder={t('pubs.form.chapterTitle')} maxLength={160} value={c.title} onChange={(e) => setCh(i, 'title', e.target.value)} className={cn(input, 'h-10')} />
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('pubs.form.moveUp')} className="rounded p-1.5 hover:bg-muted disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button type="button" disabled={i === chapters.length - 1} onClick={() => move(i, 1)} aria-label={t('pubs.form.moveDown')} className="rounded p-1.5 hover:bg-muted disabled:opacity-30"><ArrowDown className="size-4" /></button>
                <button type="button" disabled={chapters.length === 1} onClick={() => set('chapters', chapters.filter((_, j) => j !== i))} aria-label={t('pubs.form.removeChapter')} className="rounded p-1.5 text-destructive hover:bg-muted disabled:opacity-30"><Trash2 className="size-4" /></button>
              </div>
              <textarea aria-label={t('pubs.form.chapterBody')} placeholder={t('pubs.form.chapterBody')} rows={8} maxLength={60000} value={c.body} onChange={(e) => setCh(i, 'body', e.target.value)} className={area} />
            </div>
          ))}
          <Button type="button" variant="outline" className="rounded-full" onClick={() => set('chapters', [...chapters, { title: '', body: '' }])}>{t('pubs.form.addChapter')}</Button>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('pubs.form.price')} hint={t('pubs.form.priceHint')}>
          <input name="price" type="number" min={0} max={10000} step="0.5" inputMode="decimal" value={(v.pricePesewas ?? 0) / 100} onChange={(e) => set('pricePesewas', Math.round(Number(e.target.value || 0) * 100))} className={input} />
        </Field>
        {(v.pricePesewas ?? 0) > 0 && <Field label={t('pubs.form.previewPages')}><input type="number" min={1} max={20} value={v.previewPages ?? 3} onChange={(e) => set('previewPages', Number(e.target.value || 1))} className={input} /></Field>}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t('pubs.form.when')}</legend>
        <div className="flex flex-wrap gap-2">
          {(['published', 'scheduled', 'draft'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={v.status === s} onClick={() => set('status', s)}
              className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium', v.status === s ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              {t(s === 'published' ? 'pubs.form.publishNow' : s === 'scheduled' ? 'pubs.form.schedule' : 'pubs.form.draft')}
            </button>
          ))}
        </div>
        {v.status === 'scheduled' && <input type="datetime-local" aria-label={t('pubs.form.publishAt')} value={v.publishAt ?? ''} onChange={(e) => set('publishAt', e.target.value)} className={cn(input, 'max-w-xs')} />}
      </fieldset>
      <Button type="submit" size="lg" className="w-full rounded-full" disabled={pending || progress !== null || !v.title.trim()}>
        {t(v.status === 'published' ? 'pubs.form.submitPublish' : v.status === 'scheduled' ? 'pubs.form.submitSchedule' : 'pubs.form.submitDraft')}
      </Button>
    </form>
  )
}
