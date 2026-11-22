import Link from 'next/link'
import { ChevronRight, Heart } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { folders as listFolders, savedFeed } from '@/server/discovery/saved'
import { PageHeader } from '@/components/common/page-header'
import { Feed } from '@/components/posts/feed'
import { FolderBar } from '@/components/saved/folder-bar'

export const metadata = { title: 'Saved' }

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const [me, t, sp] = await Promise.all([requireUser('/saved'), getT(), searchParams])
  const fs = await listFolders(me.id)
  const folder = sp.folder === 'none' ? 'none' : fs.some((f) => f.id === sp.folder) ? sp.folder! : null
  const { folderOf: _f, ...page } = await savedFeed(me.id, folder)
  void _f
  return (
    <>
      <PageHeader title={t('saved.title')} subtitle={t('saved.note')} />
      <Link href="/market/wishlist" className="flex items-center gap-3 border-b px-4 py-3 hover:bg-muted/50" data-wishlist-link>
        <span className="flex size-10 items-center justify-center rounded-full bg-brand-red/10 text-brand-red"><Heart className="size-5" /></span>
        <span className="min-w-0 flex-1"><b className="block">{t('saved.wishlist')}</b><span className="text-sm text-muted-foreground">{t('saved.wishlistText')}</span></span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
      <FolderBar folders={fs.map((f) => ({ ...f, items: Number(f.items) }))} active={folder} />
      <Feed key={folder ?? 'all'} initial={page} request={{ kind: 'saved', folder }} empty={t('saved.none')} />
    </>
  )
}
