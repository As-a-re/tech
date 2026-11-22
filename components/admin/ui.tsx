import Link from 'next/link'
import { cn } from '@/lib/utils'

export function AdminHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-1 pt-5 sm:px-6"><h1 className="text-xl font-bold">{title}</h1>{action}</div>
}

export function Panel({ title, note, children, className }: { title?: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border p-4 sm:p-5', className)}>
      {title && <h2 className="font-bold">{title}</h2>}
      {note && <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>}
      <div className={title || note ? 'mt-4' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ value, label, sub, tone }: { value: number | string; label: string; sub?: string; tone?: 'red' }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className={cn('text-2xl font-bold tabular-nums', tone === 'red' ? 'text-brand-red' : 'text-primary')}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-sm font-medium">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

/** Previous / Next links that keep the current filters. */
export function Pager({ page, pages, href, labels }: { page: number; pages: number; href: (p: number) => string; labels: { prev: string; next: string; page: string } }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-6">
      <span className="text-muted-foreground">{labels.page}</span>
      <span className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted">{labels.prev}</Link>}
        {page < pages && <Link href={href(page + 1)} className="rounded-md border px-3 py-1.5 hover:bg-muted">{labels.next}</Link>}
      </span>
    </div>
  )
}

export function Chips({ items, active }: { items: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={cn('rounded-full border px-3 py-1 text-sm', i.key === active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>{i.label}</Link>
      ))}
    </div>
  )
}

export function SearchBox({ name = 'q', value, placeholder, hidden }: { name?: string; value?: string; placeholder: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form className="flex-1">
      {Object.entries(hidden ?? {}).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
      <input name={name} defaultValue={value} placeholder={placeholder} aria-label={placeholder}
        className="h-10 w-full rounded-full border bg-muted/50 px-4 text-sm outline-none focus:border-primary focus:bg-background" />
    </form>
  )
}

export const fmtDate = (d: Date | null | undefined, withTime = false) =>
  d ? new Intl.DateTimeFormat('en-GB', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(d) : '—'
