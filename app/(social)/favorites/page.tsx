import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { favoritesOf } from '@/server/discovery/favorites'
import { favoritesFeed } from '@/server/posts/feeds'
import { PageHeader } from '@/components/common/page-header'
import { PersonRow } from '@/components/people/person-row'
import { Feed } from '@/components/posts/feed'
import { LinkTabs } from '@/components/community/tabs'
import { RemoveFavorite } from './remove'
import { myLibrary } from '@/server/library/publications'
import { PublicationTile, TileGrid } from '@/components/library/publication-card'

export const metadata = { title: 'Favorites' }

/** Favorites (opened from your profile): their posts, and the people you've chosen. */
export default async function FavoritesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [me, t, sp] = await Promise.all([requireUser('/favorites'), getT(), searchParams])
  const tab = sp.tab === 'people' ? 'people' : sp.tab === 'library' ? 'library' : 'posts'
  const people = await favoritesOf(me.id)
  return (
    <>
      <PageHeader title={t('favorites.title')} subtitle={t('favorites.note')} back={`/u/${me.username}`} />
      <LinkTabs active={tab} items={[
        { key: 'posts', label: t('favorites.posts'), href: '/favorites' },
        { key: 'people', label: `${t('favorites.people')} · ${people.length}`, href: '/favorites?tab=people' },
        { key: 'library', label: t('pubs.library'), href: '/favorites?tab=library' },
      ]} />
      {tab === 'library' ? await (async () => {
        const lib = await myLibrary(me.id)
        const all = [...lib.reading, ...lib.saved.filter((s) => !lib.reading.some((r) => r.id === s.id))]
        return all.length ? <TileGrid>{all.map((p) => <PublicationTile key={p.id} p={p} t={t} percent={'percent' in p ? (p as { percent: number }).percent : undefined} />)}</TileGrid>
          : <p className="px-8 py-14 text-center text-muted-foreground">{t('pubs.none')}</p>
      })() : tab === 'posts' ? <Feed initial={await favoritesFeed(me.id)} request={{ kind: 'favorites' }} empty={people.length ? t('favorites.empty') : t('favorites.none')} acceptNew={false} />
        : people.length === 0 ? <p className="px-8 py-14 text-center text-muted-foreground">{t('favorites.none')}</p>
          : <div className="divide-y">{people.map((p) => <PersonRow key={p.id} username={p.username} fullName={p.fullName} avatarUrl={p.avatarUrl} verified={p.verified} sub={p.assemblyName} bio={p.bio} action={<RemoveFavorite id={p.id} />} />)}</div>}
    </>
  )
}
