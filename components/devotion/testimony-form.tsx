'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ImagePicker, toPicked, type PickedImage } from '@/components/common/image-picker'
import { createTestimonyAction, editTestimonyAction } from '@/server/actions/devotion'

export function TestimonyForm({ prayer, initial }: {
  prayer?: { id: string; body: string } | null
  initial?: { id: string; title: string; body: string; media: { url: string; alt: string | null; width: number | null; height: number | null }[] }
}) {
  const { t } = useI18n()
  const router = useRouter()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [media, setMedia] = useState<PickedImage[]>(toPicked(initial?.media ?? []))
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const err = (c: string) => setError(t((c.startsWith('upload_') ? `announcements.err.${c}` : `testimonies.err.${c}`) as MessageKey))
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    const payload = { title, body, prayerId: prayer?.id ?? null, media: media.filter((m) => m.url).map((m) => ({ url: m.url!, alt: m.alt, width: m.width, height: m.height })) }
    start(async () => {
      const r = initial ? await editTestimonyAction(initial.id, payload) : await createTestimonyAction(payload)
      if (!r.ok) return err(r.error)
      toast.success(initial ? t('testimonies.save') : t('testimonies.posted')); router.push(`/testimonies/${r.id}`)
    })
  }
  return (
    <form onSubmit={submit} className="space-y-5 p-4 sm:p-6">
      {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {prayer && <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm"><b className="block text-xs text-muted-foreground">{t('testimonies.fromPrayer')}</b><span className="line-clamp-3">{prayer.body}</span></div>}
      <div className="space-y-1.5"><Label htmlFor="title">{t('testimonies.titleLabel')}</Label><Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t('testimonies.titlePh')} required /></div>
      <div className="space-y-1.5"><Label htmlFor="body">{t('testimonies.bodyLabel')}</Label>
        <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} maxLength={3000} placeholder={t('testimonies.bodyPh')} required />
        <p className="text-right text-xs text-muted-foreground">{body.length}/3000</p></div>
      <div className="space-y-1.5"><p className="text-sm font-medium">{t('testimonies.photos')}</p><ImagePicker value={media} onChange={setMedia} label={t('testimonies.addPhotos')} onError={err} /></div>
      <Button type="submit" disabled={pending || media.some((m) => m.uploading)} className="w-full sm:w-auto sm:px-8">{pending && <Loader2 className="animate-spin" />}{initial ? t('testimonies.save') : t('testimonies.post')}</Button>
    </form>
  )
}
