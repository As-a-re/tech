'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { Bell, BookOpen, Heart, Home, LogOut, Menu, MessageSquare, MoreVertical, Radio, Settings, ShoppingBag, Users, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';

interface DashboardLayoutProps { children: React.ReactNode; user?: { name: string; email: string } }

export function DashboardLayout({ children, user: authenticatedUser }: DashboardLayoutProps) {
  const user = authenticatedUser ?? { name: 'Account', email: '' };
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const initials = user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const navigationItems = [
    { label: 'Overview', icon: Home, href: '/dashboard' }, { label: 'Groups', icon: Users, href: '/dashboard/groups' }, { label: 'Messages', icon: MessageSquare, href: '/dashboard/messages' }, { label: 'Announcements', icon: Bell, href: '/dashboard/announcements' }, { label: 'Content', icon: BookOpen, href: '/dashboard/content' }, { label: 'Live sessions', icon: Radio, href: '/dashboard/live-sessions' }, { label: 'Marketplace', icon: ShoppingBag, href: '/dashboard/marketplace' },
  ];
  return <div className="flex h-screen overflow-hidden bg-background">
    {sidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-300 md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-24 items-center justify-between border-b border-sidebar-border px-6"><Link href="/" className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground"><Heart className="size-5 fill-current" /></span><span className="font-semibold tracking-tight">CATE<span className="text-sidebar-primary">.</span></span></Link><button className="md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X /></button></div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-6">{navigationItems.map(({ label, icon: Icon, href }) => { const active = pathname === href; return <Link key={href} href={href} onClick={() => setSidebarOpen(false)} className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-lg shadow-black/10' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}><Icon className={`size-5 ${active ? 'text-sidebar-primary' : 'group-hover:text-sidebar-primary'}`} />{label}{active && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />}</Link> })}</nav>
      <div className="border-t border-sidebar-border p-4"><Link href="/dashboard/profile" className="mb-2 flex items-center gap-3 rounded-2xl bg-sidebar-accent/50 p-3"><div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-500 text-xs font-bold text-slate-950">{initials}</div><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-sidebar-foreground/50">{user.email}</p></div></Link><Button variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"><Settings /> Settings</Button><Button variant="ghost" onClick={async () => { await supabaseBrowser().auth.signOut(); router.push('/auth/login'); router.refresh(); }} className="w-full justify-start gap-3 text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-red-300"><LogOut /> Sign out</Button></div>
    </aside>
    <div className="flex min-w-0 flex-1 flex-col"><header className="glass z-30 flex h-20 items-center justify-between border-x-0 border-t-0 px-5 sm:px-8"><div className="flex items-center gap-4"><button className="rounded-xl p-2 hover:bg-muted md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu /></button><div><p className="hidden text-xs font-medium uppercase tracking-[0.18em] text-primary sm:block">Christ Anointed Tech</p><h1 className="text-lg font-semibold tracking-tight">Ministry command center</h1></div></div><div className="flex items-center gap-3"><button className="relative rounded-xl p-2.5 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Notifications"><Bell className="size-5" /><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background" /></button><button className="rounded-xl p-2.5 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="More options"><MoreVertical className="size-5" /></button><Link href="/dashboard/profile" aria-label="Open profile" className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-500 text-sm font-bold text-slate-950 shadow-lg shadow-primary/20">{initials}</Link></div></header><main className="flex-1 overflow-y-auto"><div className="mx-auto max-w-[1600px] p-5 sm:p-8">{children}</div></main></div>
  </div>;
}
