import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { listTestimonies } from '@/server/devotion/testimonies'
import { PageHeader } from '@/components/common/page-header'
import { PagerLinks } from '@/components/common/pager-links'
import { SearchForm } from '@/components/community/tabs'
import { TestimonyCard } from '@/components/devotion/testimony-card'

export const metadata = { title: 'Testimonies' }

export default async function Testimonies({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const [t, me, sp] = await Promise.all([getT(), getCurrentUser(), searchParams])
  const q = sp.q?.trim() || undefined
  const list = await listTestimonies({ viewerId: me?.id ?? null, q, page: Number(sp.page) || 1 })
  return (
    <>
      <PageHeader title={t('testimonies.title')} action={me && <Link href="/testimonies/new" className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="size-4" />{t('testimonies.new')}</Link>} />
      <div className="space-y-2 border-b px-4 py-3">
        <p className="text-sm text-muted-foreground">{t('testimonies.lead')}</p>
        <SearchForm action="/testimonies" q={q} placeholder={t('testimonies.searchPh')} />
      </div>
      {list.items.length === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{t('testimonies.none')}</p>
        : list.items.map((x) => <TestimonyCard key={x.id} x={x} signedIn={!!me} isAdmin={me?.role === 'tech_admin'} />)}
      <PagerLinks base="/testimonies" params={{ q }} page={list.page} hasMore={list.hasMore} labels={{ prev: t('announcements.prev'), next: t('announcements.next') }} />
    </>
  )
}
