import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { getTestimony } from '@/server/devotion/testimonies'
import { listComments } from '@/server/devotion/comments'
import { PageHeader } from '@/components/common/page-header'
import { TestimonyCard } from '@/components/devotion/testimony-card'
import { Comments } from '@/components/devotion/comments'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const x = await getTestimony((await params).id, null)
  return { title: x?.title ?? 'Testimony', description: x?.body.slice(0, 160) }
}

export default async function TestimonyPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const x = await getTestimony(id, me?.id ?? null)
  if (!x) notFound()
  const comments = await listComments({ testimonyId: id }, me ? { id: me.id, isAdmin: me.role === 'tech_admin' } : null)
  return (
    <>
      <PageHeader title={t('testimonies.title')} back="/testimonies" />
      <TestimonyCard x={x} full signedIn={!!me} isAdmin={me?.role === 'tech_admin'} />
      <h2 className="px-4 pb-1 pt-4 font-bold">{t('testimonies.comments', { n: x.commentCount })}</h2>
      <Comments target={{ testimonyId: id }} items={comments} me={me ? { fullName: me.fullName, avatarUrl: me.avatarUrl } : null} path={`/testimonies/${id}`}
        placeholder={t('testimonies.commentPh')} empty={t('testimonies.noComments')} />
    </>
  )
}
