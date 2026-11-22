'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, Heart, MessageSquare, Play, Radio, ShoppingBag, Sparkles, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  { icon: Users, title: 'Gather people', text: 'Create spaces where faith, ideas, and real relationships grow.', tone: 'from-cyan-400/20 to-cyan-400/5' },
  { icon: BookOpen, title: 'Share wisdom', text: 'Publish teachings and resources that meet your community in the moment.', tone: 'from-violet-400/20 to-violet-400/5' },
  { icon: Radio, title: 'Go further', text: 'Bring live moments, announcements, and conversations into one rhythm.', tone: 'from-fuchsia-400/20 to-fuchsia-400/5' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="animate-pulse-glow flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Heart className="size-5 fill-current" /></span>
            <span className="hidden sm:inline">Christ Anointed <span className="text-primary">Tech</span></span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-5"><Link href="/auth/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Sign in</Link><Link href="/auth/register"><Button className="rounded-full px-5 shadow-lg shadow-primary/20">Start building <ArrowRight data-icon="inline-end" /></Button></Link></div>
        </div>
      </nav>

      <section className="grid-glow relative isolate px-5 pb-24 pt-40 sm:px-8 sm:pt-48">
        <div className="absolute left-1/2 top-24 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="mx-auto max-w-6xl text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-medium text-primary"><Sparkles className="size-4" /> A new operating system for community</div>
          <h1 className="mx-auto max-w-5xl text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-7xl lg:text-8xl">Make your <span className="text-gradient">community</span> feel closer.</h1>
          <p className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-8 text-muted-foreground sm:text-xl">One beautiful space for churches and ministries to gather, teach, create, and move together.</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/auth/register"><Button size="lg" className="h-14 rounded-full px-7 text-base shadow-xl shadow-primary/25">Create your space <ArrowRight data-icon="inline-end" /></Button></Link><Link href="#features"><Button size="lg" variant="outline" className="h-14 rounded-full bg-background/40 px-7 text-base"><Play data-icon="inline-start" className="fill-current" /> See what&apos;s possible</Button></Link></div>
          <div className="relative mx-auto mt-20 max-w-5xl"><div className="animate-float absolute -right-3 -top-8 hidden rounded-2xl border border-secondary/30 bg-card/90 p-4 text-left shadow-2xl backdrop-blur md:block"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-emerald-400" /> Live now</div><p className="font-medium">Sunday gathering</p><p className="text-xs text-muted-foreground">1,204 connected</p></div><div className="glass rounded-[2rem] p-2 shadow-2xl shadow-primary/10"><div className="rounded-[1.5rem] border border-white/10 bg-slate-950 p-5 text-left sm:p-8"><div className="mb-7 flex items-center justify-between"><div><p className="text-sm text-slate-400">Good morning, Pastor</p><h2 className="mt-1 text-2xl font-semibold text-white">Your community at a glance</h2></div><div className="size-10 rounded-full bg-gradient-to-br from-cyan-300 to-violet-500" /></div><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-white/5 p-5"><Users className="mb-8 size-5 text-cyan-300" /><p className="text-3xl font-semibold text-white">2,547</p><p className="mt-1 text-xs text-slate-400">Active members</p></div><div className="rounded-2xl bg-white/5 p-5"><Zap className="mb-8 size-5 text-fuchsia-300" /><p className="text-3xl font-semibold text-white">03</p><p className="mt-1 text-xs text-slate-400">Live sessions</p></div><div className="rounded-2xl bg-white/5 p-5"><MessageSquare className="mb-8 size-5 text-violet-300" /><p className="text-3xl font-semibold text-white">98%</p><p className="mt-1 text-xs text-slate-400">Connection score</p></div></div></div></div></div>
        </div>
      </section>

      <section id="features" className="border-y border-border/70 bg-card/40 px-5 py-24 sm:px-8"><div className="mx-auto max-w-6xl"><div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-3 text-sm font-medium uppercase tracking-[0.22em] text-primary">Everything in sync</p><h2 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">Built for the way people connect now.</h2></div><p className="max-w-sm text-muted-foreground">Less admin. More presence. More room for the moments that matter.</p></div><div className="grid gap-5 md:grid-cols-3">{features.map(({ icon: Icon, title, text, tone }) => <div key={title} className={`group rounded-3xl border border-border bg-gradient-to-br ${tone} p-7 transition-all duration-300 hover:-translate-y-2 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10`}><div className="mb-16 flex size-12 items-center justify-center rounded-2xl bg-background/70 text-primary shadow-sm"><Icon className="size-6 transition-transform duration-300 group-hover:rotate-6" /></div><h3 className="text-xl font-semibold">{title}</h3><p className="mt-3 leading-7 text-muted-foreground">{text}</p></div>)}</div></div></section>

      <section className="px-5 py-24 sm:px-8"><div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-16 text-center text-white sm:px-16"><div className="absolute left-1/2 top-0 size-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-3xl" /><div className="relative"><ShoppingBag className="mx-auto mb-6 size-8 text-cyan-300" /><h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">Your next chapter starts here.</h2><p className="mx-auto mt-5 max-w-xl text-slate-300">Give your people a place that feels as alive as the mission you&apos;re building.</p><Link href="/auth/register" className="mt-9 inline-flex"><Button size="lg" className="rounded-full bg-white px-7 text-slate-950 hover:bg-cyan-100">Get started free <ArrowRight data-icon="inline-end" /></Button></Link></div></div></section>
      <footer className="border-t border-border px-5 py-8 sm:px-8"><div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 text-sm text-muted-foreground sm:flex-row"><span>© 2026 Christ Anointed Tech</span><span>Built for people, purpose, and presence.</span></div></footer>
    </main>
  );
}
