'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { fromInputs, toDateInput, toTimeInput } from '@/lib/community/dates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImagePicker, toPicked, type PickedImage } from '@/components/common/image-picker'
import { MapView } from '@/components/maps/map-view'
import { LevelChooser, type HomeLevels } from './announcement-form'
import { createEventAction, updateEventAction } from '@/server/actions/community'

type Level = 'national' | 'district' | 'local'
export type EventInitial = {
  id: string; level: Level; title: string; description: string; startsAt: string; endsAt: string | null; venue: string | null; address: string | null
  lat: number | null; lng: number | null; onlineUrl: string | null; coverUrl: string | null
}

export function EventForm({ home, initial }: { home: HomeLevels; initial?: EventInitial }) {
  const { t } = useI18n()
  const router = useRouter()
  const tomorrow = new Date(Date.now() + 864e5).toISOString()
  const [level, setLevel] = useState<Level>(initial?.level ?? 'local')
  const [v, setV] = useState({
    title: initial?.title ?? '', description: initial?.description ?? '',
    date: toDateInput(initial?.startsAt ?? tomorrow), start: initial ? toTimeInput(initial.startsAt) : '09:00',
    endDate: initial?.endsAt ? toDateInput(initial.endsAt) : '', end: initial?.endsAt ? toTimeInput(initial.endsAt) : '',
    venue: initial?.venue ?? '', address: initial?.address ?? '', onlineUrl: initial?.onlineUrl ?? '',
  })
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(initial?.lat != null && initial.lng != null ? { lat: initial.lat, lng: initial.lng } : null)
  const [cover, setCover] = useState<PickedImage[]>(initial?.coverUrl ? toPicked([{ url: initial.coverUrl }]) : [])
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }))
  const err = (c: string) => setError(t((c.startsWith('upload_') ? `announcements.err.${c}` : `events.err.${c}`) as MessageKey))
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    const startsAt = fromInputs(v.date, v.start)
    if (!startsAt) return err('starts')
    const endsAt = v.end ? fromInputs(v.endDate || v.date, v.end) : null
    if (v.end && !endsAt) return err('ends')
    const payload = {
      title: v.title, description: v.description, startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() ?? null,
      venue: v.venue, address: v.address, onlineUrl: v.onlineUrl, lat: pin?.lat ?? null, lng: pin?.lng ?? null, coverUrl: cover[0]?.url ?? null,
    }
    start(async () => {
      const r = initial ? await updateEventAction(initial.id, payload) : await createEventAction({ ...payload, level })
      if (!r.ok) return err(r.error)
      toast.success(initial ? t('events.savedMsg') : t('events.created'))
      router.push(`/events/${r.id}`)
    })
  }
  return (
    <form onSubmit={submit} className="space-y-5 p-4 sm:p-6">
      {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <LevelChooser value={level} onChange={setLevel} home={home} disabled={!!initial} />
      <div className="space-y-1.5"><Label htmlFor="title">{t('events.titleLabel')}</Label><Input id="title" value={v.title} onChange={set('title')} maxLength={120} required /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="date">{t('events.date')}</Label><Input id="date" type="date" value={v.date} onChange={set('date')} required /></div>
        <div className="space-y-1.5"><Label htmlFor="start">{t('events.start')}</Label><Input id="start" type="time" value={v.start} onChange={set('start')} required /></div>
        <div className="space-y-1.5"><Label htmlFor="endDate">{t('events.endDate')}</Label><Input id="endDate" type="date" value={v.endDate || v.date} onChange={set('endDate')} /></div>
        <div className="space-y-1.5"><Label htmlFor="end">{t('events.end')}</Label><Input id="end" type="time" value={v.end} onChange={set('end')} /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="venue">{t('events.venue')}</Label><Input id="venue" value={v.venue} onChange={set('venue')} maxLength={120} placeholder={t('events.venuePh')} /></div>
      <div className="space-y-1.5"><Label htmlFor="address">{t('events.address')}</Label><Input id="address" value={v.address} onChange={set('address')} maxLength={200} /></div>
      <div className="space-y-1.5"><Label htmlFor="online">{t('events.online')}</Label><Input id="online" type="url" value={v.onlineUrl} onChange={set('onlineUrl')} placeholder={t('events.onlinePh')} /></div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between"><p className="text-sm font-medium">{t('events.pin')}</p>
          {pin && <button type="button" onClick={() => setPin(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><X className="size-3.5" />{t('events.clearPin')}</button>}</div>
        <MapView pins={pin ? [pin] : []} onPick={setPin} className="h-56" zoom={14} />
        <p className="text-xs text-muted-foreground">{t('events.pinHelp')}</p>
      </div>
      <div className="space-y-1.5"><Label htmlFor="desc">{t('events.descLabel')}</Label>
        <Textarea id="desc" value={v.description} onChange={set('description')} maxLength={3000} rows={6} placeholder={t('events.descPh')} /></div>
      <div className="space-y-1.5"><p className="text-sm font-medium">{t('events.cover')}</p>
        <ImagePicker value={cover} onChange={setCover} max={1} wide label={t('events.addCover')} onError={err} /></div>
      <Button type="submit" disabled={pending || cover.some((c) => c.uploading)} className="w-full sm:w-auto sm:px-8">
        {pending && <Loader2 className="animate-spin" />}{initial ? t('events.save') : t('events.create')}
      </Button>
    </form>
  )
}
