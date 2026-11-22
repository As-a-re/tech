/** Supabase service client for trusted one-off CLI scripts. Never use in browser code. */
import { config } from 'dotenv'
config({path:'.env.local'})
import { createClient } from '@supabase/supabase-js'
const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL
const key=process.env.SUPABASE_SERVICE_ROLE_KEY
if(!url)throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required')
if(!key)throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for CLI database operations')
export const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
