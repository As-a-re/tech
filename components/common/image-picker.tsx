'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { compressImage } from '@/lib/posts/image-compress'
import { cn } from '@/lib/utils'

export type PickedImage = { key: string; url?: string; preview: string; width?: number; height?: number; alt: string; uploading: boolean }

/** Uploads photos as soon as they're chosen (shrunk in the browser first). Used by announcements, events and the directory. */
export function ImagePicker({ value, onChange, max = 4, label, onError, wide }: {
  value: PickedImage[]; onChange: (fn: (v: PickedImage[]) => PickedImage[]) => void; max?: number; label: string; onError: (code: string) => void; wide?: boolean
}) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const add = async (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, max - value.length)) {
      if (!f.type.startsWith('image/')) { onError('upload_unsupported'); continue }
      const key = crypto.randomUUID()
      onChange((v) => [...v, { key, preview: URL.createObjectURL(f), alt: '', uploading: true }])
      try {
        const p = await compressImage(f)
        const fd = new FormData(); fd.append('file', p.file)
        const res = await fetch('/api/uploads', { method: 'POST', body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error === 'too_large' ? 'upload_too_large' : json.error === 'unsupported' ? 'upload_unsupported' : 'upload_failed')
        onChange((v) => v.map((x) => (x.key === key ? { ...x, url: json.url, width: p.width, height: p.height, uploading: false } : x)))
      } catch (e) {
        onChange((v) => v.filter((x) => x.key !== key))
        onError((e as Error).message.startsWith('upload_') ? (e as Error).message : 'upload_failed')
      }
    }
    if (input.current) input.current.value = ''
  }
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className={cn('grid gap-2', wide ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4')}>
          {value.map((m) => (
            <div key={m.key} className={cn('relative overflow-hidden rounded-xl border bg-muted', wide ? 'aspect-[2/1]' : 'aspect-square')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.preview} alt={m.alt} className="size-full object-cover" />
              {m.uploading && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"><Loader2 className="size-5 animate-spin" /></span>}
              <button type="button" aria-label={t('events.removeCover')} onClick={() => onChange((v) => v.filter((x) => x.key !== m.key))}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-black"><X className="size-4" /></button>
            </div>
          ))}
        </div>
      )}
      {value.length < max && (
        <button type="button" onClick={() => input.current?.click()} className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5">
          <ImagePlus className="size-4" />{label}
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple={max > 1} hidden onChange={(e) => add(e.target.files)} />
    </div>
  )
}

/** Existing photos (when editing) as picker items. */
export const toPicked = (media: { url: string; alt?: string | null; width?: number | null; height?: number | null }[]): PickedImage[] =>
  media.map((m) => ({ key: m.url, url: m.url, preview: m.url, alt: m.alt ?? '', width: m.width ?? undefined, height: m.height ?? undefined, uploading: false }))
