import { DashboardLayout } from '@/components/dashboard-layout'
import { getProfile } from '@/app/actions/profile'
import { getSupabaseUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from './profile-client'
export default async function ProfilePage(){let user;try{user=await getSupabaseUser()}catch{redirect('/auth/login')}const profile=await getProfile();return <DashboardLayout user={{name:user.user_metadata?.name??user.email?.split('@')[0]??'Account',email:user.email??''}}><ProfileClient profile={profile}/></DashboardLayout>}
