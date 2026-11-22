import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/server/identity/session'
import { myRider } from '@/server/market/riders'
import { RiderNav } from '@/components/market/rider-nav'

/** Rider area: tabs once the member is an approved rider. */
export default async function RideLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser()
  const r = me ? await myRider(me.id) : null
  if (!r || r.status === 'pending' || r.status === 'rejected') return <>{children}</>
  const { count, error } = await createSupabaseAdminClient().from('deliveries').select('id', { count: 'exact', head: true }).eq('rider_id', r.id).in('status', ['accepted', 'picked_up'])
  if (error) throw new Error(`Unable to load rider active deliveries: ${error.message}`)
  const c = { n: count ?? 0 }
  return <><RiderNav active={c.n} />{children}</>
}
