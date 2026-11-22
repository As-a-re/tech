'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { useLive } from '@/hooks/use-live'
import { cn } from '@/lib/utils'
import { fetchCounts, postJson } from '@/lib/live-fetch'

/** Top-bar Messages icon with the number of chats waiting. New messages count as delivered as soon as they arrive here. */
export function MessagesLink({ initial, className }: { initial: number; className?: string }) {
  const { t } = useI18n()
  const [count, setCount] = useState(initial)
  const pathname = usePathname()
  useLive((e) => {
    if (e.kind === 'message') void postJson('/api/messages/delivered')
    if (e.kind === 'message' || e.kind === 'read' || e.kind === 'hello' || e.kind === 'call') fetchCounts().then((c) => c && setCount(c.chats))
  })
  const shown = pathname.startsWith('/messages') ? 0 : count
  return (
    <Link href="/messages" aria-label={`${t('nav.messages')}${shown ? ` (${shown})` : ''}`} className={cn('relative', className)}>
      <MessageCircle className="size-[18px]" />
      {shown > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[11px] font-bold text-white">{shown > 99 ? '99+' : shown}</span>}
    </Link>
  )
}
