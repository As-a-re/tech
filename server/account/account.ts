import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { passwordProblem, usernameProblem } from '@/lib/identity/rules'
import { verifySupabaseCredentials } from '@/server/identity/login'
import { audit } from '@/server/identity/audit'
import { acceptAllRequests, getPreferences } from '@/server/social/relationships'
import { destroyAllSessions } from '@/server/identity/session'
const USERNAME_COOLDOWN_DAYS = 30
const sb = () => createSupabaseAdminClient()
function checkError(error: {message:string}|null, action:string): never|void { if (error) throw new Error(`${action}: ${error.message}`) }
export async function checkPassword(userId:string, password:string) {
  const {data:u,error}=await sb().from('users').select('auth_user_id,phone').eq('id',userId).maybeSingle(); checkError(error,'Unable to load account identity')
  if(!u?.auth_user_id)return false
  const authUser=await verifySupabaseCredentials(u.phone,password)
  return authUser?.id===u.auth_user_id
}
export type UsernameResult={ok:true;error?:never}|{ok:false;error:'username_length'|'username_chars'|'username_reserved'|'username_taken'|'username_cooldown';days?:number}
export async function changeUsername(userId:string,raw:string):Promise<UsernameResult>{
  const username=raw.trim().replace(/^@/,''); const p=usernameProblem(username); if(p)return {ok:false,error:`username_${p}`}
  const {data:u,error}=await sb().from('users').select('username,username_changed_at').eq('id',userId).maybeSingle(); checkError(error,'Unable to load username')
  if(!u)throw new Error('Account not found')
  if(u.username===username)return {ok:true}
  if(u.username.toLowerCase()!==username.toLowerCase()&&u.username_changed_at){const days=Math.ceil(USERNAME_COOLDOWN_DAYS-(Date.now()-Date.parse(u.username_changed_at))/864e5);if(days>0)return {ok:false,error:'username_cooldown',days}}
  const {data:taken,error:check}=await sb().from('users').select('id').ilike('username',username).neq('id',userId).limit(1);checkError(check,'Unable to check username')
  if(taken?.length)return {ok:false,error:'username_taken'}
  const now=new Date().toISOString(), caseOnly=u.username.toLowerCase()===username.toLowerCase()
  const {error:updateError}=await sb().from('users').update({username,updated_at:now,...(caseOnly?{}:{username_changed_at:now})}).eq('id',userId);checkError(updateError,'Unable to update username')
  await audit('account.username_changed',{actorId:userId,meta:{from:u.username,to:username}});return {ok:true}
}
export async function changeEmail(userId:string,raw:string){const email=raw.trim().toLowerCase();if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return false;const {error}=await sb().from('users').update({email:email||null,updated_at:new Date().toISOString()}).eq('id',userId);checkError(error,'Unable to update email');return true}
export type PasswordResult={ok:true;error?:never}|{ok:false;field:'current'|'password'|'confirm';error:string}
export async function changePassword(userId:string,current:string,next:string,confirm:string,keepSessionId:string|null):Promise<PasswordResult>{
  if(!(await checkPassword(userId,current)))return {ok:false,field:'current',error:'current_wrong'}
  const p=passwordProblem(next);if(p)return {ok:false,field:'password',error:`password_${p}`};if(next!==confirm)return {ok:false,field:'confirm',error:'password_mismatch'}
  const {data:account,error:accountError}=await sb().from('users').select('auth_user_id').eq('id',userId).maybeSingle();checkError(accountError,'Unable to load account identity')
  if(!account?.auth_user_id)return {ok:false,field:'current',error:'current_wrong'}
  const {error:authError}=await sb().auth.admin.updateUserById(account.auth_user_id,{password:next});checkError(authError,'Unable to update Supabase Auth password')
  const now=new Date().toISOString();const {error}=await sb().from('users').update({password_changed_at:now,updated_at:now}).eq('id',userId);checkError(error,'Unable to update password')
  await destroyAllSessions(userId,keepSessionId);await audit('account.password_changed',{actorId:userId});return {ok:true}
}
export async function listSessions(userId:string){const {data,error}=await sb().from('sessions').select('id,user_agent,ip,last_used_at,created_at').eq('user_id',userId).gt('expires_at',new Date().toISOString()).order('last_used_at',{ascending:false});checkError(error,'Unable to list sessions');return (data??[]).map(s=>({id:s.id,userAgent:s.user_agent,ip:s.ip,lastUsedAt:new Date(s.last_used_at),createdAt:new Date(s.created_at)}))}
export async function revokeSession(userId:string,sessionId:string){const {error}=await sb().from('sessions').delete().eq('user_id',userId).eq('id',sessionId);checkError(error,'Unable to revoke session');await audit('security.session_revoked',{actorId:userId})}
export type PrivacyPatch={privateProfile?:boolean;visibleToGuests?:boolean;showBirthday?:boolean;messagesFrom?:'everyone'|'following';readReceipts?:boolean;showLastSeen?:boolean;callsFrom?:'everyone'|'following'|'nobody'}
export async function updatePrivacy(userId:string,raw:PrivacyPatch){const patch:Record<string,unknown>={};for(const [from,to] of [['privateProfile','private_profile'],['visibleToGuests','visible_to_guests'],['showBirthday','show_birthday'],['readReceipts','read_receipts'],['showLastSeen','show_last_seen']] as const)if(typeof raw[from]==='boolean')patch[to]=raw[from];if(raw.messagesFrom==='everyone'||raw.messagesFrom==='following')patch.messages_from=raw.messagesFrom;if(raw.callsFrom==='everyone'||raw.callsFrom==='following'||raw.callsFrom==='nobody')patch.calls_from=raw.callsFrom;const before=await getPreferences(userId);const {error}=await sb().from('user_preferences').upsert({user_id:userId,...patch,updated_at:new Date().toISOString()},{onConflict:'user_id'});checkError(error,'Unable to update privacy settings');if(before.privateProfile&&patch.private_profile===false)await acceptAllRequests(userId)}
export async function updateDisplay(userId:string,patch:{textSize?:'small'|'default'|'large'|'xlarge';dataSaver?:boolean}){await getPreferences(userId);const {error}=await sb().from('user_preferences').upsert({user_id:userId,...(patch.textSize?{text_size:patch.textSize}:{}),...(patch.dataSaver!==undefined?{data_saver:patch.dataSaver}:{}),updated_at:new Date().toISOString()},{onConflict:'user_id'});checkError(error,'Unable to update display settings')}
/** Export the account holder's personal data in a portable JSON shape. */
export async function exportData(userId:string){
  const {data:u,error}=await sb().from('users').select('*').eq('id',userId).maybeSingle();checkError(error,'Unable to export account');if(!u)throw new Error('Account not found')
  const rows=async(table:string,select:string,column:string,order?:string,limit?:number):Promise<any[]>=>{let q=sb().from(table).select(select).eq(column,userId);if(order)q=q.order(order,{ascending:false});if(limit)q=q.limit(limit);const {data,error}=await q;checkError(error,`Unable to export ${table}`);return data??[]}
  const [posts,liked,saved,following,followers,blocked,muted,sessions,activity,prefs,announcements,events,rsvps,prayers,testimonies,comments,messages]=await Promise.all([
    rows('posts','id,body,reply_to_id,published_at,is_draft,deleted_at,created_at','author_id','created_at'),rows('likes','post_id,created_at','user_id'),rows('bookmarks','post_id,created_at','user_id'),rows('follows','followee_id','follower_id'),rows('follows','follower_id','followee_id'),rows('blocks','blocked_id','blocker_id'),rows('mutes','muted_id','muter_id'),listSessions(userId),rows('audit_log','action,created_at,ip','actor_id','created_at',500),getPreferences(userId),rows('announcements','id,level,title,body,created_at,deleted_at','author_id'),rows('events','id,title,starts_at,venue,deleted_at','author_id'),rows('event_rsvps','event_id,status,created_at','user_id'),rows('prayer_requests','id,body,anonymous,answered_at,created_at,deleted_at','author_id'),rows('testimonies','id,title,body,created_at,deleted_at','author_id'),rows('devotion_comments','id,body,created_at,deleted_at','author_id'),rows('messages','conversation_id,body,kind,created_at,deleted_at','sender_id','created_at',5000)
  ])
  const nameOf=async(ids:string[])=>{if(!ids.length)return[];const {data,error}=await sb().from('users').select('username').in('id',ids);checkError(error,'Unable to export relationship names');return (data??[]).map(x=>x.username)}
  const live=(items:any[])=>items.filter(x=>!x.deleted_at).map(({deleted_at:_,...x})=>x)
  const [orders,wishlist,reviews,questions,shops] = await Promise.all([
    sb().from('market_orders').select('number,shop_name,status,fulfilment,total_pesewas,refunded_pesewas,created_at,market_order_items(title,variant_name,qty,total_pesewas)').eq('buyer_id',userId).order('created_at',{ascending:false}),
    sb().from('wishlist_items').select('created_at,products(title)').eq('user_id',userId),
    sb().from('product_reviews').select('rating,body,created_at,products(title)').eq('user_id',userId),
    sb().from('product_questions').select('body,answer,created_at,products(title)').eq('asker_id',userId),
    sb().from('shops').select('id,name,slug,created_at').eq('owner_id',userId),
  ]); for(const [label,result] of [['market orders',orders],['wishlist',wishlist],['product reviews',reviews],['product questions',questions],['shops',shops]] as const) checkError(result.error,`Unable to export ${label}`);
  const shopIds=(shops.data??[]).map(x=>x.id);let productCounts=new Map<string,number>();if(shopIds.length){const {data:products,error:pe}=await sb().from('products').select('shop_id').in('shop_id',shopIds);checkError(pe,'Unable to export shop products');for(const p of products??[])productCounts.set(p.shop_id,(productCounts.get(p.shop_id)??0)+1)}
  const market={marketOrders:(orders.data??[]).map((o:any)=>({number:o.number,shop:o.shop_name,status:o.status,fulfilment:o.fulfilment,totalPesewas:o.total_pesewas,refundedPesewas:o.refunded_pesewas,createdAt:o.created_at,items:o.market_order_items??[]})),wishlist:(wishlist.data??[]).map((x:any)=>({title:Array.isArray(x.products)?x.products[0]?.title:x.products?.title,addedAt:x.created_at})),productReviews:(reviews.data??[]).map((x:any)=>({product:Array.isArray(x.products)?x.products[0]?.title:x.products?.title,rating:x.rating,body:x.body,createdAt:x.created_at})),productQuestions:(questions.data??[]).map((x:any)=>({product:Array.isArray(x.products)?x.products[0]?.title:x.products?.title,body:x.body,answer:x.answer,createdAt:x.created_at})),shop:(shops.data??[]).map(x=>({name:x.name,slug:x.slug,createdAt:x.created_at,products:productCounts.get(x.id)??0}))[0]??null}
  return {exportedAt:new Date().toISOString(),account:{churchId:u.church_id,username:u.username,fullName:u.full_name,phone:u.phone,email:u.email,bio:u.bio,website:u.website,avatarUrl:u.avatar_url,coverUrl:u.cover_url,locale:u.locale,role:u.role,createdAt:u.created_at,twoStepVerification:!!u.totp_enabled_at,anniversary:u.anniversary},preferences:{privateProfile:prefs.privateProfile,visibleToGuests:prefs.visibleToGuests,textSize:prefs.textSize,dataSaver:prefs.dataSaver,showBirthday:prefs.showBirthday},following:await nameOf(following.map(x=>x.followee_id)),followers:await nameOf(followers.map(x=>x.follower_id)),blocked:await nameOf(blocked.map(x=>x.blocked_id)),muted:await nameOf(muted.map(x=>x.muted_id)),devices:sessions.map(s=>({device:s.userAgent,ip:s.ip,lastUsedAt:s.lastUsedAt,signedInAt:s.createdAt})),securityActivity:activity.map(x=>({action:x.action,at:x.created_at,ip:x.ip})),posts:live(posts).map(({reply_to_id, published_at,is_draft,created_at,...x})=>({...x,replyTo:reply_to_id,publishedAt:published_at,draft:is_draft,createdAt:created_at})),likes:liked.map(x=>({postId:x.post_id,at:x.created_at})),bookmarks:saved.map(x=>({postId:x.post_id,at:x.created_at})),announcements:live(announcements),events:live(events),eventResponses:rsvps,prayerRequests:live(prayers),testimonies:live(testimonies),comments:live(comments),messagesSent:live(messages),...market}
}
export async function deleteAccount(userId:string,password:string){if(!(await checkPassword(userId,password)))return false;const {data:u,error}=await sb().from('users').select('church_id,auth_user_id').eq('id',userId).maybeSingle();checkError(error,'Unable to load account');if(!u)return false;await audit('account.deleted',{target:u.church_id});const {error:delError}=await sb().from('users').delete().eq('id',userId);checkError(delError,'Unable to delete account');if(u.auth_user_id){const {error:authError}=await sb().auth.admin.deleteUser(u.auth_user_id);checkError(authError,'Unable to delete Supabase Auth account')}return true}
