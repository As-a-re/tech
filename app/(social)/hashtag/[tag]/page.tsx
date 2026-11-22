import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { hashtagFeed } from '@/server/posts/feeds'
import { PageHeader } from '@/components/common/page-header'
import { Feed } from '@/components/posts/feed'

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }) {
  return { title: `#${decodeURIComponent((await params).tag)}` }
}

export default async function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const tag = decodeURIComponent((await params).tag).toLowerCase().slice(0, 50)
  const [t, me] = await Promise.all([getT(), getCurrentUser()])
  const page = await hashtagFeed(tag, me?.id ?? null)
  return (
    <>
      <PageHeader title={`#${tag}`} back="/" />
      <Feed initial={page} request={{ kind: 'hashtag', tag }} empty={t('hashtag.none', { tag })} />
    </>
  )
}
