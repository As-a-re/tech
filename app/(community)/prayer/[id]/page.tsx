import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { getPrayer, prayedBy } from '@/server/devotion/prayer'
import { listComments } from '@/server/devotion/comments'
import { PageHeader } from '@/components/common/page-header'
import { UserAvatar } from '@/components/common/user-avatar'
import { PrayerCard } from '@/components/devotion/prayer-card'
import { AnswerForm } from '@/components/devotion/prayer-form'
import { Comments } from '@/components/devotion/comments'

export const metadata = { title: 'Prayer request' }

export default async function PrayerDetail({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const viewer = me ? { id: me.id, assemblyId: me.assemblyId, isAdmin: me.role === 'tech_admin' } : null
  const p = await getPrayer(id, viewer)
  if (!p) notFound()
  const [people, comments] = await Promise.all([prayedBy(id), listComments({ prayerId: id }, viewer)])
  return (
    <>
      <PageHeader title={t('prayer.title')} back="/prayer" />
      <PrayerCard p={p} full signedIn={!!me} isAdmin={me?.role === 'tech_admin'} />
      {p.viewer.isAuthor && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          {!p.answered && <AnswerForm id={id} />}
          <Link href={`/testimonies/new?prayer=${id}`} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><Sparkles className="size-4 text-amber-500" />{t('prayer.shareTestimony')}</Link>
        </div>
      )}
      {people.length > 0 && (
        <Link href={`/prayer/${id}/prayed`} className="flex items-center gap-3 border-b px-4 py-3 hover:bg-muted/40">
          <span className="flex -space-x-2">{people.slice(0, 8).map((u) => <UserAvatar key={u.id} name={u.fullName} src={u.avatarUrl} className="size-8 border-2 border-background text-[10px]" />)}</span>
          <span className="text-sm text-muted-foreground">{t('prayer.prayedCount', { n: p.prayedCount })}</span>
        </Link>
      )}
      <h2 className="px-4 pb-1 pt-4 font-bold">{t('prayer.comments', { n: p.commentCount })}</h2>
      <Comments target={{ prayerId: id }} items={comments} me={me ? { fullName: me.fullName, avatarUrl: me.avatarUrl } : null} path={`/prayer/${id}`}
        placeholder={t('prayer.commentPh')} empty={t('prayer.noComments')} />
    </>
  )
}
