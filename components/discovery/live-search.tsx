'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Church, Hash, Package, Search, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { getJson } from '@/lib/live-fetch'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'

type Suggest = {
  people: { username: string; fullName: string; avatarUrl: string | null; verified: boolean; assembly: string }[]
  tags: { tag: string; posts: number }[]
  places: { slug: string; name: string; district: string }[]
  pubs?: { id: string; title: string; edition: string | null; coverUrl: string | null }[]
  products?: { id: string; title: string; price: string; image: string | null; shop: string }[]
}

/** The search box on Explore: suggestions appear as you type; Enter shows all results. */
export function LiveSearch({ initial = '', autoFocus, tab }: { initial?: string; autoFocus?: boolean; tab?: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [q, setQ] = useState(initial)
  const [s, setS] = useState<Suggest | null>(null)
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (autoFocus) input.current?.focus() }, [autoFocus])
  useEffect(() => {
    if (q.trim().replace(/^[@#]/, '').length < 1) { setS(null); return }
    const tm = setTimeout(() => { getJson<Suggest>(`/api/search/suggest?q=${encodeURIComponent(q.trim())}`).then(setS) }, 180)
    return () => clearTimeout(tm)
  }, [q])
  const go = (term = q) => { const v = term.trim(); if (!v) return; setOpen(false); router.push(`/search?q=${encodeURIComponent(v)}${tab ? `&tab=${tab}` : ''}`) }
  const any = s && (s.people.length || s.tags.length || s.places.length || s.pubs?.length || s.products?.length)
  return (
    <div className="relative">
      <form role="search" onSubmit={(e) => { e.preventDefault(); go() }}>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          enterKeyHint="search" placeholder={t('search.placeholder')} aria-label={t('search.placeholder')} autoComplete="off"
          className="h-11 w-full rounded-full border bg-muted/60 pl-10 pr-10 text-[15px] outline-none focus:border-primary focus:bg-background" />
        {q && <button type="button" aria-label={t('messages.cancel')} onClick={() => { setQ(''); input.current?.focus() }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>}
      </form>
      {open && q.trim() && (
        <div className="absolute inset-x-0 top-12 z-40 max-h-[70dvh] overflow-y-auto rounded-2xl border bg-popover py-1 shadow-xl">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go()} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted">
            <Search className="size-4 text-primary" /><span className="truncate">{t('search.for', { q: q.trim() })}</span>
          </button>
          {any ? <div className="border-t" /> : null}
          {s?.people.map((p) => (
            <Link key={p.username} href={`/u/${p.username}`} onMouseDown={(e) => e.preventDefault()} className="flex items-center gap-3 px-4 py-2 hover:bg-muted">
              <UserAvatar name={p.fullName} src={p.avatarUrl} className="size-9" />
              <span className="min-w-0"><span className="flex items-center gap-1 font-semibold"><span className="truncate">{p.fullName}</span>{p.verified && <VerifiedBadge />}</span>
                <span className="block truncate text-xs text-muted-foreground">@{p.username} · {p.assembly}</span></span>
            </Link>
          ))}
          {s?.tags.map((x) => (
            <Link key={x.tag} href={`/hashtag/${encodeURIComponent(x.tag)}`} onMouseDown={(e) => e.preventDefault()} className="flex items-center gap-3 px-4 py-2 hover:bg-muted">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Hash className="size-4" /></span>
              <span><b>#{x.tag}</b><span className="block text-xs text-muted-foreground">{t('explore.posts', { n: x.posts })}</span></span>
            </Link>
          ))}
          {s?.places.map((a) => (
            <Link key={a.slug} href={`/assemblies/${a.slug}`} onMouseDown={(e) => e.preventDefault()} className="flex items-center gap-3 px-4 py-2 hover:bg-muted">
              <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Church className="size-4" /></span>
              <span><b>{a.name}</b><span className="block text-xs text-muted-foreground">{a.district}</span></span>
            </Link>
          ))}
          {s?.pubs?.map((p) => (
            <Link key={p.id} href={`/publications/${p.id}`} onMouseDown={(e) => e.preventDefault()} className="flex items-center gap-3 px-4 py-2 hover:bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.coverUrl ? <img src={p.coverUrl} alt="" className="h-11 w-8 rounded object-cover" /> : <span className="flex h-11 w-8 items-center justify-center rounded bg-primary/10 text-primary"><BookOpen className="size-4" /></span>}
              <span className="min-w-0"><b className="block truncate">{p.title}</b>{p.edition && <span className="block truncate text-xs text-muted-foreground">{p.edition}</span>}</span>
            </Link>
          ))}
          {s?.products?.map((p) => (
            <Link key={p.id} href={`/market/p/${p.id}`} onMouseDown={(e) => e.preventDefault()} className="flex items-center gap-3 px-4 py-2 hover:bg-muted" data-suggest-product>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.image ? <img src={p.image} alt="" className="size-9 rounded-lg object-cover" /> : <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Package className="size-4" /></span>}
              <span className="min-w-0"><b className="block truncate">{p.title}</b><span className="block truncate text-xs text-muted-foreground">{p.price} · {p.shop}</span></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
