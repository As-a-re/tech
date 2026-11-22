'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

const TABS = ['dashboard', 'orders', 'products', 'coupons', 'earnings', 'questions', 'settings'] as const

/** Tabs across the seller area (scroll sideways on phones). Badges: orders and questions waiting. */
export function SellerNav({ badges }: { badges: Partial<Record<(typeof TABS)[number], number>> }) {
  const { t } = useI18n()
  const path = usePathname()
  return (
    <nav aria-label={t('market.sell.title')} className="sticky top-16 z-30 flex overflow-x-auto border-b bg-background/95 px-2 backdrop-blur [scrollbar-width:none]" data-seller-nav>
      {TABS.map((k) => {
        const href = k === 'dashboard' ? '/market/sell' : `/market/sell/${k}`
        const active = k === 'dashboard' ? path === href : path.startsWith(href)
        const n = badges[k] ?? 0
        return (
          <Link key={k} href={href} aria-current={active ? 'page' : undefined} className={cn('relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {t(`market.sell.nav.${k}`)}{n > 0 && <span className="rounded-full bg-brand-red px-1.5 text-[11px] font-bold text-white">{n}</span>}
            {active && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-primary" />}
          </Link>
        )
      })}
    </nav>
  )
}
