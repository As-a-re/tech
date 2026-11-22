'use client'

import { useEffect, useState, useTransition } from 'react'
import { Check, Search, X } from 'lucide-react'
import { searchAssembliesAction } from '@/server/actions/admin'

type Hit = { id: string; name: string; town: string | null; districtName: unknown }

/** Searchable assembly picker (never lists every assembly). Submits the chosen id as `name`. */
export function AssemblyPicker({ name = 'assemblyId', initial, placeholder, invalid }: { name?: string; initial?: Hit | null; placeholder: string; invalid?: boolean }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [picked, setPicked] = useState<Hit | null>(initial ?? null)
  const [, start] = useTransition()
  useEffect(() => {
    if (picked || q.trim().length < 2) { setHits([]); return }
    const t = setTimeout(() => start(async () => setHits(await searchAssembliesAction(q))), 200)
    return () => clearTimeout(t)
  }, [q, picked])
  return (
    <div className="relative">
      <input type="hidden" name={name} value={picked?.id ?? ''} />
      {picked ? (
        <div className="flex h-11 items-center gap-2 rounded-md border bg-secondary/50 px-3 text-sm">
          <Check className="size-4 text-primary" />
          <span className="flex-1 truncate"><b>{picked.name}</b> · {String(picked.districtName)}</span>
          <button type="button" aria-label="Change" onClick={() => { setPicked(null); setQ('') }}><X className="size-4" /></button>
        </div>
      ) : (
        <>
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} aria-invalid={invalid}
            className="h-11 w-full rounded-md border bg-transparent pl-9 pr-3 text-sm outline-none focus:border-primary aria-invalid:border-destructive" />
          {hits.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
              {hits.map((h) => (
                <li key={h.id}><button type="button" onClick={() => setPicked(h)} className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted">
                  <b>{h.name}</b><span className="text-muted-foreground"> · {h.town ? `${h.town}, ` : ''}{String(h.districtName)}</span>
                </button></li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
