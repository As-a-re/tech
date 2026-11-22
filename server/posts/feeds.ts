import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { FeedItem, FeedPage, PostView } from '@/lib/posts/types'
import { countViews, hydrate } from './hydrate'
import { decodeCursor, encodeCursor } from './visibility'
export const PAGE=20
type Entry={post_id:string;at:string|Date;reposter_username:string|null;reposter_name:string|null}
const sb=()=>createSupabaseAdminClient()
async function build(entries:Entry[],viewerId:string|null,pageFull:boolean,cursorOf:(e:Entry)=>string|null):Promise<FeedPage>{
 const seen=new Set<string>();const kept=entries.filter(e=>seen.has(e.post_id)?false:(seen.add(e.post_id),true))
 const posts=await hydrate(kept.map(e=>e.post_id),viewerId)
 const items:FeedItem[]=kept.flatMap(e=>{const post=posts.get(e.post_id);return post?[{key:`${e.post_id}:${e.reposter_username??''}`,post,repostedBy:e.reposter_username?{username:e.reposter_username,fullName:e.reposter_name!}:null}]:[]})
 await countViews(items.map(i=>i.post.id));return {items,next:pageFull&&entries.length?cursorOf(entries[entries.length-1]):null}
}
async function entries(mode:string,viewerId:string|null,options:{authorId?:string;postId?:string;tag?:string;cursor?:string|null;page?:number;limit?:number}={}){
 const c=decodeCursor(options.cursor)
 const {data,error}=await sb().rpc('papa_post_feed_entries',{p_mode:mode,p_viewer_id:viewerId,p_author_id:options.authorId??null,p_post_id:options.postId??null,p_tag:options.tag??null,p_cursor_at:c?.at??null,p_cursor_id:c?.id??null,p_page:options.page??0,p_limit:options.limit??PAGE})
 if(error)throw new Error(`Unable to load ${mode} feed: ${error.message}`)
 return (data??[]) as Entry[]
}
export async function forYou(viewerId:string|null,page=0):Promise<FeedPage>{const r=await entries('for_you',viewerId,{page,limit:PAGE});return build(r,viewerId,r.length===PAGE,()=>String(page+1))}
export async function following(viewerId:string,cursor?:string|null):Promise<FeedPage>{const r=await entries('following',viewerId,{cursor});return build(r,viewerId,r.length===PAGE,e=>encodeCursor(e.at,e.post_id))}
export async function favoritesFeed(viewerId:string,cursor?:string|null):Promise<FeedPage>{const r=await entries('favorites',viewerId,{cursor});return build(r,viewerId,r.length===PAGE,e=>encodeCursor(e.at,e.post_id))}
export type ProfileTab='posts'|'replies'|'media'|'likes'
export async function profileFeed(authorId:string,tab:ProfileTab,viewerId:string|null,cursor?:string|null):Promise<FeedPage>{if(tab==='likes'&&viewerId!==authorId)return{items:[],next:null};const r=await entries(`profile_${tab}`,viewerId,{authorId,cursor});return build(r,viewerId,r.length===PAGE,e=>encodeCursor(e.at,e.post_id))}
export async function pinnedPost(authorId:string,viewerId:string|null):Promise<PostView|null>{
 const {data,error}=await sb().from('pinned_posts').select('post_id').eq('user_id',authorId).maybeSingle()
 if(error)throw new Error(`Unable to load pinned post: ${error.message}`);if(!data)return null
 return (await hydrate([data.post_id],viewerId)).get(data.post_id)??null
}
export async function hashtagFeed(tag:string,viewerId:string|null,cursor?:string|null):Promise<FeedPage>{const r=await entries('hashtag',viewerId,{tag:tag.toLowerCase(),cursor});return build(r,viewerId,r.length===PAGE,e=>encodeCursor(e.at,e.post_id))}
export async function bookmarksFeed(viewerId:string,cursor?:string|null):Promise<FeedPage>{const r=await entries('bookmarks',viewerId,{cursor});return build(r,viewerId,r.length===PAGE,e=>encodeCursor(e.at,e.post_id))}
export async function thread(postId:string,viewerId:string|null){
 const main=(await hydrate([postId],viewerId,{includeDeleted:true})).get(postId);if(!main)return null
 const chain:string[]=[];let parent=main.replyToId
 for(let i=0;parent&&i<30;i++){chain.unshift(parent);const {data,error}=await sb().from('posts').select('reply_to_id').eq('id',parent).maybeSingle();if(error)throw new Error(`Unable to load thread ancestors: ${error.message}`);parent=data?.reply_to_id??null}
 const above=await hydrate(chain,viewerId,{includeDeleted:true});const replyIds=await entries('thread_replies',viewerId,{postId,limit:200})
 // Reply ranking is intentionally kept as returned by the RPC; hydration preserves post visibility.
 const replies=await hydrate(replyIds.map(r=>r.post_id),viewerId);await countViews([postId])
 return {ancestors:chain.flatMap(id=>above.get(id)?[above.get(id)!]:[]),post:main,replies:replyIds.flatMap(r=>replies.get(r.post_id)?[replies.get(r.post_id)!]:[])}
}
export async function engagers(postId:string,kind:'likes'|'reposts',viewerId:string|null){
 const {data,error}=await sb().rpc('papa_post_engagers',{p_post_id:postId,p_kind:kind,p_viewer_id:viewerId})
 if(error)throw new Error(`Unable to load post ${kind}: ${error.message}`)
 return data??[]
}
