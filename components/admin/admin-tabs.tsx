'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'

const TABS = ['dashboard', 'members', 'structure', 'accounts', 'roles', 'settings', 'content', 'giving', 'market', 'verses', 'reports', 'audit'] as const

export function AdminTabs() {
  const pathname = usePathname()
  const { t } = useI18n()
  return (
    <nav aria-label={t('admin.title')} className="sticky top-16 z-30 flex overflow-x-auto border-b bg-background/95 px-2 backdrop-blur">
      {TABS.map((k) => {
        const href = k === 'dashboard' ? '/admin' : `/admin/${k}`
        const active = k === 'dashboard' ? pathname === '/admin' : pathname.startsWith(href)
        return (
          <Link key={k} href={href} aria-current={active ? 'page' : undefined}
            className={cn('relative whitespace-nowrap px-3.5 py-3 text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {t(`admin.tabs.${k}`)}{active && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-primary" />}
          </Link>
        )
      })}
    </nav>
  )
}
