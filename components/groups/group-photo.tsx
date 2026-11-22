'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2, Users } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { compressImage } from '@/lib/posts/image-compress'
import { cn } from '@/lib/utils'

/** Round group photo; tap to choose a new one (uploaded straight away). */
export function GroupPhoto({ url, onChange, onError, editable = true, size = 'lg' }: {
  url: string | null; onChange?: (url: string | null) => void; onError?: (code: string) => void; editable?: boolean; size?: 'md' | 'lg'
}) {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) { onError?.('photo'); return }
    setBusy(true)
    try {
      const p = await compressImage(f)
      const fd = new FormData(); fd.append('file', p.file)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error()
      onChange?.(json.url)
    } catch { onError?.('photo') } finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  const box = size === 'lg' ? 'size-28' : 'size-16'
  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" disabled={!editable || busy} onClick={() => input.current?.click()} aria-label={t('groups.changePhoto')}
        className={cn('relative overflow-hidden rounded-full bg-primary/10 text-primary', box, editable && 'hover:opacity-90')}>
        {url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={url} alt="" className="size-full object-cover" />
          : <Users className="m-auto size-1/2" />}
        {editable && <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/45 py-1 text-white">{busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}</span>}
      </button>
      {editable && url && <button type="button" onClick={() => onChange?.(null)} className="text-xs text-muted-foreground hover:underline">{t('groups.removePhoto')}</button>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}
