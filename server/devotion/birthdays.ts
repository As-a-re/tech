import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { notify } from '@/server/notifications/notify'

export type CelebrationRange = 'today' | 'week' | 'month'
export type CelebrationScope = 'assembly' | 'following' | 'all'
export type Celebrant = { id: string; username: string; fullName: string; avatarUrl: string | null; verified: boolean; assemblyName: string; monthDay: string; isToday: boolean; kind: 'birthday' | 'anniversary' }
const sb = () => createSupabaseAdminClient()
export function monthDays(range: CelebrationRange, now = new Date()) {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const md = (ms: number) => new Date(ms).toISOString().slice(5, 10)
  if (range === 'today') return [md(start)]
  if (range === 'week') return Array.from({length:7},(_,i)=>md(start+i*864e5))
  const days = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 0)).getUTCDate()
  return Array.from({length:days},(_,i)=>`${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`)
}
const monthDay = (value: string | null, leap: boolean) => {
  if (!value) return null
  const md = value.length >= 10 ? value.slice(5,10) : value.slice(0,5)
  return !leap && md === '02-29' ? '02-28' : md
}

export async function celebrations(viewer: {id:string; assemblyId:string}, range: CelebrationRange, scope: CelebrationScope, now = new Date()): Promise<Celebrant[]> {
  const days = monthDays(range, now), daySet = new Set(days)
  const leap = new Date(Date.UTC(now.getUTCFullYear(),1,29)).getUTCMonth() === 1
  const {data: users, error} = await sb().from('users').select('id,username,full_name,avatar_url,verified_at,assembly_id,anniversary,church_id,assemblies(name,district_id),church_members!inner(active,date_of_birth),user_preferences(show_birthday)').eq('status','active').eq('church_members.active',true).limit(3000)
  if (error) throw new Error(`Unable to load celebrations: ${error.message}`)
  let rows = users ?? []
  if (scope === 'assembly') rows = rows.filter((u:any)=>u.assembly_id === viewer.assemblyId)
  if (scope === 'following') {
    const {data:follows,error:e} = await sb().from('follows').select('followee_id').eq('follower_id',viewer.id)
    if (e) throw new Error(`Unable to load followed members: ${e.message}`)
    const ids = new Set((follows??[]).map((f:any)=>f.followee_id)); rows = rows.filter((u:any)=>ids.has(u.id))
  }
  const ids = rows.map((u:any)=>u.id)
  const {data:blocks,error:blockError} = ids.length ? await sb().from('blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${viewer.id},blocked_id.eq.${viewer.id}`) : {data:[],error:null} as any
  if (blockError) throw new Error(`Unable to load block relationships: ${blockError.message}`)
  const hidden = new Set((blocks??[]).map((b:any)=>b.blocker_id === viewer.id ? b.blocked_id : b.blocker_id))
  const result: Celebrant[] = []
  for (const u of rows as any[]) {
    if (u.id === viewer.id || hidden.has(u.id)) continue
    const prefs = Array.isArray(u.user_preferences) ? u.user_preferences[0] : u.user_preferences
    const cm = Array.isArray(u.church_members) ? u.church_members[0] : u.church_members
    const assembly = Array.isArray(u.assemblies) ? u.assemblies[0] : u.assemblies
    const base = {id:u.id,username:u.username,fullName:u.full_name,avatarUrl:u.avatar_url,verified:!!u.verified_at,assemblyName:assembly?.name ?? ''}
    if (cm?.date_of_birth && prefs?.show_birthday !== false) {
      const md = monthDay(cm.date_of_birth, leap)
      if (md && daySet.has(md)) result.push({...base,monthDay:md,isToday:md===monthDays('today',now)[0],kind:'birthday'})
    }
    const anniversary = monthDay(u.anniversary, leap)
    if (anniversary && daySet.has(anniversary)) result.push({...base,monthDay:anniversary,isToday:anniversary===monthDays('today',now)[0],kind:'anniversary'})
  }
  const order = new Map(days.map((d,i)=>[d,i]))
  return result.sort((a,b)=>(order.get(a.monthDay)!-order.get(b.monthDay)!) || a.fullName.localeCompare(b.fullName)).slice(0,500)
}

export async function sendBirthdayNotifications(now = new Date()) {
  if (now.getUTCHours() < 6) return 0
  const day = now.toISOString().slice(0,10)
  const {error:claimError} = await sb().from('job_runs').insert({job:'birthdays',day})
  if (claimError?.code === '23505') return 0
  if (claimError) throw new Error(`Unable to claim birthday job: ${claimError.message}`)
  const md = monthDays('today',now)[0], leap = new Date(Date.UTC(now.getUTCFullYear(),1,29)).getUTCMonth()===1
  const {data:members,error} = await sb().from('church_members').select('church_id,date_of_birth,active').eq('active',true).not('date_of_birth','is',null)
  if (error) throw new Error(`Unable to load birthday register: ${error.message}`)
  const churchIds = (members??[]).filter((m:any)=>monthDay(m.date_of_birth,leap)===md).map((m:any)=>m.church_id)
  if (!churchIds.length) return 0
  const {data:celebrants,error:usersError} = await sb().from('users').select('id,church_id,user_preferences(show_birthday)').eq('status','active').in('church_id',churchIds)
  if (usersError) throw new Error(`Unable to load birthday users: ${usersError.message}`)
  let sent = 0
  for (const person of celebrants ?? []) {
    const pref = Array.isArray(person.user_preferences) ? person.user_preferences[0] : person.user_preferences
    if (pref?.show_birthday === false) continue
    const {data:follows,error:followError} = await sb().from('follows').select('follower_id').eq('followee_id',person.id)
    if (followError) throw new Error(`Unable to load birthday followers: ${followError.message}`)
    for (const f of follows ?? []) { await notify(f.follower_id,'birthday',person.id).catch(()=>{}); sent++ }
  }
  return sent
}
