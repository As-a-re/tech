import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import { sendPush } from '@/integrations/push'
import { publish } from '@/server/notifications/realtime'
import { pushText, type NotificationType } from '@/server/notifications/notify'
export type Level='national'|'district'|'local'
export type Scope={level:'national'}|{level:'district';districtId:string}|{level:'local';assemblyId:string}
export type ScopeInfo={level:Level;key:string;name:string;districtId:string|null;districtName:string|null;districtSlug:string|null;assemblyId:string|null;assemblyName:string|null;assemblySlug:string|null}
const sb=()=>createSupabaseAdminClient()
export const scopeKey=(s:Scope)=>(s.level==='national'?'national':s.level==='district'?`d:${s.districtId}`:`a:${s.assemblyId}`)
const UUID=/^[0-9a-f-]{36}$/i
export function parseScopeKey(k:string):Scope|null{if(k==='national')return{level:'national'};const[p,id]=k.split(':');if(!id||!UUID.test(id))return null;return p==='d'?{level:'district',districtId:id}:p==='a'?{level:'local',assemblyId:id}:null}
export async function describeScope(s:Scope):Promise<ScopeInfo|null>{
 if(s.level==='national')return{level:'national',key:'national',name:'National',districtId:null,districtName:null,districtSlug:null,assemblyId:null,assemblyName:null,assemblySlug:null}
 if(s.level==='district'){const{data:d,error}=await sb().from('districts').select('id,name,slug').eq('id',s.districtId).maybeSingle();if(error)throw new Error(`Unable to load district: ${error.message}`);return d?{level:'district',key:scopeKey(s),name:d.name,districtId:d.id,districtName:d.name,districtSlug:d.slug,assemblyId:null,assemblyName:null,assemblySlug:null}:null}
 const{data:a,error}=await sb().from('assemblies').select('id,name,slug,district_id,districts(id,name,slug)').eq('id',s.assemblyId).maybeSingle();if(error)throw new Error(`Unable to load assembly: ${error.message}`);if(!a)return null;const d=Array.isArray(a.districts)?a.districts[0]:a.districts;return{level:'local',key:scopeKey(s),name:a.name,districtId:d?.id??null,districtName:d?.name??null,districtSlug:d?.slug??null,assemblyId:a.id,assemblyName:a.name,assemblySlug:a.slug}
}
export async function homeScopes(userId:string){const{data:u,error}=await sb().from('users').select('assembly_id,assemblies(district_id)').eq('id',userId).maybeSingle();if(error)throw new Error(`Unable to load member scope: ${error.message}`);if(!u?.assembly_id)return null;const a=Array.isArray(u.assemblies)?u.assemblies[0]:u.assemblies;return a?{assemblyId:u.assembly_id,districtId:a.district_id}:null}
export async function scopeForMember(userId:string,level:Level):Promise<Scope|null>{const home=await homeScopes(userId);if(!home)return null;if(level==='national')return{level:'national'};if(level==='district')return{level:'district',districtId:home.districtId};return{level:'local',assemblyId:home.assemblyId}}
export const scopeColumns=(s:Scope)=>({level:s.level,districtId:s.level==='district'?s.districtId:null,assemblyId:s.level==='local'?s.assemblyId:null})
async function defaultSubscribed(userId:string,key:string){
 const scope=parseScopeKey(key);if(!scope||scope.level==='national')return true
 const home=await homeScopes(userId);if(!home)return false
 return scope.level==='district'?home.districtId===scope.districtId:home.assemblyId===scope.assemblyId
}
export async function isSubscribed(userId:string,key:string){
 if(!parseScopeKey(key))return false
 const{data,error}=await sb().from('level_subscriptions').select('on').eq('user_id',userId).eq('scope',key).maybeSingle()
 if(error)throw new Error(`Unable to read level subscription: ${error.message}`)
 return data?data.on:defaultSubscribed(userId,key)
}
export async function setSubscription(userId:string,key:string,on:boolean){if(!parseScopeKey(key))return false;const{error}=await sb().from('level_subscriptions').upsert({user_id:userId,scope:key,on,updated_at:new Date().toISOString()},{onConflict:'user_id,scope'});if(error)throw new Error(`Unable to save level subscription: ${error.message}`);return true}
export async function subscribedKeys(userId:string){const home=await homeScopes(userId);const keys=new Set<string>(['national']);if(home){keys.add(`d:${home.districtId}`);keys.add(`a:${home.assemblyId}`)}const{data,error}=await sb().from('level_subscriptions').select('scope,on').eq('user_id',userId);if(error)throw new Error(`Unable to read subscriptions: ${error.message}`);for(const r of data??[])r.on?keys.add(r.scope):keys.delete(r.scope);return[...keys]}
export async function notifyScope(key:string,type:NotificationType,actorId:string,ref:{announcementId?:string;eventId?:string;liveId?:string}){
 const{data,error}=await sb().rpc('papa_notify_scope',{p_key:key,p_type:type,p_actor_id:actorId,p_announcement_id:ref.announcementId??null,p_event_id:ref.eventId??null,p_live_id:ref.liveId??null})
 if(error)throw new Error(`Unable to notify scope: ${error.message}`)
 await publish({userId:'*',kind:'notification'}).catch(()=>{})
 void pushToScope(key,type,actorId,ref).catch(e=>console.error('push failed',e))
 return (data??[]).length
}
async function pushToScope(key:string,type:NotificationType,actorId:string,ref:{announcementId?:string;eventId?:string;liveId?:string}){
 const{data:subs,error}=await sb().rpc('papa_scope_push_subscriptions',{p_key:key,p_type:type,p_actor_id:actorId})
 if(error)throw new Error(`Unable to load push subscribers: ${error.message}`);if(!subs?.length)return
 const{data:actor,error:actorError}=await sb().from('users').select('full_name').eq('id',actorId).maybeSingle();if(actorError)throw new Error(`Unable to load notification actor: ${actorError.message}`)
 const url=ref.liveId?`${env.appUrl}/live/${ref.liveId}`:ref.eventId?`${env.appUrl}/events/${ref.eventId}`:`${env.appUrl}/announcements/${ref.announcementId}`
 const payload={title:'PAPA',body:pushText(type,actor?.full_name??'Someone'),url,tag:`${type}:${ref.liveId??ref.eventId??ref.announcementId}`}
 for(let i=0;i<subs.length;i+=50)await Promise.all(subs.slice(i,i+50).map(async(s:any)=>{if(await sendPush(s,payload)==='gone'){const{error}=await sb().from('push_subscriptions').delete().eq('id',s.id);if(error)throw error}}))
}
export async function searchScopes(q:string,limit=12){const term=q.trim();if(term.length<2)return[];const pattern=`%${term.replace(/[%_\\]/g,'\\$&')}%`;const[{data:ds,error:de},{data:as,error:ae}]=await Promise.all([sb().from('districts').select('id,name,slug').ilike('name',pattern).order('name').limit(limit),sb().from('assemblies').select('id,name,slug,town,districts(name)').or(`name.ilike.${pattern},town.ilike.${pattern}`).order('name').limit(limit)]);if(de||ae)throw new Error('Unable to search church scopes');return[...(ds??[]).map((d:any)=>({kind:'district' as const,id:d.id,name:d.name,slug:d.slug,sub:null as string|null})),...(as??[]).map((a:any)=>{const d=Array.isArray(a.districts)?a.districts[0]:a.districts;return{kind:'local' as const,id:a.id,name:a.name,slug:a.slug,sub:[a.town,d?.name].filter(Boolean).join(', ')}})]}
