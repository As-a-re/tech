'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useDataSaver } from '@/hooks/use-data-saver'
import type { PostMediaView } from '@/lib/posts/types'
import { cn } from '@/lib/utils'

/** 1–4 photos in a grid (tap to open full screen), or one video. Data saver: tap to load. */
export function MediaGrid({ media }: { media: PostMediaView[] }) {
  const saver = useDataSaver()
  const [revealed, setRevealed] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  if (!media.length) return null
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  if (saver && !revealed) return (
    <button type="button" onClick={(e) => { stop(e); setRevealed(true) }} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border bg-muted/50 py-10 text-sm font-medium text-muted-foreground">
      <ImageIcon className="size-5" />{media[0].kind === 'video' ? 'Tap to load video' : `Tap to load ${media.length > 1 ? `${media.length} photos` : 'photo'}`}
    </button>
  )

  if (media[0].kind === 'video') return (
    <div className="mt-3 overflow-hidden rounded-2xl border bg-black" onClick={stop}>
      <video src={media[0].url} controls playsInline preload={saver ? 'none' : 'metadata'} className="max-h-[520px] w-full" aria-label={media[0].alt ?? 'Video'} />
    </div>
  )

  const n = media.length
  return (
    <>
      <div className={cn('mt-3 grid gap-0.5 overflow-hidden rounded-2xl border', n === 1 ? 'grid-cols-1' : 'grid-cols-2', n > 1 && 'aspect-[16/10]')}>
        {media.map((m, i) => (
          <button key={m.id} type="button" onClick={(e) => { stop(e); setOpen(i) }}
            className={cn('relative block overflow-hidden bg-muted', n === 3 && i === 0 && 'row-span-2', n === 1 && 'max-h-[520px]')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.alt ?? ''} loading="lazy" className={cn('size-full', n === 1 ? 'max-h-[520px] object-contain' : 'object-cover')} />
            {m.alt && <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 text-[10px] font-bold text-white">ALT</span>}
          </button>
        ))}
      </div>
      <Lightbox media={media} index={open} onIndex={setOpen} />
    </>
  )
}

function Lightbox({ media, index, onIndex }: { media: PostMediaView[]; index: number | null; onIndex: (i: number | null) => void }) {
  const go = useCallback((d: number) => index !== null && onIndex((index + d + media.length) % media.length), [index, media.length, onIndex])
  useEffect(() => {
    if (index === null) return
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1) }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [index, go])
  const m = index !== null ? media[index] : null
  return (
    <Dialog open={index !== null} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent aria-describedby={undefined} showCloseButton={false} className="flex h-[100dvh] max-w-none items-center justify-center border-0 bg-black/95 p-0 sm:max-w-none sm:rounded-none" onClick={(e) => e.stopPropagation()}>
        <DialogTitle className="sr-only">{m?.alt || 'Photo'}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {m && <img src={m.url} alt={m.alt ?? ''} className="max-h-[92dvh] max-w-[96vw] object-contain" />}
        {m?.alt && <p className="absolute bottom-4 left-1/2 max-w-xl -translate-x-1/2 rounded bg-black/70 px-3 py-2 text-center text-sm text-white">{m.alt}</p>}
        <button aria-label="Close" onClick={() => onIndex(null)} className="absolute left-3 top-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="size-5" /></button>
        {media.length > 1 && <>
          <button aria-label="Previous" onClick={() => go(-1)} className="absolute left-3 top-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronLeft className="size-6" /></button>
          <button aria-label="Next" onClick={() => go(1)} className="absolute right-3 top-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronRight className="size-6" /></button>
        </>}
      </DialogContent>
    </Dialog>
  )
}
