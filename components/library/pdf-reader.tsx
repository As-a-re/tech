'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, Minus, Moon, Plus, Sun, X } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

/** Page-by-page PDF reader: swipe or arrows to turn, zoom, dark pages, and it remembers where you stopped. */
export function PdfReader({ id, url, title, startPage, preview, totalPages, backHref, track = true }: { id: string; url: string; title: string; startPage: number; preview: boolean; totalPages: number | null; backHref?: string; track?: boolean }) {
  const back = backHref ?? `/publications/${id}`
  const { t } = useI18n()
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(Math.max(1, startPage))
  const [zoom, setZoom] = useState(1)
  const [dark, setDark] = useState(false)
  const [error, setError] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const task = useRef<RenderTask | null>(null)
  const touch = useRef<number | null>(null)

  useEffect(() => { try { setDark(localStorage.getItem('papa_reader_dark') === '1') } catch { /* ignore */ } }, [])
  useEffect(() => {
    let gone = false
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const offline = typeof navigator !== 'undefined' && !navigator.onLine
        const d = await pdfjs.getDocument({ url, withCredentials: true, disableRange: offline, disableStream: offline }).promise
        if (!gone) { setDoc(d); setPage((p) => Math.min(p, d.numPages)) }
      } catch { if (!gone) setError(true) }
    })()
    return () => { gone = true }
  }, [url])

  const render = useCallback(async () => {
    if (!doc || !canvas.current || !box.current) return
    const pg = await doc.getPage(page)
    const base = pg.getViewport({ scale: 1 })
    const width = Math.min(box.current.clientWidth - 16, 900) * zoom
    const scale = width / base.width
    const dpr = window.devicePixelRatio || 1
    const vp = pg.getViewport({ scale: scale * dpr })
    const c = canvas.current
    c.width = vp.width; c.height = vp.height
    c.style.width = `${vp.width / dpr}px`; c.style.height = `${vp.height / dpr}px`
    task.current?.cancel()
    task.current = pg.render({ canvasContext: c.getContext('2d')!, viewport: vp })
    await task.current.promise.catch(() => {})
  }, [doc, page, zoom])
  useEffect(() => { void render() }, [render])
  useEffect(() => { const onResize = () => void render(); window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize) }, [render])

  // Save the place a moment after turning a page
  const pages = doc?.numPages ?? 0
  useEffect(() => {
    if (!pages || preview || !track) return
    const tm = setTimeout(() => { void fetch(`/api/publications/${id}/progress`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: page, percent: Math.round((page / pages) * 100) }) }).catch(() => {}) }, 1200)
    return () => clearTimeout(tm)
  }, [id, page, pages, preview, track])

  const go = useCallback((d: number) => setPage((p) => Math.min(Math.max(1, p + d), pages || p)), [pages])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])
  const toggleDark = () => { setDark(!dark); try { localStorage.setItem('papa_reader_dark', dark ? '0' : '1') } catch { /* ignore */ } }
  const atPreviewEnd = preview && pages > 0 && page === pages

  return (
    <div className="flex min-h-dvh flex-col" data-pdf-reader>
      <header className="sticky top-0 z-10 flex items-center gap-1 border-b bg-background/95 px-2 py-2 backdrop-blur">
        <Link href={back} aria-label={t('pubs.reader.close')} className="rounded-full p-2 hover:bg-muted"><X className="size-5" /></Link>
        <p className="min-w-0 flex-1 truncate font-semibold">{title}</p>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} aria-label={t('pubs.reader.zoomOut')} className="rounded-full p-2 hover:bg-muted"><Minus className="size-5" /></button>
        <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))} aria-label={t('pubs.reader.zoomIn')} className="rounded-full p-2 hover:bg-muted"><Plus className="size-5" /></button>
        <button type="button" onClick={toggleDark} aria-label={dark ? t('pubs.reader.light') : t('pubs.reader.dark')} className="rounded-full p-2 hover:bg-muted">{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</button>
      </header>
      <div ref={box} className="flex flex-1 justify-center overflow-auto bg-muted/40 py-3"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
        onTouchEnd={(e) => { if (touch.current === null || zoom > 1) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); touch.current = null }}>
        {error ? <p className="p-10 text-center text-muted-foreground">{t('pubs.reader.error')}</p>
          : !doc ? <p className="p-10 text-center text-muted-foreground">{t('pubs.reader.loading')}</p>
            : <canvas ref={canvas} data-page={page} className={cn('h-fit bg-white shadow-lg', dark && 'invert hue-rotate-180')} aria-label={t('pubs.reader.page', { n: page, total: pages })} />}
      </div>
      {atPreviewEnd && (
        <div className="border-t bg-background px-4 py-4 text-center">
          <p className="font-semibold">{t('pubs.previewEnd')}</p>
          <Link href={back} className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2 font-black text-black"><Lock className="size-4" />{t('give.buy', { amount: '' }).trim()}</Link>
        </div>
      )}
      <footer className="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-background/95 px-3 py-2 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur">
        <button type="button" disabled={page <= 1} onClick={() => go(-1)} aria-label={t('pubs.reader.prev')} className="rounded-full p-2.5 hover:bg-muted disabled:opacity-40"><ChevronLeft className="size-6" /></button>
        <span className="text-sm tabular-nums text-muted-foreground" data-page-label>{t('pubs.reader.page', { n: page, total: preview && totalPages ? totalPages : pages || '…' })}</span>
        <button type="button" disabled={!pages || page >= pages} onClick={() => go(1)} aria-label={t('pubs.reader.next')} className="rounded-full p-2.5 hover:bg-muted disabled:opacity-40"><ChevronRight className="size-6" /></button>
      </footer>
    </div>
  )
}
