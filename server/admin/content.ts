import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const PAGE = 30
const sb = () => createSupabaseAdminClient()
type ContentKind = 'announcements' | 'events' | 'prayers' | 'testimonies' | 'publications' | 'kids' | 'live' | 'resources'

/** Announcement, event, devotion and library oversight for Tech Admins. */
export async function listContent(kind: ContentKind, q: string | undefined, page = 1) {
  const term = q?.trim() || ''
  const table = ({ announcements: 'announcements', events: 'events', prayers: 'prayer_requests', testimonies: 'testimonies',
    publications: 'publications', kids: 'kids_items', live: 'lives', resources: 'resources' } as const)[kind]
  const start = Math.max(0, page - 1) * PAGE
  let query = sb().from(table).select('*').is('deleted_at', null).order('created_at', { ascending: false }).range(start, start + PAGE)
  if (term) query = query.ilike(kind === 'prayers' ? 'body' : 'title', `%${term.replace(/[%_\\]/g, '\\$&')}%`)
  const { data, error } = await query
  if (error) throw new Error(`Unable to list ${kind}: ${error.message}`)
  const raw = data ?? []
  const authorIds = [...new Set(raw.map((r: any) => r.author_id ?? r.created_by).filter(Boolean))]
  const assemblyIds = [...new Set(raw.map((r: any) => r.assembly_id).filter(Boolean))]
  const districtIds = [...new Set(raw.map((r: any) => r.district_id).filter(Boolean))]
  const [users, assemblies, districts] = await Promise.all([
    authorIds.length ? sb().from('users').select('id,username').in('id', authorIds) : Promise.resolve({data:[],error:null} as any),
    assemblyIds.length ? sb().from('assemblies').select('id,name').in('id', assemblyIds) : Promise.resolve({data:[],error:null} as any),
    districtIds.length ? sb().from('districts').select('id,name').in('id', districtIds) : Promise.resolve({data:[],error:null} as any),
  ])
  if (users.error || assemblies.error || districts.error) throw new Error('Unable to load content author or church details')
  const um = new Map((users.data ?? []).map((x:any) => [x.id, x.username]))
  const am = new Map((assemblies.data ?? []).map((x:any) => [x.id, x.name]))
  const dm = new Map((districts.data ?? []).map((x:any) => [x.id, x.name]))
  const rows = raw.slice(0, PAGE).map((r:any) => ({
    id: r.id, title: kind === 'prayers' ? String(r.body ?? '').slice(0, 140) : r.title ?? '',
    level: r.level ?? 'national', createdAt: r.created_at, username: um.get(r.author_id ?? r.created_by) ?? '—',
    where: (r.assembly_id ? am.get(r.assembly_id) : null) ?? (r.district_id ? dm.get(r.district_id) : null) ?? null,
    startsAt: kind === 'events' ? r.starts_at : null, reports: 0,
  }))
  // Report counts are deliberately queried by known target columns; table rows remain paginated.
  if (['announcements', 'events', 'prayers', 'testimonies'].includes(kind)) {
    const col = ({announcements:'announcement_id', events:'event_id', prayers:'prayer_id', testimonies:'testimony_id'} as Record<string,string>)[kind]
    for (const row of rows) {
      const { count, error: countError } = await sb().from('reports').select('id', {count:'exact', head:true}).eq('status','open').eq(col, row.id)
      if (countError) throw new Error(`Unable to count reports: ${countError.message}`)
      row.reports = count ?? 0
    }
  }
  return { rows, page, hasMore: raw.length > PAGE }
}

export async function contentStats() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString()
  const now = new Date().toISOString()
  const [announcements, events] = await Promise.all([
    sb().from('announcements').select('id', {count:'exact', head:true}).is('deleted_at', null).gt('created_at', since),
    sb().from('events').select('id', {count:'exact', head:true}).is('deleted_at', null).is('cancelled_at', null).gt('starts_at', now),
  ])
  if (announcements.error || events.error) throw new Error('Unable to load content statistics')
  return { announcements: announcements.count ?? 0, events: events.count ?? 0 }
}
