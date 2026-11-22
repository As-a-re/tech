'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { BellRing } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { useLive } from '@/hooks/use-live'
import { fetchCounts } from '@/lib/live-fetch'

/** Header bell with a live unread count. */
export function NotificationBell({ initial }: { initial: number }) {
  const { t } = useI18n()
  const [count, setCount] = useState(initial)
  const pathname = usePathname()
  useLive((e) => { if (e.kind === 'notification' || e.kind === 'hello') fetchCounts().then((c) => c && setCount(c.notifications)) })
  const shown = pathname === '/notifications' ? 0 : count
  return (
    <Link href="/notifications" aria-label={`${t('nav.notifications')}${shown ? ` (${shown})` : ''}`} className="relative rounded-full border p-2 hover:bg-muted">
      <BellRing className="size-[18px]" />
      {shown > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[11px] font-bold text-white">{shown > 99 ? '99+' : shown}</span>}
    </Link>
  )
}
