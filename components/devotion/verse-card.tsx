'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BookOpen, Copy, Share2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { useCompose } from '@/components/posts/compose-provider'
import { cn } from '@/lib/utils'

type V = { day: string; reference: string; text: string; translation: string }
const KEY = 'papa_verse_hidden'

/** Verse of the day card. On Home it can be hidden until tomorrow (remembered on this device). */
export function VerseCard({ v, hideable, className }: { v: V; hideable?: boolean; className?: string }) {
  const { t } = useI18n()
  const { openCompose } = useCompose()
  const [hidden, setHidden] = useState(false)
  useEffect(() => { try { setHidden(hideable === true && localStorage.getItem(KEY) === v.day) } catch { /* private mode */ } }, [hideable, v.day])
  if (hidden) return null
  const line = `“${v.text}” — ${v.reference} (${v.translation})`
  return (
    <section className={cn('relative overflow-hidden border-b bg-gradient-to-br from-brand-blue to-[#0a2e6e] px-5 py-5 text-white dark:from-black dark:to-black dark:border-brand-blue/40', className)}>
      <div aria-hidden className="absolute -right-10 -top-12 size-44 rounded-full bg-white/5" />
      <div className="relative flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
        <BookOpen className="size-4" />{t('verse.title')}
        {hideable && <button type="button" aria-label={t('verse.hide')} title={t('verse.hide')} onClick={() => { try { localStorage.setItem(KEY, v.day) } catch { /* ignore */ } setHidden(true) }}
          className="ml-auto rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>}
      </div>
      <blockquote className="relative mt-2 font-serif text-[19px] italic leading-relaxed">“{v.text}”</blockquote>
      <p className="relative mt-2 text-sm font-semibold text-white/90">{v.reference} <span className="font-normal text-white/60">· {v.translation}</span></p>
      <div className="relative mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => openCompose({ mode: 'post', text: `${line}\n\n#VerseOfTheDay` })} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-brand-blue hover:bg-white/90"><Share2 className="size-4" />{t('verse.share')}</button>
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(line); toast.success(t('verse.copied')) }} className="flex items-center gap-1.5 rounded-full border border-white/40 px-3 py-1.5 text-sm font-semibold hover:bg-white/10"><Copy className="size-4" />{t('verse.copy')}</button>
        {hideable && <Link href="/verse" className="rounded-full px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10">{t('verse.seeAll')}</Link>}
      </div>
    </section>
  )
}
