import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { FeedPage } from '@/lib/posts/types'
import { hydrate } from '@/server/posts/hydrate'
import { decodeCursor, encodeCursor } from '@/server/posts/visibility'
const sb=()=>createSupabaseAdminClient()
export async function folders(userId:string){
 const {data:folders,error}=await sb().from('bookmark_folders').select('id,name').eq('user_id',userId).order('name')
 if(error)throw new Error(`Unable to load bookmark folders: ${error.message}`)
 const ids=(folders??[]).map((f:any)=>f.id)
 const {data:bookmarks,error:be}=ids.length?await sb().from('bookmarks').select('folder_id').eq('user_id',userId).in('folder_id',ids):{data:[],error:null} as any
 if(be)throw new Error(`Unable to count bookmarks: ${be.message}`)
 const counts=new Map<string,number>();for(const b of bookmarks??[])counts.set(b.folder_id,(counts.get(b.folder_id)??0)+1)
 return (folders??[]).map((f:any)=>({id:f.id,name:f.name,items:counts.get(f.id)??0}))
}
export async function createFolder(userId:string,name:string){
 const n=name.trim().slice(0,40);if(!n)return null
 const {count,error:ce}=await sb().from('bookmark_folders').select('id',{count:'exact',head:true}).eq('user_id',userId)
 if(ce)throw new Error(`Unable to count bookmark folders: ${ce.message}`);if((count??0)>=50)return null
 const {data,error}=await sb().from('bookmark_folders').insert({user_id:userId,name:n}).select('id').single()
 if(error)throw new Error(`Unable to create bookmark folder: ${error.message}`);return data.id
}
export async function renameFolder(userId:string,id:string,name:string){const n=name.trim().slice(0,40);if(!n)return;const {error}=await sb().from('bookmark_folders').update({name:n}).eq('id',id).eq('user_id',userId);if(error)throw new Error(`Unable to rename folder: ${error.message}`)}
export async function deleteFolder(userId:string,id:string){
 const {error:updateError}=await sb().from('bookmarks').update({folder_id:null}).eq('user_id',userId).eq('folder_id',id)
 if(updateError)throw new Error(`Unable to clear bookmark folder: ${updateError.message}`)
 const {error}=await sb().from('bookmark_folders').delete().eq('id',id).eq('user_id',userId)
 if(error)throw new Error(`Unable to delete bookmark folder: ${error.message}`)
}
export async function moveBookmark(userId:string,postId:string,folderId:string|null){
 if(folderId){const {data,error}=await sb().from('bookmark_folders').select('id').eq('id',folderId).eq('user_id',userId).maybeSingle();if(error)throw new Error(`Unable to verify folder: ${error.message}`);if(!data)return false}
 const {data,error}=await sb().from('bookmarks').update({folder_id:folderId}).eq('user_id',userId).eq('post_id',postId).select('post_id')
 if(error)throw new Error(`Unable to move bookmark: ${error.message}`);return (data?.length??0)>0
}
export async function savedFeed(userId:string,folder:string|null,cursor?:string|null):Promise<FeedPage & {folderOf:Record<string,string|null>}>{
 const c=decodeCursor(cursor)
 const {data,error}=await sb().rpc('papa_discovery_feed_ids',{p_mode:'saved',p_user_id:userId,p_list_id:null,p_folder_id:folder,p_cursor_at:c?.at??null,p_cursor_id:c?.id??null,p_limit:20})
 if(error)throw new Error(`Unable to load saved feed: ${error.message}`)
 const rows=(data??[]) as {id:string;at:string;folder_id:string|null}[]
 const posts=await hydrate(rows.map(x=>x.id),userId)
 return {items:rows.flatMap(x=>(posts.get(x.id)?[{key:x.id,post:posts.get(x.id)!,repostedBy:null}]:[])),next:rows.length===20?encodeCursor(rows[19].at,rows[19].id):null,folderOf:Object.fromEntries(rows.map(x=>[x.id,x.folder_id]))}
}
