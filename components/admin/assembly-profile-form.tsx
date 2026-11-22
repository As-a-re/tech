'use client'

import { useState, useTransition } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImagePicker, toPicked, type PickedImage } from '@/components/common/image-picker'
import { MapView } from '@/components/maps/map-view'
import { saveAssemblyProfileAction } from '@/server/actions/admin'
import type { Leader, ServiceTime } from '@/lib/church/types'

type Values = {
  about: string | null; address: string | null; lat: number | null; lng: number | null; phone: string | null; email: string | null
  photoUrl: string | null; serviceTimes: ServiceTime[]; leaders: Leader[]
}

/** Directory details for one assembly: about, contacts, map pin, weekly service times and leaders. */
export function AssemblyProfileForm({ assemblyId, initial }: { assemblyId: string; initial: Values }) {
  const { t } = useI18n()
  const [v, setV] = useState({ about: initial.about ?? '', address: initial.address ?? '', phone: initial.phone ?? '', email: initial.email ?? '',
    lat: initial.lat?.toString() ?? '', lng: initial.lng?.toString() ?? '' })
  const [times, setTimes] = useState<ServiceTime[]>(initial.serviceTimes)
  const [leaders, setLeaders] = useState<Leader[]>(initial.leaders)
  const [photo, setPhoto] = useState<PickedImage[]>(initial.photoUrl ? toPicked([{ url: initial.photoUrl }]) : [])
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((s) => ({ ...s, [k]: e.target.value }))
  const lat = v.lat.trim() ? Number(v.lat) : null, lng = v.lng.trim() ? Number(v.lng) : null
  const pin = lat != null && lng != null && !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null
  const days = Array.from({ length: 7 }, (_, i) => t(`directory.days.${i}` as MessageKey))
  const save = () => start(async () => {
    setError('')
    const r = await saveAssemblyProfileAction(assemblyId, {
      about: v.about, address: v.address, phone: v.phone, email: v.email, lat, lng, photoUrl: photo[0]?.url ?? null, serviceTimes: times, leaders,
    })
    if (r.error) setError(t(`admin.profile.err.${r.error}` as MessageKey)); else toast.success(t('admin.profile.saved'))
  })
  const input = 'h-10 rounded-md border bg-background px-2 text-sm'
  return (
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="space-y-1.5"><Label htmlFor="about">{t('admin.profile.about')}</Label><Textarea id="about" value={v.about} onChange={set('about')} rows={4} maxLength={1500} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="address">{t('admin.profile.address')}</Label><Input id="address" value={v.address} onChange={set('address')} maxLength={200} /></div>
        <div className="space-y-1.5"><Label htmlFor="phone">{t('admin.profile.phone')}</Label><Input id="phone" value={v.phone} onChange={set('phone')} inputMode="tel" /></div>
        <div className="space-y-1.5"><Label htmlFor="email">{t('admin.profile.email')}</Label><Input id="email" type="email" value={v.email} onChange={set('email')} /></div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{t('admin.profile.location')}</p>
        <MapView pins={pin ? [pin] : []} onPick={(p) => setV((s) => ({ ...s, lat: String(p.lat), lng: String(p.lng) }))} className="h-56" zoom={15} />
        <p className="text-xs text-muted-foreground">{t('admin.profile.locationHelp')}</p>
        <div className="grid grid-cols-2 gap-3">
          <Input aria-label={t('admin.profile.lat')} placeholder={t('admin.profile.lat')} value={v.lat} onChange={set('lat')} inputMode="decimal" />
          <Input aria-label={t('admin.profile.lng')} placeholder={t('admin.profile.lng')} value={v.lng} onChange={set('lng')} inputMode="decimal" />
        </div>
      </div>
      <div className="space-y-1.5"><p className="text-sm font-medium">{t('admin.profile.photo')}</p>
        <ImagePicker value={photo} onChange={setPhoto} max={1} wide label={t('admin.profile.photo')} onError={() => setError(t('admin.profile.err.photo'))} /></div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('admin.profile.services')}</legend>
        {times.map((s, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <select aria-label={t('admin.profile.day')} value={s.day} onChange={(e) => setTimes((x) => x.map((y, j) => (j === i ? { ...y, day: Number(e.target.value) } : y)))} className={input}>
              {days.map((d, j) => <option key={j} value={j}>{d}</option>)}
            </select>
            <input type="time" aria-label={t('admin.profile.start')} value={s.start} onChange={(e) => setTimes((x) => x.map((y, j) => (j === i ? { ...y, start: e.target.value } : y)))} className={input} />
            <input type="time" aria-label={t('admin.profile.end')} value={s.end ?? ''} onChange={(e) => setTimes((x) => x.map((y, j) => (j === i ? { ...y, end: e.target.value || null } : y)))} className={input} />
            <input aria-label={t('admin.profile.label')} placeholder={t('admin.profile.labelPh')} value={s.label} maxLength={60} onChange={(e) => setTimes((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} className={`${input} min-w-40 flex-1`} />
            <button type="button" aria-label={t('admin.profile.remove')} onClick={() => setTimes((x) => x.filter((_, j) => j !== i))} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="size-4" /></button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setTimes((x) => [...x, { day: 0, start: '08:00', end: null, label: '' }])}><Plus />{t('admin.profile.addService')}</Button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('admin.profile.leaders')}</legend>
        {leaders.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
            <input aria-label={t('admin.profile.leaderName')} placeholder={t('admin.profile.leaderName')} value={l.name} maxLength={80} onChange={(e) => setLeaders((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} className={`${input} min-w-36 flex-1`} />
            <input aria-label={t('admin.profile.leaderRole')} placeholder={t('admin.profile.rolePh')} value={l.role} maxLength={60} onChange={(e) => setLeaders((x) => x.map((y, j) => (j === i ? { ...y, role: e.target.value } : y)))} className={`${input} min-w-36 flex-1`} />
            <input aria-label={t('admin.profile.leaderUser')} placeholder={t('admin.profile.leaderUser')} value={l.username ?? ''} maxLength={21} onChange={(e) => setLeaders((x) => x.map((y, j) => (j === i ? { ...y, username: e.target.value } : y)))} className={`${input} min-w-36 flex-1`} />
            <button type="button" aria-label={t('admin.profile.remove')} onClick={() => setLeaders((x) => x.filter((_, j) => j !== i))} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="size-4" /></button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setLeaders((x) => [...x, { name: '', role: '', username: null }])}><Plus />{t('admin.profile.addLeader')}</Button>
      </fieldset>

      <Button type="button" onClick={save} disabled={pending || photo.some((p) => p.uploading)}>{pending && <Loader2 className="animate-spin" />}{t('admin.profile.save')}</Button>
    </div>
  )
}
