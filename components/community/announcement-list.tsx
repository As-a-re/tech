import Link from 'next/link'
import type { AnnouncementView } from '@/server/community/announcements'
import { AnnouncementCard } from './announcement-card'

/** A page of announcements with Newer / Older links (keeps the other query parameters). */
export function AnnouncementList({ items, page, hasMore, empty, base, params, signedIn, isAdmin, labels }: {
  items: AnnouncementView[]; page: number; hasMore: boolean; empty: string; base: string; params?: Record<string, string | undefined>
  signedIn: boolean; isAdmin: boolean; labels: { prev: string; next: string }
}) {
  if (!items.length && page === 1) return <p className="px-8 py-16 text-center text-[15px] text-muted-foreground">{empty}</p>
  const href = (p: number) => `${base}?${new URLSearchParams(Object.entries({ ...params, page: p > 1 ? String(p) : undefined }).filter(([, v]) => v) as [string, string][]).toString()}`
  return (
    <div>
      {items.map((a) => <AnnouncementCard key={a.id} a={a} signedIn={signedIn} isAdmin={isAdmin} />)}
      {(page > 1 || hasMore) && (
        <nav className="flex justify-between px-4 py-4 text-sm font-medium">
          {page > 1 ? <Link href={href(page - 1)} className="rounded-full border px-4 py-1.5 hover:bg-muted">← {labels.prev}</Link> : <span />}
          {hasMore && <Link href={href(page + 1)} className="rounded-full border px-4 py-1.5 hover:bg-muted">{labels.next} →</Link>}
        </nav>
      )}
    </div>
  )
}
