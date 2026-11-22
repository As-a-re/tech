import Link from 'next/link'

/** Newer / Older links for numbered pages (keeps the other query parameters). */
export function PagerLinks({ base, params, page, hasMore, labels }: { base: string; params?: Record<string, string | undefined>; page: number; hasMore: boolean; labels: { prev: string; next: string } }) {
  if (page <= 1 && !hasMore) return null
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: p > 1 ? String(p) : undefined }).filter(([, v]) => v) as [string, string][]).toString()
    return q ? `${base}?${q}` : base
  }
  return (
    <nav className="flex justify-between px-4 py-4 text-sm font-medium">
      {page > 1 ? <Link href={href(page - 1)} className="rounded-full border px-4 py-1.5 hover:bg-muted">← {labels.prev}</Link> : <span />}
      {hasMore && <Link href={href(page + 1)} className="rounded-full border px-4 py-1.5 hover:bg-muted">{labels.next} →</Link>}
    </nav>
  )
}
