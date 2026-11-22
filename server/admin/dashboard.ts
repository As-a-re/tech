import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
const sb=()=>createSupabaseAdminClient()
const fail=(action:string,error:{message:string})=>{throw new Error(`${action}: ${error.message}`)}
async function countRows(table:string, apply?:(q:any)=>any) {
  let q=sb().from(table).select('*',{count:'exact',head:true})
  if(apply) q=apply(q)
  const {count,error}=await q
  if(error) fail(`Unable to count ${table}`,error)
  return count??0
}
export async function stats() {
  const [register,active,accounts,newAccounts,activeWeek,districts,assemblies,suspended,twoFa,admins]=await Promise.all([
    countRows('church_members'),countRows('church_members',q=>q.eq('active',true)),countRows('users'),
    countRows('users',q=>q.gte('created_at',new Date(Date.now()-7*86400000).toISOString())),
    countRows('users',q=>q.gte('last_seen_at',new Date(Date.now()-7*86400000).toISOString())),countRows('districts'),countRows('assemblies'),
    countRows('users',q=>q.eq('status','suspended')),countRows('users',q=>q.not('totp_enabled_at','is',null)),countRows('users',q=>q.eq('role','tech_admin')),
  ])
  return {register,active,accounts,newAccounts,activeWeek,districts,assemblies,suspended,twoFa,admins,uptake:register?Math.round(accounts/register*100):0}
}
export async function topAssemblies(limit=8) {
  const {data:assemblies,error:ae}=await sb().from('assemblies').select('id,name')
  if(ae) fail('Unable to list assemblies',ae)
  const rows=assemblies??[]
  if(!rows.length) return []
  const {data:users,error:ue}=await sb().from('users').select('assembly_id').in('assembly_id',rows.map((x:any)=>x.id))
  if(ue) fail('Unable to count accounts by assembly',ue)
  const counts=new Map<string,number>()
  for(const u of users??[]) counts.set(u.assembly_id,(counts.get(u.assembly_id)??0)+1)
  return rows.map((a:any)=>({name:a.name,n:counts.get(a.id)??0})).sort((a,b)=>b.n-a.n).slice(0,Math.max(0,limit))
}
export async function failedSignInsToday() {
  return countRows('audit_log',q=>q.eq('action','account.login_failed').gte('created_at',new Date(Date.now()-24*3600000).toISOString()))
}
export async function callsToday() {
  const start=new Date(); start.setHours(0,0,0,0)
  return countRows('calls',q=>q.gte('started_at',start.toISOString()))
}
export async function monthTotal() {
  const start=new Date(); start.setDate(1); start.setHours(0,0,0,0)
  const {data,error}=await sb().from('payments').select('amount_pesewas').eq('status','success').neq('purpose','order').gte('paid_at',start.toISOString()).limit(10000)
  if(error) fail('Unable to calculate monthly giving',error)
  return (data??[]).reduce((sum:number,p:any)=>sum+Number(p.amount_pesewas??0),0)
}
