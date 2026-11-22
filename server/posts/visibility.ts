/** Stable cursor helpers shared by Supabase-backed post feeds. SQL visibility is enforced by server-only RPCs. */
export const encodeCursor=(at:Date|string,id:string)=>`${new Date(at).toISOString()}|${id}`
export function decodeCursor(c?:string|null):{at:string;id:string}|null{
 if(!c)return null
 const [at,id]=c.split('|')
 return at&&id&&!Number.isNaN(Date.parse(at))&&/^[0-9a-f-]{36}$/i.test(id)?{at,id}:null
}
