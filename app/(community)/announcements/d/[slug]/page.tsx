import { notFound } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import { LevelAnnouncements } from '@/components/community/level-page'

export const metadata = { title: 'District announcements' }

export default async function DistrictAnnouncements({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const [{ slug }, sp, t] = await Promise.all([params, searchParams, getT()])
  const { data: d, error } = await createSupabaseAdminClient().from('districts').select('id,name').eq('slug', slug).maybeSingle()
  if (error) throw new Error(`Unable to load district: ${error.message}`)
  if (!d) notFound()
  return <LevelAnnouncements scope={{ level: 'district', districtId: d.id }} name={d.name} sub={t('levels.district')} base={`/announcements/d/${slug}`} page={Number(sp.page) || 1} directoryHref={`/districts/${slug}`} />
}
