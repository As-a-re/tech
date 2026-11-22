import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { getCurrentUser } from '@/server/identity/session'
import { listPublications, seriesBySlug } from '@/server/library/publications'
import { PageHeader } from '@/components/common/page-header'
import { PublicationTile, TileGrid } from '@/components/library/publication-card'
import { FollowSeriesButton } from '@/components/library/publication-actions'

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const s = await seriesBySlug(slug, me?.id ?? null)
  if (!s) notFound()
  const list = await listPublications({ seriesId: s.id })
  return (
    <>
      <PageHeader title={s.name} subtitle={t(`pubs.kinds.${s.kind}` as MessageKey)} back="/publications" />
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <p className="flex-1 text-sm text-muted-foreground">{s.description ?? t('pubs.followHint')} · {t('pubs.followers', { n: s.followers })}</p>
        {me && <FollowSeriesButton seriesId={s.id} initial={s.following} />}
      </div>
      {list.items.length === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{t('pubs.none')}</p> : <TileGrid>{list.items.map((p) => <PublicationTile key={p.id} p={p} t={t} />)}</TileGrid>}
    </>
  )
}
