'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { followShopAction } from '@/server/actions/market'

export function FollowShopButton({ shopId, initial, signedIn, size = 'md' }: { shopId: string; initial: boolean; signedIn: boolean; size?: 'sm' | 'md' }) {
  const { t } = useI18n()
  const router = useRouter()
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  const click = () => {
    if (!signedIn) { router.push('/login?next=/market'); return }
    const next = !on
    setOn(next)
    start(async () => { const r = await followShopAction(shopId, next); if (!r.ok) { setOn(!next); toast.error(t(`market.err.${r.error}` as MessageKey)) } else router.refresh() })
  }
  return (
    <button type="button" disabled={pending} onClick={click} aria-pressed={on} data-follow-shop={on ? 'on' : 'off'}
      className={cn('rounded-full font-bold', size === 'sm' ? 'px-3 py-1 text-sm' : 'px-5 py-2', on ? 'border hover:bg-muted' : 'bg-foreground text-background hover:opacity-90')}>
      {on ? t('market.shop.following') : t('market.shop.follow')}
    </button>
  )
}
