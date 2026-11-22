'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { followAction, unfollowAction } from '@/server/actions/social'

type State = 'none' | 'following' | 'requested'

/** Follow / Following (hover: Unfollow) / Requested (hover: Cancel). Optimistic, with rollback on failure. */
export function FollowButton({ targetId, initial, followsYou, size = 'md' }: { targetId: string; initial: State; followsYou?: boolean; size?: 'sm' | 'md' }) {
  const { t } = useI18n()
  const [state, setState] = useState<State>(initial)
  const [pending, start] = useTransition()
  const toggle = () => start(async () => {
    const prev = state
    try {
      if (state === 'none') { setState('requested'); const r = await followAction(targetId); setState(r === 'following' ? 'following' : r === 'requested' ? 'requested' : 'none') }
      else { setState('none'); await unfollowAction(targetId) }
    } catch { setState(prev); toast.error(t('errors.errorText')) }
  })
  const base = size === 'sm' ? 'h-8 min-w-20 px-3 text-[13px]' : 'h-9 min-w-24 px-4 text-sm'
  if (state === 'none') return (
    <button type="button" disabled={pending} onClick={toggle} className={cn(base, 'rounded-full bg-foreground font-semibold text-background hover:opacity-90')}>
      {followsYou ? t('profile.followBack') : t('profile.follow')}
    </button>
  )
  return (
    <button type="button" disabled={pending} onClick={toggle} aria-label={state === 'following' ? t('profile.unfollow') : t('profile.cancelRequest')}
      className={cn(base, 'group rounded-full border font-semibold hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive')}>
      <span className="group-hover:hidden">{state === 'following' ? t('profile.following') : t('profile.requested')}</span>
      <span className="hidden group-hover:inline">{state === 'following' ? t('profile.unfollow') : t('profile.cancelRequest')}</span>
    </button>
  )
}
