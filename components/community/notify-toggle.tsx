'use client'

import { useState, useTransition } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { setLevelNotifyAction } from '@/server/actions/community'

/** "Notify me" bell for a level (National, a district or an assembly). */
export function NotifyToggle({ scopeKey, initial }: { scopeKey: string; initial: boolean }) {
  const { t } = useI18n()
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  return (
    <button type="button" aria-pressed={on} disabled={pending}
      onClick={() => start(async () => { if (await setLevelNotifyAction(scopeKey, !on)) { setOn(!on); toast.success(!on ? t('levels.notifyOn') : t('levels.notifyOff')) } })}
      className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold', on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
      {on ? <Bell className="size-4" /> : <BellOff className="size-4" />}{t('levels.notify')}
    </button>
  )
}
