'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ImagePicker, toPicked, type PickedImage } from '@/components/common/image-picker'
import { saveResourceAction } from '@/server/actions/resources'
import type { ResourceInput } from '@/server/resources/resources'
import { uploadFile } from '@/components/library/upload'

const input = 'h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary'

export function ResourceForm({ id, initial, levels }: { id?: string; initial?: ResourceInput; levels: ('national' | 'district' | 'local')[] }) {
  const { t } = useI18n()
  const router = useRouter()
  const [v, setV] = useState<ResourceInput>(initial ?? { kind: 'uniform', level: levels[0] ?? 'local', title: '', description: '', priceGhs: 0, sizes: [{ size: 'S', stock: 10 }, { size: 'M', stock: 10 }, { size: 'L', stock: 10 }], pickupInfo: '', active: true })
  const set = <K extends keyof ResourceInput>(k: K, val: ResourceInput[K]) => setV((x) => ({ ...x, [k]: val }))
  const [images, setImages] = useState<PickedImage[]>(toPicked((initial?.images ?? []).map((url) => ({ url }))))
  const [up, setUp] = useState<number | null>(null)
  const [pending, start] = useTransition()
  const err = (c: string) => toast.error(t(`res.err.${c}` as MessageKey))
  const sizes = v.sizes ?? []
  const submit = () => start(async () => {
    if (images.some((i) => i.uploading) || up !== null) return
    const r = await saveResourceAction({ ...v, images: images.map((i) => i.url!).filter(Boolean) }, id)
    if (!r.ok) { err(r.error); return }
    toast.success(t('res.form.saved')); router.push(`/resources/${r.id}`)
  })
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-4 px-4 py-5" data-resource-form>
      <div className="flex gap-2">{(['uniform', 'study_guide'] as const).map((k) => (
        <button key={k} type="button" aria-pressed={v.kind === k} onClick={() => set('kind', k)} className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', v.kind === k ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>{t(`res.kinds.${k}`)}</button>
      ))}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('res.form.title')}</span><input name="title" required maxLength={120} value={v.title} onChange={(e) => set('title', e.target.value)} className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('res.form.level')}</span>
          <select value={v.level} onChange={(e) => set('level', e.target.value as ResourceInput['level'])} className={input}>{levels.map((l) => <option key={l} value={l}>{t(`admin.roles.${l}` as MessageKey)}</option>)}</select></label>
      </div>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t('res.form.description')}</span><textarea name="description" rows={3} maxLength={3000} value={v.description ?? ''} onChange={(e) => set('description', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" /></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">{v.kind === 'uniform' ? t('res.form.price') : t('res.form.priceGuide')}</span>
        <input name="price" inputMode="decimal" value={v.priceGhs ?? 0} onChange={(e) => set('priceGhs', Number(e.target.value.replace(/[^\d.]/g, '') || 0))} className={cn(input, 'max-w-40')} /></label>
      <div className="space-y-1"><span className="text-sm font-semibold">{t('res.form.images')}</span><ImagePicker value={images} onChange={setImages} max={4} label={t('res.form.images')} onError={() => err('images')} /></div>
      {v.kind === 'uniform' ? <>
        <div className="space-y-2">
          <span className="text-sm font-semibold">{t('res.form.sizes')}</span>
          {sizes.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input aria-label={t('res.form.size')} placeholder={t('res.form.size')} value={s.size} maxLength={20} onChange={(e) => set('sizes', sizes.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))} className={cn(input, 'h-10 w-28')} />
              <input aria-label={t('res.form.stock')} inputMode="numeric" value={s.stock} onChange={(e) => set('sizes', sizes.map((x, j) => (j === i ? { ...x, stock: Number(e.target.value.replace(/\D/g, '') || 0) } : x)))} className={cn(input, 'h-10 w-24')} />
              <button type="button" aria-label="Remove" onClick={() => set('sizes', sizes.filter((_, j) => j !== i))} className="rounded p-2 text-destructive hover:bg-muted"><Trash2 className="size-4" /></button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => set('sizes', [...sizes, { size: '', stock: 0 }])}>{t('res.form.addSize')}</Button>
        </div>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('res.form.pickup')}</span><input name="pickup" maxLength={300} placeholder={t('res.form.pickupPh')} value={v.pickupInfo ?? ''} onChange={(e) => set('pickupInfo', e.target.value)} className={input} /></label>
      </> : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">
          <FileText className="size-8 text-primary" />
          <span className="flex-1 text-sm">{up !== null ? `${up}%` : v.fileUrl ? <b className="text-green-600" data-pdf-ready>{t('res.form.ready')}</b> : t('res.form.file')}</span>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted"><Upload className="size-4" />{t('res.form.upload')}
            <input type="file" accept="application/pdf" hidden data-pdf-input onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return
              setUp(0); try { set('fileUrl', (await uploadFile(f, 'res', setUp)).url) } catch { err('upload') } finally { setUp(null); e.target.value = '' }
            }} /></label>
        </div>
      )}
      <label className="flex items-center gap-3"><input type="checkbox" checked={v.active ?? true} onChange={(e) => set('active', e.target.checked)} className="size-5" /><span className="text-sm font-medium">{t('res.form.active')}</span></label>
      <Button type="submit" size="lg" className="w-full rounded-full" disabled={pending || up !== null || !v.title.trim()}>{t('res.form.save')}</Button>
    </form>
  )
}
