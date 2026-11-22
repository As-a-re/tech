import { DashboardLayout } from '@/components/dashboard-layout'
import { getContentPosts } from '@/app/actions/content'
import { getSupabaseUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ContentClient from './content-client'

export default async function ContentPage() { let user; try { user = await getSupabaseUser() } catch { redirect('/auth/login') }; const posts = await getContentPosts(); return <DashboardLayout user={{ name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Account', email: user.email ?? '' }}><ContentClient initialPosts={posts} /></DashboardLayout> }
