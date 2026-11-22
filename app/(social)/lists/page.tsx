import Link from 'next/link'
import { Lock, Plus } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { myLists } from '@/server/discovery/lists'
import { PageHeader } from '@/components/common/page-header'

export const metadata = { title: 'Lists' }

export default async function ListsPage() {
  const [me, t] = await Promise.all([requireUser('/lists'), getT()])
  const lists = await myLists(me.id)
  return (
    <>
      <PageHeader title={t('lists.title')} action={<Link href="/lists/new" className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"><Plus className="size-4" />{t('lists.new')}</Link>} />
      {lists.length === 0 ? <p className="px-8 py-14 text-center text-muted-foreground">{t('lists.none')}</p> : (
        <ul className="divide-y">{lists.map((l) => (
          <li key={l.id}><Link href={`/lists/${l.id}`} className="block px-4 py-3.5 hover:bg-muted/40">
            <span className="flex items-center gap-1.5 font-bold">{l.name}{l.isPrivate && <Lock className="size-3.5 text-muted-foreground" />}</span>
            {l.description && <span className="block text-sm text-muted-foreground">{l.description}</span>}
            <span className="block text-sm text-muted-foreground">{t('lists.members', { n: l.members })}</span>
          </Link></li>))}</ul>
      )}
    </>
  )
}
