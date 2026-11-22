import 'server-only'
import { randomInt } from 'node:crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
export type Who={id:string;role:'member'|'tech_admin'}
export const isId=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v)
/** Shared visibility predicate text; catalog wraps it as a Drizzle SQL fragment until that module is migrated. */
export const VISIBLE = `p.status = 'active' and p.deleted_at is null and s.status = 'active' and s.deleted_at is null and u.status = 'active'`
export const IMAGE=/^\/(media\/posts\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)|demo\/[\w-]+\.(jpg|png))$/
/** Order IDs are pronounceable and avoid ambiguous characters. */
export function orderNumber(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=A[randomInt(A.length)];return `PM-${s}`}
export const sixDigits=()=>String(randomInt(100000,1000000))
export async function orderEvent(orderId:string,kind:string,actorId:string|null=null,note:string|null=null){
 const {error}=await createSupabaseAdminClient().from('market_order_events').insert({order_id:orderId,kind,actor_id:actorId,note})
 if(error)throw new Error(`Unable to record order event: ${error.message}`)
}
export const iso=(d:Date|string|null|undefined)=>(d?new Date(d).toISOString():null)
