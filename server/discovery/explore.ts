import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { FeedPage } from '@/lib/posts/types'
import { countViews, hydrate } from '@/server/posts/hydrate'
const sb=()=>createSupabaseAdminClient()
/** Hashtags used most in the last three days, with recent use weighted more heavily. */
export async function trendingTags(viewerId:string|null,limit=8){
 const {data,error}=await sb().rpc('papa_trending_tags',{p_viewer_id:viewerId,p_limit:Math.min(50,Math.max(1,limit))})
 if(error)throw new Error(`Unable to load trending hashtags: ${error.message}`)
 return (data??[]) as {tag:string;posts:number}[]
}
/** Most engaging posts of the last seven days. */
export async function popularPosts(viewerId:string|null,limit=20):Promise<FeedPage>{
 const {data,error}=await sb().rpc('papa_popular_post_ids',{p_viewer_id:viewerId,p_limit:Math.min(100,Math.max(1,limit))})
 if(error)throw new Error(`Unable to load popular posts: ${error.message}`)
 const ids=(data??[]).map((x:any)=>typeof x==='string'?x:x.id)
 const posts=await hydrate(ids,viewerId)
 const items=ids.flatMap((id:string)=>(posts.get(id)?[{key:id,post:posts.get(id)!,repostedBy:null}]:[]))
 await countViews(items.map(i=>i.post.id))
 return {items,next:null}
}
export type Suggestion={id:string;username:string;fullName:string;avatarUrl:string|null;verified:boolean;bio:string|null;assemblyName:string;reason:'assembly'|'district'|'popular'}
/** People to follow, ranked by church proximity and then follower count. */
export async function whoToFollow(viewerId:string|null,limit=5):Promise<Suggestion[]>{
 const {data,error}=await sb().rpc('papa_who_to_follow',{p_viewer_id:viewerId,p_limit:Math.min(50,Math.max(1,limit))})
 if(error)throw new Error(`Unable to load people suggestions: ${error.message}`)
 return (data??[]).map((x:any)=>({id:x.id,username:x.username,fullName:x.full_name,avatarUrl:x.avatar_url,verified:x.verified,bio:x.bio,assemblyName:x.assembly_name,reason:x.reason}))
}
