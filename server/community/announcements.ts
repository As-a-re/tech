import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { hit } from '@/server/identity/rate-limit'
import { containsBannedWord } from '@/server/posts/compose'
import { notifyScope, scopeForMember, scopeKey, type Level, type Scope } from './levels'
export const ANNOUNCEMENT_TITLE_MAX=120
export const ANNOUNCEMENT_BODY_MAX=3000
const OWN_IMAGE=/^\/media\/posts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|gif)$/i
export const isOwnImage=(url:string,userId:string)=>OWN_IMAGE.test(url)&&url.includes(`/posts/${userId}/`)
export type ImageInput={url:string;alt?:string|null;width?:number|null;height?:number|null}
export type AnnouncementInput={level:Level;title:string;body:string;important?:boolean;media?:ImageInput[]}
export type AnnouncementError='title'|'body'|'media_invalid'|'media_count'|'banned_words'|'rate_limited'|'not_found'|'level'
export type AnnouncementResult={ok:true;id:string;error?:never}|{ok:false;error:AnnouncementError}
export type AnnouncementView={id:string;title:string;body:string;important:boolean;level:Level;district:{id:string;name:string;slug:string}|null;assembly:{id:string;name:string;slug:string}|null;author:{id:string;username:string;fullName:string;avatarUrl:string|null;verified:boolean};media:{url:string;alt:string|null;width:number|null;height:number|null}[];createdAt:string;editedAt:string|null;viewCount:number;viewer:{isAuthor:boolean}}
const sb=()=>createSupabaseAdminClient()
function check(input:{title:string;body:string;media?:ImageInput[]},authorId:string):AnnouncementError|null{const title=input.title.trim(),body=input.body.trim();if(title.length<3||title.length>ANNOUNCEMENT_TITLE_MAX)return'title';if(!body||body.length>ANNOUNCEMENT_BODY_MAX)return'body';const media=input.media??[];if(media.length>4)return'media_count';if(media.some(m=>!isOwnImage(m.url,authorId)))return'media_invalid';return null}
const mediaPayload=(media:ImageInput[]|undefined)=> (media??[]).map((m,i)=>({url:m.url,alt:m.alt?.slice(0,500)||null,width:m.width??null,height:m.height??null,position:i}))
export async function createAnnouncement(authorId:string,input:AnnouncementInput):Promise<AnnouncementResult>{
 const bad=check(input,authorId);if(bad)return{ok:false,error:bad};const scope=await scopeForMember(authorId,input.level);if(!scope)return{ok:false,error:'level'}
 if(await containsBannedWord(`${input.title} ${input.body}`))return{ok:false,error:'banned_words'};if(!(await hit(`announce:${authorId}`,10,3600)))return{ok:false,error:'rate_limited'}
 const cols={level:scope.level,districtId:scope.level==='district'?scope.districtId:null,assemblyId:scope.level==='local'?scope.assemblyId:null}
 const{data,error}=await sb().rpc('papa_create_announcement',{p_author_id:authorId,p_level:cols.level,p_district_id:cols.districtId,p_assembly_id:cols.assemblyId,p_title:input.title.trim(),p_body:input.body.trim(),p_important:!!input.important,p_media:mediaPayload(input.media)})
 if(error)throw new Error(`Unable to create announcement: ${error.message}`);const id=data as string
 await notifyScope(scopeKey(scope),'announcement',authorId,{announcementId:id}).catch(e=>console.error('notify failed',e));return{ok:true,id}
}
export async function editAnnouncement(authorId:string,id:string,input:Omit<AnnouncementInput,'level'>):Promise<AnnouncementResult>{
 const{data:existing,error:readError}=await sb().from('announcements').select('id').eq('id',id).eq('author_id',authorId).is('deleted_at',null).maybeSingle()
 if(readError)throw new Error(`Unable to load announcement: ${readError.message}`);if(!existing)return{ok:false,error:'not_found'}
 const bad=check(input,authorId);if(bad)return{ok:false,error:bad};if(await containsBannedWord(`${input.title} ${input.body}`))return{ok:false,error:'banned_words'}
 const{data,error}=await sb().rpc('papa_edit_announcement',{p_author_id:authorId,p_id:id,p_title:input.title.trim(),p_body:input.body.trim(),p_important:!!input.important,p_media:mediaPayload(input.media)})
 if(error)throw new Error(`Unable to edit announcement: ${error.message}`);return data?{ok:true,id}:{ok:false,error:'not_found'}
}
export async function deleteAnnouncement(userId:string,id:string,asAdmin=false){const{data,error}=await sb().rpc('papa_delete_announcement',{p_user_id:userId,p_id:id,p_as_admin:asAdmin});if(error)throw new Error(`Unable to delete announcement: ${error.message}`);return data===true}
async function hydrate(ids:string[],viewerId:string|null):Promise<AnnouncementView[]>{
 if(!ids.length)return[];const{data:rows,error}=await sb().from('announcements').select('*').in('id',ids);if(error)throw new Error(`Unable to load announcements: ${error.message}`)
 const authorIds=[...new Set((rows??[]).map((r:any)=>r.author_id))],assemblyIds=[...new Set((rows??[]).map((r:any)=>r.assembly_id).filter(Boolean))],districtIds=[...new Set((rows??[]).map((r:any)=>r.district_id).filter(Boolean))]
 const[users,assemblies,districts,media]=await Promise.all([
  sb().from('users').select('id,username,full_name,avatar_url,verified_at').in('id',authorIds),
  assemblyIds.length?sb().from('assemblies').select('id,name,slug,district_id').in('id',assemblyIds):Promise.resolve({data:[],error:null} as any),
  districtIds.length?sb().from('districts').select('id,name,slug').in('id',districtIds):Promise.resolve({data:[],error:null} as any),
  sb().from('announcement_media').select('announcement_id,url,alt,width,height,position').in('announcement_id',ids).order('position'),
 ])
 if(users.error||assemblies.error||districts.error||media.error)throw new Error('Unable to load announcement details')
 const um=new Map((users.data??[]).map((u:any)=>[u.id,u])),am=new Map((assemblies.data??[]).map((a:any)=>[a.id,a])),dm=new Map((districts.data??[]).map((d:any)=>[d.id,d]))
 const byId=new Map((rows??[]).map((r:any)=>[r.id,r]))
 return ids.flatMap(id=>{const r:any=byId.get(id),u:any=r&&um.get(r.author_id);if(!r||!u)return[];const a:any=r.assembly_id?am.get(r.assembly_id):null;const d:any=(r.district_id?dm.get(r.district_id):null)||(a?.district_id?dm.get(a.district_id):null);return[{id,title:r.title,body:r.body,important:r.important,level:r.level,district:d&&r.level!=='national'?{id:d.id,name:d.name,slug:d.slug}:null,assembly:a?{id:a.id,name:a.name,slug:a.slug}:null,author:{id:u.id,username:u.username,fullName:u.full_name,avatarUrl:u.avatar_url,verified:!!u.verified_at},media:(media.data??[]).filter((m:any)=>m.announcement_id===id).map((m:any)=>({url:m.url,alt:m.alt,width:m.width,height:m.height})),createdAt:new Date(r.created_at).toISOString(),editedAt:r.edited_at?new Date(r.edited_at).toISOString():null,viewCount:r.view_count,viewer:{isAuthor:viewerId===r.author_id}}]})
}
export async function getAnnouncement(id:string,viewerId:string|null,countView=false){if(!/^[0-9a-f-]{36}$/i.test(id))return null;const{data,error}=await sb().from('announcements').select('id').eq('id',id).is('deleted_at',null).maybeSingle();if(error)throw new Error(`Unable to find announcement: ${error.message}`);if(!data)return null;if(countView){const{error:e}=await sb().rpc('papa_increment_announcement_view',{p_id:id});if(e)throw new Error(`Unable to count announcement view: ${e.message}`)}return(await hydrate([id],viewerId))[0]??null}
export const PAGE_SIZE=20
export async function listAnnouncements(opts:{scope?:Scope;authorId?:string;q?:string;page?:number;viewerId:string|null;keys?:string[]}){
 const page=Math.max(1,opts.page??1),scope=opts.scope;const{data,error}=await sb().rpc('papa_list_announcement_ids',{p_level:scope?.level??null,p_district_id:scope?.level==='district'?scope.districtId:null,p_assembly_id:scope?.level==='local'?scope.assemblyId:null,p_author_id:opts.authorId??null,p_query:opts.q?.trim()||null,p_keys:opts.keys??null,p_page:page,p_page_size:PAGE_SIZE})
 if(error)throw new Error(`Unable to list announcements: ${error.message}`);const rows=(data??[]) as {id:string}[];const items=await hydrate(rows.slice(0,PAGE_SIZE).map(r=>r.id),opts.viewerId);return{items,page,hasMore:rows.length>PAGE_SIZE}
}
export async function markAnnouncementsSeen(userId:string,id?:string){let q=sb().from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',userId).is('read_at',null).eq('type','announcement');if(id)q=q.eq('announcement_id',id);const{error}=await q;if(error)throw new Error(`Unable to mark announcements read: ${error.message}`)}
export async function unreadAnnouncements(userId:string){const{count,error}=await sb().from('notifications').select('id',{count:'exact',head:true}).eq('user_id',userId).is('read_at',null).eq('type','announcement');if(error)throw new Error(`Unable to count unread announcements: ${error.message}`);return count??0}
