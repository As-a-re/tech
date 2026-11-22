'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

const TABS = ['home', 'active', 'earnings', 'settings'] as const

export function RiderNav({ active }: { active: number }) {
  const { t } = useI18n()
  const path = usePathname()
  return (
    <nav aria-label={t('market.ride.title')} className="sticky top-16 z-30 flex overflow-x-auto border-b bg-background/95 px-2 backdrop-blur [scrollbar-width:none]" data-rider-nav>
      {TABS.map((k) => {
        const href = k === 'home' ? '/market/ride' : `/market/ride/${k}`
        const on = k === 'home' ? path === href || path.startsWith('/market/ride/jobs') : path.startsWith(href)
        return (
          <Link key={k} href={href} aria-current={on ? 'page' : undefined} className={cn('relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm font-medium', on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {t(`market.ride.nav.${k}`)}{k === 'active' && active > 0 && <span className="rounded-full bg-brand-red px-1.5 text-[11px] font-bold text-white">{active}</span>}
            {on && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-primary" />}
          </Link>
        )
      })}
    </nav>
  )
}
