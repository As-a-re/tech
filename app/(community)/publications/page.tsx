import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'
import { listPublications, listSeries, myLibrary, PUBLICATION_KINDS, type PublicationKind } from '@/server/library/publications'
import { hasMinistryRole } from '@/server/library/permissions'
import { PageHeader } from '@/components/common/page-header'
import { PagerLinks } from '@/components/common/pager-links'
import { LinkChips, SearchForm } from '@/components/community/tabs'
import { PublicationTile, TileGrid, TileRow } from '@/components/library/publication-card'

export const metadata = { title: 'Publications' }

export default async function Publications({ searchParams }: { searchParams: Promise<{ kind?: string; q?: string; page?: string }> }) {
  const [t, me, sp] = await Promise.all([getT(), getCurrentUser(), searchParams])
  const kind = PUBLICATION_KINDS.includes(sp.kind as PublicationKind) ? sp.kind as PublicationKind : null
  const [list, series, lib, editor] = await Promise.all([
    listPublications({ kind, q: sp.q, page: Number(sp.page) || 1 }), listSeries(), me ? myLibrary(me.id) : null, hasMinistryRole(me, 'publications_editor'),
  ])
  const first = !kind && !sp.q && (Number(sp.page) || 1) === 1
  return (
    <>
      <PageHeader title={t('pubs.title')} action={editor && (
        <span className="flex gap-2">
          <Link href="/publications/mine" className="rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted">{t('pubs.mine')}</Link>
          <Link href="/publications/new" className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="size-4" />{t('pubs.new')}</Link>
        </span>
      )} />
      <div className="space-y-3 border-b px-4 py-3">
        <p className="text-sm text-muted-foreground">{t('pubs.lead')}</p>
        <SearchForm action="/publications" q={sp.q} placeholder={t('pubs.searchPh')} hidden={{ kind: kind ?? undefined }} />
        <LinkChips active={kind ?? 'all'} items={[{ key: 'all', label: t('pubs.all'), href: '/publications' },
          ...PUBLICATION_KINDS.map((k) => ({ key: k, label: t(`pubs.kindsPlural.${k}` as MessageKey), href: `/publications?kind=${k}` }))]} />
      </div>
      {first && lib && lib.reading.length > 0 && (
        <section className="border-b py-3">
          <h2 className="px-4 pb-2 font-bold">{t('pubs.continue')}</h2>
          <TileRow>{lib.reading.map((p) => <PublicationTile key={p.id} p={p} t={t} percent={p.percent} />)}</TileRow>
        </section>
      )}
      {first && series.length > 0 && (
        <section className="border-b py-3">
          <h2 className="px-4 pb-2 font-bold">{t('pubs.series')}</h2>
          <div className="flex gap-2 overflow-x-auto px-4 pb-1">
            {series.map((s) => (
              <Link key={s.id} href={`/publications/series/${s.slug}`} className="flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm hover:bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.coverUrl ? <img src={s.coverUrl} alt="" className="size-8 rounded-full object-cover" /> : <span className="size-8 rounded-full bg-primary/10" />}
                <span><b>{s.name}</b> <span className="text-muted-foreground">· {t('pubs.issues', { n: s.issues })}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {first && lib && lib.saved.length > 0 && (
        <section className="border-b py-3">
          <h2 className="px-4 pb-2 font-bold">{t('pubs.library')}</h2>
          <TileRow>{lib.saved.map((p) => <PublicationTile key={p.id} p={p} t={t} />)}</TileRow>
        </section>
      )}
      {list.items.length === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{t('pubs.none')}</p>
        : <TileGrid>{list.items.map((p) => <PublicationTile key={p.id} p={p} t={t} />)}</TileGrid>}
      <PagerLinks base="/publications" params={{ kind: kind ?? undefined, q: sp.q || undefined }} page={list.page} hasMore={list.hasMore} labels={{ prev: t('announcements.prev'), next: t('announcements.next') }} />
    </>
  )
}
