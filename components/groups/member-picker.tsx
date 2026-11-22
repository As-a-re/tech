'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check, Search, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/common/user-avatar'
import { searchMembersAction } from '@/server/actions/search'

export type Picked = { id: string; fullName: string; avatarUrl: string | null }

/** Search members and tick the ones to add (chosen people show as chips on top). */
export function MemberPicker({ value, onChange, exclude = [] }: { value: Picked[]; onChange: (v: Picked[]) => void; exclude?: string[] }) {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Awaited<ReturnType<typeof searchMembersAction>>>([])
  const [pending, start] = useTransition()
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const id = setTimeout(() => start(async () => setHits(await searchMembersAction(q))), 200)
    return () => clearTimeout(id)
  }, [q])
  const chosen = new Set(value.map((v) => v.id))
  const toggle = (p: Picked) => onChange(chosen.has(p.id) ? value.filter((v) => v.id !== p.id) : [...value, p])
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p) => (
            <button key={p.id} type="button" onClick={() => toggle(p)} className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-1 pr-2 text-sm font-medium text-primary">
              <UserAvatar name={p.fullName} src={p.avatarUrl} className="size-6" />{p.fullName.split(' ')[0]}<X className="size-3.5" />
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('messages.findPerson')} aria-label={t('messages.findPerson')}
          className="h-11 w-full rounded-full border bg-muted/60 pl-9 pr-3 text-sm outline-none focus:border-primary" />
      </div>
      <ul className="max-h-72 divide-y overflow-y-auto">
        {hits.filter((h) => !exclude.includes(h.id)).map((h) => {
          const on = chosen.has(h.id)
          return (
            <li key={h.id}><button type="button" aria-pressed={on} onClick={() => toggle({ id: h.id, fullName: h.full_name, avatarUrl: h.avatar_url })} className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-muted">
              <UserAvatar name={h.full_name} src={h.avatar_url} />
              <span className="min-w-0 flex-1"><b className="block truncate">{h.full_name}</b><span className="block truncate text-sm text-muted-foreground">@{h.username} · {h.assembly_name}</span></span>
              <span className={cn('flex size-6 items-center justify-center rounded-full border-2', on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>{on && <Check className="size-4" />}</span>
            </button></li>
          )
        })}
        {q.trim().length >= 2 && !hits.length && !pending && <li className="py-6 text-center text-sm text-muted-foreground">{t('messages.noPeople')}</li>}
      </ul>
    </div>
  )
}
