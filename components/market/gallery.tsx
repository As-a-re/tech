'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Expand, Package } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** Product pictures: swipe on phones, thumbnails underneath, tap to see full screen. */
export function Gallery({ images, title, badge }: { images: string[]; title: string; badge?: React.ReactNode }) {
  const [i, setI] = useState(0)
  const [full, setFull] = useState(false)
  const strip = useRef<HTMLDivElement>(null)
  const go = (n: number) => {
    const k = (n + images.length) % images.length
    setI(k)
    strip.current?.scrollTo({ left: k * strip.current.clientWidth, behavior: 'smooth' })
  }
  if (!images.length) return <div className="flex aspect-square items-center justify-center rounded-2xl bg-muted sm:aspect-[4/3]"><Package className="size-16 text-muted-foreground" /></div>
  return (
    <div className="space-y-2" data-gallery={images.length}>
      <div className="relative">
        <div ref={strip} onScroll={(e) => { const el = e.currentTarget; setI(Math.round(el.scrollLeft / el.clientWidth)) }}
          className="flex aspect-square snap-x snap-mandatory overflow-x-auto rounded-2xl border bg-muted [scrollbar-width:none] sm:aspect-[4/3]">
          {images.map((src, k) => (
            <button key={src + k} type="button" onClick={() => { setI(k); setFull(true) }} className="size-full shrink-0 snap-center" aria-label={`${title} ${k + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={k === 0 ? title : ''} loading={k === 0 ? 'eager' : 'lazy'} className="size-full object-contain" />
            </button>
          ))}
        </div>
        {badge}
        {images.length > 1 && <>
          <button type="button" aria-label="Previous" onClick={() => go(i - 1)} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white sm:block"><ChevronLeft className="size-5" /></button>
          <button type="button" aria-label="Next" onClick={() => go(i + 1)} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/60 p-1.5 text-white sm:block"><ChevronRight className="size-5" /></button>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{i + 1} / {images.length}</span>
        </>}
        <button type="button" aria-label="Full screen" onClick={() => setFull(true)} className="absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5 text-white"><Expand className="size-4" /></button>
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {images.map((src, k) => (
            <button key={src + k} type="button" onClick={() => go(k)} aria-label={`${k + 1}`} className={cn('size-16 shrink-0 overflow-hidden rounded-lg border-2', k === i ? 'border-primary' : 'border-transparent opacity-70')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-w-[min(96vw,1000px)] border-0 bg-black p-0 sm:max-w-[min(96vw,1000px)]">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <div className="relative flex h-[85dvh] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[i]} alt={title} className="max-h-full max-w-full object-contain" />
            {images.length > 1 && <>
              <button type="button" aria-label="Previous" onClick={() => setI((i - 1 + images.length) % images.length)} className="absolute left-2 rounded-full bg-white/20 p-2 text-white"><ChevronLeft className="size-6" /></button>
              <button type="button" aria-label="Next" onClick={() => setI((i + 1) % images.length)} className="absolute right-2 rounded-full bg-white/20 p-2 text-white"><ChevronRight className="size-6" /></button>
            </>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
