'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isActive, visibleNav } from '@/lib/navigation'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

/** Full menu. `rail` = icons only on tablets, labels from large screens up. */
export function Sidebar({ signedIn, role, onNavigate, rail }: { signedIn: boolean; role?: string; onNavigate?: () => void; rail?: boolean }) {
  const pathname = usePathname()
  const { t } = useI18n()
  return (
    <nav aria-label={t('nav.main')} className="flex flex-col gap-0.5 py-3">
      {visibleNav(signedIn, { role }).map(({ href, label, icon: Icon, accent }) => {
        const active = isActive(pathname, href)
        return (
          <Link key={href} href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined} title={rail ? t(label) : undefined}
            className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors', rail && 'justify-center lg:justify-start',
              active ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'text-foreground/80 hover:bg-muted hover:text-foreground')}>
            <Icon className={cn('size-5', accent === 'red' && 'text-brand-red')} strokeWidth={active ? 2.4 : 1.8} />
            <span className={rail ? 'sr-only lg:not-sr-only' : undefined}>{t(label)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
