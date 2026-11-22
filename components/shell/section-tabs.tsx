import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { SECTIONS, type SectionKey } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/** For you · Following · Events · Kids — the row under the top bar. */
export async function SectionTabs({ active, signedIn }: { active: SectionKey; signedIn: boolean }) {
  const t = await getT()
  return (
    <nav aria-label={t('nav.main')} className="sticky top-16 z-30 flex overflow-x-auto border-b bg-background/95 backdrop-blur [scrollbar-width:none]">
      {SECTIONS.filter((s) => signedIn || !s.auth).map((s) => (
        <Link key={s.key} href={s.href} scroll={false} aria-current={active === s.key ? 'page' : undefined}
          className={cn('relative min-w-[5.5rem] flex-1 whitespace-nowrap px-3 py-3.5 text-center text-[15px] font-medium hover:bg-muted/50', active === s.key ? 'font-bold text-foreground' : 'text-muted-foreground')}>
          {t(s.label)}{active === s.key && <span className="absolute inset-x-1/2 bottom-0 h-1 w-14 -translate-x-1/2 rounded-full bg-primary" />}
        </Link>
      ))}
    </nav>
  )
}
