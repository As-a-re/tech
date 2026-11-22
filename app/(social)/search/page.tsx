import Link from 'next/link'
import { Hash, MapPin } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'
import { searchAssemblies, searchHashtags, searchPeople, searchPosts } from '@/server/discovery/search'
import { listProducts } from '@/server/market/catalog'
import { ProductGrid } from '@/components/market/product-card'
import { followingSet } from '@/server/social/relationships'
import { Feed } from '@/components/posts/feed'
import { LiveSearch } from '@/components/discovery/live-search'
import { PersonRow } from '@/components/people/person-row'
import { FollowButton } from '@/components/profile/follow-button'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Search' }
const TABS = ['top', 'people', 'posts', 'media', 'hashtags', 'assemblies', 'products'] as const
type Tab = (typeof TABS)[number]

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const [t, me, sp] = await Promise.all([getT(), getCurrentUser(), searchParams])
  const q = (sp.q ?? '').trim().slice(0, 100)
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : q.startsWith('#') ? 'hashtags' : 'top'
  const viewer = me?.id ?? null
  const ok = q.replace(/^[@#]/, '').length >= 2
  const [people, posts, tags, places, products] = ok ? await Promise.all([
    tab === 'top' || tab === 'people' ? searchPeople(q, viewer, tab === 'top' ? 3 : 30) : [],
    tab === 'top' || tab === 'posts' || tab === 'media' ? searchPosts(q, viewer, { top: tab === 'top', media: tab === 'media' }) : null,
    tab === 'hashtags' || tab === 'top' ? searchHashtags(q, tab === 'top' ? 3 : 30) : [],
    tab === 'assemblies' ? searchAssemblies(q) : [],
    tab === 'products' ? listProducts({ q, limit: 30 }).then((r) => r.items) : [],
  ]) : [[], null, [], [], []]
  const mine = await followingSet(viewer, people.map((p) => p.id))
  const nothing = ok && !people.length && !(posts?.items.length) && !tags.length && !places.length && !products.length
  return (
    <>
      <div className="sticky top-16 z-30 border-b bg-background/95 backdrop-blur">
        <div className="px-4 pt-2"><LiveSearch key={q} initial={q} autoFocus={!q} tab={tab === 'top' ? undefined : tab} /></div>
        <nav className="flex overflow-x-auto">
          {TABS.map((k) => (
            <Link key={k} href={`/search?q=${encodeURIComponent(q)}&tab=${k}`} className={cn('relative flex-1 whitespace-nowrap px-3 py-3 text-center text-sm font-medium hover:bg-muted/50', tab === k ? 'font-bold' : 'text-muted-foreground')}>
              {t(`search.tabs.${k}` as MessageKey)}{tab === k && <span className="absolute inset-x-1/2 bottom-0 h-1 w-10 -translate-x-1/2 rounded-full bg-primary" />}
            </Link>
          ))}
        </nav>
      </div>
      {!ok ? <p className="px-8 py-14 text-center text-muted-foreground">{t('search.hint')}</p>
        : nothing ? <p className="px-8 py-14 text-center text-muted-foreground">{t('search.none', { q })}</p> : (
          <>
            {people.length > 0 && <div className="divide-y border-b">{people.map((p) => (
              <PersonRow key={p.id} username={p.username} fullName={p.full_name} avatarUrl={p.avatar_url} verified={p.verified} sub={p.assembly_name} bio={p.bio}
                action={me && me.id !== p.id ? <FollowButton size="sm" targetId={p.id} initial={mine.has(p.id) ? 'following' : 'none'} /> : undefined} />
            ))}{tab === 'top' && <Link href={`/search?q=${encodeURIComponent(q)}&tab=people`} className="block px-4 py-3 text-sm text-primary hover:bg-muted/40">{t('explore.showMore')}</Link>}</div>}
            {tags.length > 0 && <ul className="divide-y border-b">{tags.map((x) => (
              <li key={x.tag}><Link href={`/hashtag/${encodeURIComponent(x.tag)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Hash className="size-5" /></span>
                <span><b>#{x.tag}</b><span className="block text-sm text-muted-foreground">{t('explore.posts', { n: x.posts })}</span></span>
              </Link></li>))}</ul>}
            {places.length > 0 && <ul className="divide-y">{places.map((a) => (
              <li key={a.id}><Link href={`/assemblies/${a.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><MapPin className="size-5" /></span>
                <span><b>{a.name}</b><span className="block text-sm text-muted-foreground">{a.town ? `${a.town} · ` : ''}{a.district_name} · {t('search.members', { n: a.members })}</span></span>
              </Link></li>))}</ul>}
            {products.length > 0 && <div className="space-y-3 px-4 py-4"><ProductGrid items={products} t={t} />
              <Link href={`/market/search?q=${encodeURIComponent(q)}`} className="block text-center text-sm font-semibold text-primary hover:underline">{t('market.filters.title')} →</Link></div>}
            {posts && posts.items.length > 0 && <Feed initial={posts} request={{ kind: 'for_you' }} empty="" />}
          </>
        )}
    </>
  )
}
