import { DashboardLayout } from '@/components/dashboard-layout'
import { getConversations } from '@/app/actions/messages'
import { getSupabaseUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MessagesClient from './messages-client'
export default async function MessagesPage(){let user;try{user=await getSupabaseUser()}catch{redirect('/auth/login')}const conversations=await getConversations();return <DashboardLayout user={{name:user.user_metadata?.name??user.email?.split('@')[0]??'Account',email:user.email??''}}><MessagesClient initialConversations={conversations}/></DashboardLayout>}
