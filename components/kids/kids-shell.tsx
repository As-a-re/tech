import Link from 'next/link'
import { Lock } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import type { KidsAge } from '@/lib/library/kids-mode'

/** Kids mode: big, simple screens with only children's content. Leaving needs the parent's PIN. */
export async function KidsShell({ age, children }: { age: KidsAge; children: React.ReactNode }) {
  const t = await getT()
  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-100 via-amber-50 to-background dark:from-sky-950/40 dark:via-black dark:to-black" data-kids-shell>
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur dark:bg-black/80">
        <Link href="/children" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="size-9 rounded-full bg-white" />
          <span className="text-xl font-black tracking-tight"><span className="text-brand-blue">PAPA</span> <span className="text-brand-red">Kids</span></span>
        </Link>
        <span className="ml-auto rounded-full bg-amber-300 px-3 py-1 text-sm font-bold text-black">{t(`kids.agesLong.${age}`)}</span>
        <Link href="/children/exit" aria-label={t('kids.mode.exit')} title={t('kids.mode.exit')} className="rounded-full p-2 text-muted-foreground hover:bg-muted"><Lock className="size-5" /></Link>
      </header>
      <main className="mx-auto max-w-3xl pb-10">{children}</main>
    </div>
  )
}
