import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { hit } from '@/server/identity/rate-limit'
export type ReportReason='spam'|'abuse'|'false_info'|'inappropriate'|'impersonation'|'other'
export const REPORT_REASONS:ReportReason[]=['spam','abuse','false_info','inappropriate','impersonation','other']
type ReportFailure='invalid'|'self'|'duplicate'|'too_many'
export type ReportTarget={postId?:string;userId?:string;announcementId?:string;eventId?:string;prayerId?:string;testimonyId?:string;conversationId?:string;productId?:string;shopId?:string}
export type ReportResult={ok:true;error?:never}|{ok:false;error:ReportFailure}
const sb=()=>createSupabaseAdminClient()
const camelRow=<T=any>(row:any):T=>Object.fromEntries(Object.entries(row??{}).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c:string)=>c.toUpperCase()),v])) as T
export async function fileReport(reporterId:string,target:ReportTarget,reason:string,details:string):Promise<ReportResult>{const kinds=Object.values(target).filter(Boolean);if(!REPORT_REASONS.includes(reason as ReportReason)||kinds.length!==1)return{ok:false,error:'invalid'};if(!(await hit(`report:${reporterId}`,20,3600)))return{ok:false,error:'too_many'};const {data,error}=await sb().rpc('papa_file_report',{p_reporter_id:reporterId,p_target:target,p_reason:reason,p_details:details.trim().slice(0,500)});if(error)throw new Error(`Unable to file report: ${error.message}`);const result=String(data);return result==='ok'?{ok:true}:{ok:false,error:(['invalid','self','duplicate','too_many'].includes(result)?result:'invalid') as ReportFailure}}
export async function listReports(status:'open'|'actioned'|'dismissed'='open'){const {data,error}=await sb().rpc('papa_list_reports',{p_status:status});if(error)throw new Error(`Unable to list reports: ${error.message}`);return (data??[]) as any[]}
export async function resolveReports(reportId:string,adminId:string,status:'actioned'|'dismissed',resolution:string){const {data,error}=await sb().rpc('papa_resolve_reports',{p_report_id:reportId,p_admin_id:adminId,p_status:status,p_resolution:resolution.trim().slice(0,1000)});if(error)throw new Error(`Unable to resolve report: ${error.message}`);return data?camelRow(data):null}
export async function openReportCount(){const {data,error}=await sb().rpc('papa_open_report_count');if(error)throw new Error(`Unable to count open reports: ${error.message}`);return Number(data??0)}
