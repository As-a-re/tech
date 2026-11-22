'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { useLive } from '@/hooks/use-live'
import { fetchCounts } from '@/lib/live-fetch'

/** Header megaphone: red dot while there are announcements the member hasn't opened yet. */
export function AnnouncementsBell({ initial, signedIn }: { initial: number; signedIn: boolean }) {
  const { t } = useI18n()
  const [count, setCount] = useState(initial)
  const pathname = usePathname()
  useLive((e) => { if (e.kind === 'notification') fetchCounts().then((c) => c && setCount(c.announcements)) }, signedIn)
  const shown = pathname.startsWith('/announcements') ? 0 : count
  return (
    <Link href="/announcements" aria-label={`${t('nav.announcements')}${shown ? ` (${shown})` : ''}`} className="relative rounded-full border p-2 hover:bg-muted">
      <Megaphone className="size-[18px]" />
      {shown > 0 && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-brand-red" />}
    </Link>
  )
}
