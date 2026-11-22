'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Church, Globe2, Loader2, MapPinned } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImagePicker, toPicked, type PickedImage } from '@/components/common/image-picker'
import { createAnnouncementAction, editAnnouncementAction } from '@/server/actions/community'

export type HomeLevels = { districtName: string; assemblyName: string }
type Level = 'national' | 'district' | 'local'

/** Choose National / my district / my assembly. */
export function LevelChooser({ value, onChange, home, disabled }: { value: Level; onChange: (l: Level) => void; home: HomeLevels; disabled?: boolean }) {
  const { t } = useI18n()
  const opts = [
    { k: 'national' as const, icon: Globe2, title: t('levels.national'), sub: t('levels.nationalLong') },
    { k: 'district' as const, icon: MapPinned, title: t('levels.myDistrict'), sub: home.districtName },
    { k: 'local' as const, icon: Church, title: t('levels.myAssembly'), sub: home.assemblyName },
  ]
  return (
    <fieldset className="grid gap-2 sm:grid-cols-3" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium">{t('levels.postAt')}</legend>
      {opts.map((o) => (
        <label key={o.k} className={cn('flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors', value === o.k ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50', disabled && 'cursor-default opacity-70')}>
          <input type="radio" name="level" value={o.k} checked={value === o.k} onChange={() => onChange(o.k)} className="sr-only" />
          <o.icon className={cn('mt-0.5 size-5 shrink-0', o.k === 'national' ? 'text-brand-red' : 'text-primary')} />
          <span className="min-w-0"><span className="block text-sm font-semibold">{o.title}</span><span className="block truncate text-xs text-muted-foreground">{o.sub}</span></span>
        </label>
      ))}
    </fieldset>
  )
}

export function AnnouncementForm({ home, initial }: {
  home: HomeLevels
  initial?: { id: string; level: Level; title: string; body: string; important: boolean; media: { url: string; alt: string | null; width: number | null; height: number | null }[] }
}) {
  const { t } = useI18n()
  const router = useRouter()
  const [level, setLevel] = useState<Level>(initial?.level ?? 'local')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [important, setImportant] = useState(initial?.important ?? false)
  const [media, setMedia] = useState<PickedImage[]>(toPicked(initial?.media ?? []))
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const err = (c: string) => setError(t(`announcements.err.${c}` as MessageKey))
  const uploading = media.some((m) => m.uploading)
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    const payload = { title, body, important, media: media.filter((m) => m.url).map((m) => ({ url: m.url!, alt: m.alt, width: m.width, height: m.height })) }
    start(async () => {
      const r = initial ? await editAnnouncementAction(initial.id, payload) : await createAnnouncementAction({ ...payload, level })
      if (!r.ok) return err(r.error)
      toast.success(initial ? t('announcements.save') : t('announcements.posted'))
      router.push(`/announcements/${r.id}`)
    })
  }
  return (
    <form onSubmit={submit} className="space-y-5 p-4 sm:p-6">
      {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <LevelChooser value={level} onChange={setLevel} home={home} disabled={!!initial} />
      <p className="-mt-2 text-xs text-muted-foreground">{t('announcements.levelNote')}</p>
      <div className="space-y-1.5">
        <Label htmlFor="title">{t('announcements.titleLabel')}</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body">{t('announcements.bodyLabel')}</Label>
        <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} rows={8} placeholder={t('announcements.bodyPh')} required />
        <p className="text-right text-xs text-muted-foreground">{body.length}/3000</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{t('announcements.photos')}</p>
        <ImagePicker value={media} onChange={setMedia} label={t('announcements.addPhotos')} onError={err} />
      </div>
      <label className="flex items-center gap-2.5 text-[15px]">
        <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} className="size-4 accent-[var(--brand-red)]" />{t('announcements.importantLabel')}
      </label>
      <Button type="submit" disabled={pending || uploading} className="w-full sm:w-auto sm:px-8">
        {pending && <Loader2 className="animate-spin" />}{initial ? t('announcements.save') : t('announcements.post')}
      </Button>
    </form>
  )
}
