import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Lock } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { getList, listFeed } from '@/server/discovery/lists'
import { PageHeader } from '@/components/common/page-header'
import { Feed } from '@/components/posts/feed'

export const metadata = { title: 'List' }

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t, me] = await Promise.all([params, getT(), getCurrentUser()])
  const list = await getList(id, me?.id ?? null)
  if (!list) notFound()
  const page = await listFeed(id, me?.id ?? null)
  const own = me?.id === list.ownerId
  return (
    <>
      <PageHeader title={list.name} subtitle={t('lists.by', { username: list.ownerUsername })} back="/lists" />
      <div className="border-b px-4 py-4">
        <p className="flex items-center gap-1.5 text-xl font-bold">{list.name}{list.isPrivate && <Lock className="size-4 text-muted-foreground" aria-label={t('lists.privateLabel')} />}</p>
        {list.description && <p className="mt-1 text-[15px]">{list.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/lists/${id}/members`} className="hover:underline"><b>{list.members}</b> <span className="text-muted-foreground">{t('lists.members', { n: '' }).trim()}</span></Link>
          {own && <><Link href={`/lists/${id}/members`} className="rounded-full border px-3 py-1 font-semibold hover:bg-muted">{t('lists.manage')}</Link>
            <Link href={`/lists/${id}/edit`} className="rounded-full border px-3 py-1 font-semibold hover:bg-muted">{t('lists.edit')}</Link></>}
        </div>
      </div>
      <Feed initial={page} request={{ kind: 'list', listId: id }} empty={t('lists.emptyFeed')} />
    </>
  )
}
