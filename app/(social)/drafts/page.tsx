import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { listPending } from '@/server/posts/compose'
import { PageHeader } from '@/components/common/page-header'
import { DraftRow } from './draft-row'

export const metadata = { title: 'Drafts & scheduled' }

export default async function DraftsPage() {
  const [me, t] = await Promise.all([requireUser('/drafts'), getT()])
  const rows = await listPending(me.id)
  return (
    <>
      <PageHeader title={t('drafts.title')} back="/" />
      {rows.length === 0 ? <p className="px-8 py-14 text-center text-muted-foreground">{t('drafts.none')}</p>
        : <ul className="divide-y">{rows.map((r) => <DraftRow key={r.id} id={r.id} body={r.body} isDraft={r.isDraft} publishedAt={r.publishedAt?.toISOString() ?? null} />)}</ul>}
    </>
  )
}
