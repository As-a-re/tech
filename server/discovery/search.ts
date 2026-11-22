import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { FeedPage } from '@/lib/posts/types'
import { countViews, hydrate } from '@/server/posts/hydrate'

const sb = () => createSupabaseAdminClient()
const likeOf = (q: string) => `%${q.trim().replace(/[%_\\]/g, '\\$&')}%`
const tsq = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 8).map((w) => `${w}:*`).join(' & ')

export async function searchPeople(q: string, viewerId: string | null, limit = 20) {
  if (q.trim().length < 2) return []
  const term = q.trim().replace(/^@/, '')
  const {data,error} = await sb().from('users').select('id,username,full_name,avatar_url,bio,verified_at,assembly_id,assemblies(name),user_preferences(visible_to_guests)').eq('status','active')
    .or(`full_name.ilike.${likeOf(term)},username.ilike.${likeOf(term)}`).limit(Math.min(100,Math.max(limit*3,limit)))
  if (error) throw new Error(`Unable to search people: ${error.message}`)
  let rows = data ?? []
  if (!viewerId) rows = rows.filter((u:any)=>{
    const p = Array.isArray(u.user_preferences)?u.user_preferences[0]:u.user_preferences
    return p?.visible_to_guests !== false
  })
  if (viewerId && rows.length) {
    const ids = rows.map((u:any)=>u.id)
    const {data:blocks,error:be} = await sb().from('blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`)
    if (be) throw new Error(`Unable to filter blocked people: ${be.message}`)
    const blocked = new Set((blocks??[]).map((b:any)=>b.blocker_id===viewerId?b.blocked_id:b.blocker_id))
    rows = rows.filter((u:any)=>!blocked.has(u.id) && u.id!==viewerId && ids.includes(u.id))
  }
  const ids = rows.map((u:any)=>u.id)
  const counts = ids.length ? await sb().from('follows').select('followee_id').in('followee_id',ids) : {data:[],error:null} as any
  if (counts.error) throw new Error(`Unable to rank people search results: ${counts.error.message}`)
  const countMap = new Map<string,number>()
  for (const f of counts.data??[]) countMap.set(f.followee_id,(countMap.get(f.followee_id)??0)+1)
  return rows.map((u:any)=>{
    const a = Array.isArray(u.assemblies)?u.assemblies[0]:u.assemblies
    return {id:u.id,username:u.username,full_name:u.full_name,avatar_url:u.avatar_url,bio:u.bio,assembly_name:a?.name??'',verified:!!u.verified_at,_rank:(u.username.toLowerCase()===term.toLowerCase()?100000:0)+(u.full_name.toLowerCase().startsWith(term.toLowerCase())?10000:0)+(countMap.get(u.id)??0)}
  }).sort((a:any,b:any)=>b._rank-a._rank).slice(0,limit).map(({_rank,...u}:any)=>u)
}

export async function searchPosts(q: string, viewerId: string | null, opts: { media?: boolean; top?: boolean; limit?: number } = {}): Promise<FeedPage> {
  const query = tsq(q)
  if (!query) return {items:[],next:null}
  const {data,error} = await sb().rpc('papa_search_post_ids',{p_query:query,p_viewer_id:viewerId,p_media_only:!!opts.media,p_top:!!opts.top,p_limit:Math.min(100,Math.max(1,opts.limit??30))})
  if (error) throw new Error(`Unable to search posts: ${error.message}`)
  const ids = (data??[]).map((x:any)=>typeof x==='string'?x:x.id).filter(Boolean)
  const posts = await hydrate(ids,viewerId)
  const items = ids.flatMap((id:string)=>(posts.get(id)?[{key:id,post:posts.get(id)!,repostedBy:null}]:[]))
  await countViews(items.map(i=>i.post.id))
  return {items,next:null}
}

export async function searchHashtags(q: string, limit = 20) {
  const term = q.trim().replace(/^#/,'').toLowerCase()
  if (!term) return []
  const {data:tags,error} = await sb().from('post_hashtags').select('tag,post_id').ilike('tag',`${term.replace(/[%_\\]/g,'\\$&')}%`).limit(2000)
  if (error) throw new Error(`Unable to search hashtags: ${error.message}`)
  const ids = [...new Set((tags??[]).map((x:any)=>x.post_id))]
  const {data:posts,error:postError} = ids.length ? await sb().from('posts').select('id').in('id',ids).is('deleted_at',null).not('published_at','is',null).lte('published_at',new Date().toISOString()) : {data:[],error:null} as any
  if (postError) throw new Error(`Unable to count hashtag posts: ${postError.message}`)
  const valid = new Set((posts??[]).map((p:any)=>p.id)), counts = new Map<string,number>()
  for (const t of tags??[]) if (valid.has(t.post_id)) counts.set(t.tag,(counts.get(t.tag)??0)+1)
  return [...counts.entries()].map(([tag,posts])=>({tag,posts})).sort((a,b)=>b.posts-a.posts).slice(0,limit)
}

export async function searchAssemblies(q: string, limit = 20) {
  if (q.trim().length < 2) return []
  const term = likeOf(q)
  const {data,error} = await sb().from('assemblies').select('id,name,slug,town,district_id,districts(name)').or(`name.ilike.${term},town.ilike.${term}`).limit(Math.min(100,limit*3))
  if (error) throw new Error(`Unable to search assemblies: ${error.message}`)
  const ids = (data??[]).map((a:any)=>a.id)
  const {data:users,error:userError} = ids.length ? await sb().from('users').select('assembly_id').eq('status','active').in('assembly_id',ids) : {data:[],error:null} as any
  if (userError) throw new Error(`Unable to count assembly members: ${userError.message}`)
  const counts = new Map<string,number>()
  for (const u of users??[]) counts.set(u.assembly_id,(counts.get(u.assembly_id)??0)+1)
  return (data??[]).map((a:any)=>{const d=Array.isArray(a.districts)?a.districts[0]:a.districts;return {id:a.id,name:a.name,slug:a.slug,town:a.town,district_name:d?.name??'',members:counts.get(a.id)??0}}).sort((a:any,b:any)=>a.name.localeCompare(b.name)).slice(0,limit)
}
