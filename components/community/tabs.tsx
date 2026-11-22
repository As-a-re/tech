import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Underlined tabs as links (server-rendered). */
export function LinkTabs({ items, active, sticky = true }: { items: { key: string; label: string; href: string }[]; active: string; sticky?: boolean }) {
  return (
    <nav className={cn('flex overflow-x-auto border-b bg-background/95 backdrop-blur', sticky && 'sticky top-[7.5rem] z-20')}>
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={active === i.key ? 'page' : undefined}
          className={cn('relative flex-1 whitespace-nowrap px-3 py-3.5 text-center text-[15px] font-medium hover:bg-muted/50', active === i.key ? 'font-bold' : 'text-muted-foreground')}>
          {i.label}{active === i.key && <span className="absolute inset-x-1/2 bottom-0 h-1 w-14 -translate-x-1/2 rounded-full bg-primary" />}
        </Link>
      ))}
    </nav>
  )
}

/** Chip filters as links. */
export function LinkChips({ items, active }: { items: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={active === i.key ? 'page' : undefined}
          className={cn('whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium', active === i.key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>{i.label}</Link>
      ))}
    </div>
  )
}

export function SearchForm({ action, q, placeholder, hidden }: { action: string; q?: string; placeholder: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form action={action} className="relative">
      {Object.entries(hidden ?? {}).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 fill-none stroke-current stroke-2 text-muted-foreground"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} className="h-10 w-full rounded-full border bg-muted/60 pl-10 pr-4 text-sm outline-none focus:border-primary focus:bg-background" />
    </form>
  )
}
