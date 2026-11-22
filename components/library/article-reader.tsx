'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'

const SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl'] as const

/** Chapter reading with adjustable text size; saves the chapter you reached. */
export function ArticleReader({ id, title, chapter, total, heading, body, locked, preview }: {
  id: string; title: string; chapter: number; total: number; heading: string; body: string | null; locked: boolean; preview: boolean
}) {
  const { t } = useI18n()
  const [size, setSize] = useState(1)
  useEffect(() => { try { const v = Number(localStorage.getItem('papa_reader_size')); if (v >= 0 && v < SIZES.length) setSize(v) } catch { /* ignore */ } }, [])
  const change = (d: number) => { const v = Math.min(SIZES.length - 1, Math.max(0, size + d)); setSize(v); try { localStorage.setItem('papa_reader_size', String(v)) } catch { /* ignore */ } }
  useEffect(() => {
    if (locked || preview) return
    void fetch(`/api/publications/${id}/progress`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: chapter, percent: Math.round((chapter / total) * 100) }) }).catch(() => {})
  }, [id, chapter, total, locked, preview])
  return (
    <div className="flex min-h-dvh flex-col" data-article-reader>
      <header className="sticky top-0 z-10 flex items-center gap-1 border-b bg-background/95 px-2 py-2 backdrop-blur">
        <Link href={`/publications/${id}`} aria-label={t('pubs.reader.close')} className="rounded-full p-2 hover:bg-muted"><X className="size-5" /></Link>
        <p className="min-w-0 flex-1 truncate font-semibold">{title}</p>
        <button type="button" onClick={() => change(-1)} aria-label={t('pubs.reader.textSmaller')} className="rounded-full px-2.5 py-1 text-sm font-bold hover:bg-muted">A−</button>
        <button type="button" onClick={() => change(1)} aria-label={t('pubs.reader.textBigger')} className="rounded-full px-2.5 py-1 text-lg font-bold hover:bg-muted">A+</button>
      </header>
      <article className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <p className="text-sm font-semibold text-primary">{chapter} / {total}</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight" data-chapter-title>{heading}</h1>
        {locked ? (
          <div className="mt-10 rounded-2xl border p-6 text-center"><Lock className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-semibold">{t('pubs.previewEnd')}</p><Link href={`/publications/${id}`} className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2 font-black text-black">{t('give.buy', { amount: '' }).trim()}</Link></div>
        ) : (
          <div className={`mt-6 space-y-5 font-serif leading-relaxed ${SIZES[size]}`}>{(body ?? '').split(/\n{2,}/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}</div>
        )}
      </article>
      <footer className="sticky bottom-0 flex items-center justify-between border-t bg-background/95 px-3 py-2 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur">
        {chapter > 1 ? <Link href={`/publications/${id}/read?ch=${chapter - 1}`} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold hover:bg-muted"><ChevronLeft className="size-5" />{t('pubs.reader.prevCh')}</Link> : <span />}
        {chapter < total ? <Link href={`/publications/${id}/read?ch=${chapter + 1}`} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold hover:bg-muted">{t('pubs.reader.nextCh')}<ChevronRight className="size-5" /></Link> : <span />}
      </footer>
    </div>
  )
}
