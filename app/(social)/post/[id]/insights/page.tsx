import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { insights } from '@/server/posts/interactions'
import { hydrate } from '@/server/posts/hydrate'
import { PageHeader } from '@/components/common/page-header'
import { PostCard } from '@/components/posts/post-card'

export const metadata = { title: 'Post insights' }

export default async function InsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t] = await Promise.all([params, getT()])
  const me = await requireUser(`/post/${id}/insights`)
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const [data, posts] = await Promise.all([insights(me.id, id), hydrate([id], me.id)])
  if (!data || !posts.get(id)) notFound()
  const tiles: [string, string | number][] = [
    [t('post.views'), data.views], [t('post.engagements'), data.engagements], [t('post.rate'), `${data.rate}%`],
    [t('post.likes'), data.likes], [t('post.reposts'), data.reposts], [t('post.replies'), data.replies], [t('post.quotes'), data.quotes], [t('post.bookmarks'), data.bookmarks],
  ]
  return (
    <>
      <PageHeader title={t('post.insightsTitle')} back={`/post/${id}`} />
      <PostCard post={posts.get(id)!} variant="ancestor" />
      <div className="grid grid-cols-2 gap-3 border-t p-4 sm:grid-cols-4">
        {tiles.map(([k, v]) => <div key={k} className="rounded-2xl border p-4"><p className="text-2xl font-bold tabular-nums text-primary">{typeof v === 'number' ? v.toLocaleString() : v}</p><p className="text-sm text-muted-foreground">{k}</p></div>)}
      </div>
    </>
  )
}
