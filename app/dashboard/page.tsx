import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowUpRight, Bell, MessageSquare, Plus, Radio, Users } from 'lucide-react'
import { getSupabaseUser } from '@/lib/supabase/server'
import { getDashboardData } from '@/app/actions/dashboard'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  let user
  try { user = await getSupabaseUser() } catch { redirect('/auth/login') }
  const data = await getDashboardData(); const latest = data.announcements[0]
  const dashboardUser = { name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Account', email: user.email ?? '' }
  const stats = [{ label: 'Groups', value: data.groups.length, icon: Users }, { label: 'Announcements', value: data.announcements.length, icon: Bell }, { label: 'Scheduled sessions', value: data.sessions.length, icon: Radio }, { label: 'Unread messages', value: 0, icon: MessageSquare }]
  return <DashboardLayout user={dashboardUser}><div className="flex flex-col gap-8"><section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-2xl shadow-primary/10 sm:p-10"><div className="absolute -right-20 -top-24 size-80 rounded-full bg-cyan-400/20 blur-3xl" /><div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-end"><div><p className="mb-3 text-sm text-cyan-200">Your workspace</p><h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Welcome, {dashboardUser.name}.</h2><p className="mt-3 max-w-lg leading-7 text-slate-300">Everything here is connected to your ministry data.</p></div><Button asChild className="w-fit rounded-full bg-white text-slate-950 hover:bg-cyan-100"><Link href="/dashboard/announcements"><Plus data-icon="inline-start" /> Create announcement</Link></Button></div></section><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, icon: Icon }) => <Card key={label} className="rounded-3xl"><CardContent className="p-6"><div className="mb-9 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon /></div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p></CardContent></Card>)}</section><section className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]"><Card className="rounded-3xl"><CardContent className="p-6"><p className="text-sm text-muted-foreground">Latest announcement</p><h2 className="mt-2 text-xl font-semibold">{latest?.title ?? 'No announcements yet'}</h2><p className="mt-3 leading-7 text-muted-foreground">{latest?.body ?? 'Create your first announcement to start engaging your community.'}</p>{latest && <Button asChild variant="link" className="mt-5 h-auto px-0 text-primary"><Link href="/dashboard/announcements">View announcement <ArrowUpRight data-icon="inline-end" /></Link></Button>}</CardContent></Card></section></div></DashboardLayout>
}
