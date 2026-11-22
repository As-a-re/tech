import { notFound } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { LevelAnnouncements } from '@/components/community/level-page'

export const metadata = { title: 'Assembly announcements' }

export default async function AssemblyAnnouncements({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const { data: a, error } = await createSupabaseAdminClient().from('assemblies').select('id,name,districts!inner(name)').eq('slug', slug).maybeSingle()
  if (error) throw new Error(`Unable to load assembly: ${error.message}`)
  if (!a) notFound()
  const district = Array.isArray(a.districts) ? a.districts[0] : a.districts
  return <LevelAnnouncements scope={{ level: 'local', assemblyId: a.id }} name={a.name} sub={district.name} base={`/announcements/a/${slug}`} page={Number(sp.page) || 1} directoryHref={`/assemblies/${slug}`} />
}
