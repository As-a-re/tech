import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { myPublications } from '@/server/library/publications'
import { PageHeader } from '@/components/common/page-header'
import { PublicationTile, TileGrid } from '@/components/library/publication-card'

export const metadata = { title: 'My publications' }

export default async function MyPublications() {
  const [me, t] = await Promise.all([requireUser('/publications/mine'), getT()])
  const items = await myPublications(me)
  return (
    <>
      <PageHeader title={t('pubs.mine')} back="/publications" />
      {items.length === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{t('pubs.none')}</p> : <TileGrid>{items.map((p) => <PublicationTile key={p.id} p={p} t={t} />)}</TileGrid>}
    </>
  )
}
