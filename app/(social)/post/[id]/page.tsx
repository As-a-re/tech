import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { thread } from '@/server/posts/feeds'
import { PageHeader } from '@/components/common/page-header'
import { PostCard } from '@/components/posts/post-card'
import { Composer } from '@/components/posts/composer'

const isId = (s: string) => /^[0-9a-f-]{36}$/.test(s)

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isId(id)) return { title: 'Post' }
  const th = await thread(id, null)
  if (!th || th.post.deleted) return { title: 'Post' }
  const text = th.post.body.slice(0, 160)
  return {
    title: `${th.post.author.fullName}: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`, description: text,
    openGraph: { description: text, images: th.post.media[0]?.kind === 'image' ? [th.post.media[0].url] : undefined },
  }
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  if (!isId(id)) notFound()
  const th = await thread(id, me?.id ?? null)
  if (!th) notFound()
  return (
    <>
      <PageHeader title={t('post.postTitle')} back="/" />
      {th.ancestors.map((p) => <PostCard key={p.id} post={p} variant="ancestor" />)}
      <PostCard post={th.post} variant="detail" />
      {me && th.post.viewer.canReply && <div className="border-b px-4 py-3"><Composer me={me} mode="reply" target={th.post} compact /></div>}
      {!me && <Link href={`/login?next=/post/${id}`} className="block border-b px-4 py-4 text-center text-[15px] font-semibold text-primary hover:bg-muted/40">{t('post.signInToReply')}</Link>}
      {me && !th.post.viewer.canReply && !th.post.deleted && <p className="border-b px-4 py-3 text-sm text-muted-foreground">{t('post.replyLimited')}</p>}
      {th.replies.length === 0 ? <p className="px-8 py-12 text-center text-muted-foreground">{t('post.noReplies')}</p>
        : th.replies.map((r) => <PostCard key={r.id} post={r} />)}
    </>
  )
}
