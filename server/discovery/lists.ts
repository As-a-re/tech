import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { FeedPage } from '@/lib/posts/types'
import { countViews, hydrate } from '@/server/posts/hydrate'
import { decodeCursor, encodeCursor } from '@/server/posts/visibility'
const sb = () => createSupabaseAdminClient()
export type ListInput = { name: string; description: string; isPrivate: boolean }
export type ListResult = { ok: true; id: string; error?: never } | { ok: false; error: 'name_required' | 'name_long' | 'too_many' | 'not_found' }

export async function myLists(ownerId: string) {
  const {data:lists,error} = await sb().from('lists').select('id,name,description,is_private,created_at').eq('owner_id',ownerId).order('name')
  if (error) throw new Error(`Unable to load lists: ${error.message}`)
  const ids = (lists??[]).map((l:any)=>l.id)
  const {data:members,error:memberError} = ids.length ? await sb().from('list_members').select('list_id').in('list_id',ids) : {data:[],error:null} as any
  if (memberError) throw new Error(`Unable to count list members: ${memberError.message}`)
  const counts = new Map<string,number>()
  for (const m of members??[]) counts.set(m.list_id,(counts.get(m.list_id)??0)+1)
  return (lists??[]).map((l:any)=>({id:l.id,name:l.name,description:l.description,isPrivate:l.is_private,members:counts.get(l.id)??0}))
}

export async function getList(id: string, viewerId: string | null) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const {data:list,error} = await sb().from('lists').select('*').eq('id',id).maybeSingle()
  if (error) throw new Error(`Unable to load list: ${error.message}`)
  if (!list || (list.is_private && list.owner_id !== viewerId)) return null
  const [{data:owner,error:ownerError},{count,error:countError}] = await Promise.all([
    sb().from('users').select('username,full_name').eq('id',list.owner_id).maybeSingle(),
    sb().from('list_members').select('user_id',{count:'exact',head:true}).eq('list_id',id),
  ])
  if (ownerError || countError) throw new Error('Unable to load list details')
  return {id:list.id,ownerId:list.owner_id,name:list.name,description:list.description,isPrivate:list.is_private,createdAt:list.created_at,ownerUsername:owner?.username??null,ownerName:owner?.full_name??null,members:count??0}
}

export async function saveList(ownerId: string, input: ListInput, id?: string): Promise<ListResult> {
  const name = input.name.trim()
  if (!name) return {ok:false,error:'name_required'}
  if (name.length>40) return {ok:false,error:'name_long'}
  const values = {name,description:input.description.trim().slice(0,160)||null,is_private:input.isPrivate}
  if (id) {
    const {data,error} = await sb().from('lists').update(values).eq('id',id).eq('owner_id',ownerId).select('id').maybeSingle()
    if (error) throw new Error(`Unable to update list: ${error.message}`)
    return data ? {ok:true,id:data.id} : {ok:false,error:'not_found'}
  }
  const {count,error:countError} = await sb().from('lists').select('id',{count:'exact',head:true}).eq('owner_id',ownerId)
  if (countError) throw new Error(`Unable to count lists: ${countError.message}`)
  if ((count??0)>=100) return {ok:false,error:'too_many'}
  const {data,error} = await sb().from('lists').insert({owner_id:ownerId,...values}).select('id').single()
  if (error) throw new Error(`Unable to create list: ${error.message}`)
  return {ok:true,id:data.id}
}

export async function deleteList(ownerId: string,id: string) {
  const {error} = await sb().from('lists').delete().eq('id',id).eq('owner_id',ownerId)
  if (error) throw new Error(`Unable to delete list: ${error.message}`)
}
export async function setListMember(ownerId: string,listId: string,userId: string,on: boolean) {
  const {data:own,error:ownerError} = await sb().from('lists').select('id').eq('id',listId).eq('owner_id',ownerId).maybeSingle()
  if (ownerError) throw new Error(`Unable to verify list owner: ${ownerError.message}`)
  if (!own) return false
  if (on) {
    const {count,error} = await sb().from('list_members').select('user_id',{count:'exact',head:true}).eq('list_id',listId)
    if (error) throw new Error(`Unable to count list members: ${error.message}`)
    if ((count??0)>=500) return false
    const {error:insertError} = await sb().from('list_members').upsert({list_id:listId,user_id:userId},{onConflict:'list_id,user_id',ignoreDuplicates:true})
    if (insertError) throw new Error(`Unable to add list member: ${insertError.message}`)
  } else {
    const {error} = await sb().from('list_members').delete().eq('list_id',listId).eq('user_id',userId)
    if (error) throw new Error(`Unable to remove list member: ${error.message}`)
  }
  return true
}
export async function listMembersOf(listId: string) {
  const {data:members,error} = await sb().from('list_members').select('user_id,added_at').eq('list_id',listId).order('added_at',{ascending:false})
  if (error) throw new Error(`Unable to list list members: ${error.message}`)
  const ids = (members??[]).map((m:any)=>m.user_id)
  const {data:users,error:userError} = ids.length ? await sb().from('users').select('id,username,full_name,avatar_url,bio,verified_at,assembly_id,assemblies(name)').in('id',ids).eq('status','active') : {data:[],error:null} as any
  if (userError) throw new Error(`Unable to load list member profiles: ${userError.message}`)
  const um = new Map((users??[]).map((u:any)=>[u.id,u]))
  return (members??[]).flatMap((m:any)=>{const u:any=um.get(m.user_id);if(!u)return[];const a=Array.isArray(u.assemblies)?u.assemblies[0]:u.assemblies;return[{id:u.id,username:u.username,fullName:u.full_name,avatarUrl:u.avatar_url,bio:u.bio,assemblyName:a?.name??'',verified:!!u.verified_at,addedAt:m.added_at}]})
}
export async function listFeed(listId: string,viewerId: string|null,cursor?:string|null):Promise<FeedPage>{
  const c=decodeCursor(cursor)
  const {data,error}=await sb().rpc('papa_discovery_feed_ids',{p_mode:'list',p_user_id:viewerId,p_list_id:listId,p_folder_id:null,p_cursor_at:c?.at??null,p_cursor_id:c?.id??null,p_limit:20})
  if(error)throw new Error(`Unable to load list feed: ${error.message}`)
  const rows=(data??[]) as {id:string;at:string;folder_id?:string|null}[]
  const posts=await hydrate(rows.map(x=>x.id),viewerId)
  const items=rows.flatMap(x=>(posts.get(x.id)?[{key:x.id,post:posts.get(x.id)!,repostedBy:null}]:[]))
  await countViews(items.map(i=>i.post.id))
  return {items,next:rows.length===20?encodeCursor(rows[19].at,rows[19].id):null}
}
export async function listsWithMembership(ownerId:string,userId:string){
  const {data:lists,error}=await sb().from('lists').select('id,name,is_private').eq('owner_id',ownerId).order('name')
  if(error)throw new Error(`Unable to load lists: ${error.message}`)
  const ids=(lists??[]).map((l:any)=>l.id)
  const {data:members,error:memberError}=ids.length?await sb().from('list_members').select('list_id').eq('user_id',userId).in('list_id',ids):{data:[],error:null} as any
  if(memberError)throw new Error(`Unable to load list memberships: ${memberError.message}`)
  const has=new Set((members??[]).map((m:any)=>m.list_id))
  return (lists??[]).map((l:any)=>({id:l.id,name:l.name,isPrivate:l.is_private,has:has.has(l.id)}))
}
