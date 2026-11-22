import Link from 'next/link'
import { Church, Clock } from 'lucide-react'
import type { DirectoryAssembly } from '@/server/community/directory'
import { clock } from '@/lib/community/dates'

export function AssemblyRow({ a, days, nextLabel, onPapa }: { a: DirectoryAssembly; days: string[]; nextLabel: string; onPapa: string }) {
  return (
    <Link href={`/assemblies/${a.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Church className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{a.name}</span>
        <span className="block truncate text-sm text-muted-foreground">{[a.town, onPapa.replace('{n}', String(a.accounts))].filter(Boolean).join(' · ')}</span>
        {a.nextService && <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" />
          {nextLabel.replace('{label}', a.nextService.label).replace('{day}', days[a.nextService.day]).replace('{time}', clock(a.nextService.start))}</span>}
      </span>
    </Link>
  )
}
