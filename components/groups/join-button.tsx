'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { cancelRequestAction, joinGroupAction } from '@/server/actions/groups'

/** Join / Ask to join / Request sent / Open chat. */
export function JoinButton({ id, via, member, requested: initialRequested, approve, wide }: { id: string; via: 'link' | 'discover'; member: boolean; requested: boolean; approve: boolean; wide?: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [requested, setRequested] = useState(initialRequested)
  const [pending, start] = useTransition()
  const cls = wide ? 'w-full rounded-full' : 'rounded-full'
  if (member) return <Button asChild variant="outline" className={cls}><Link href={`/messages/${id}`}>{t('groups.open')}</Link></Button>
  if (requested) return (
    <Button variant="outline" disabled={pending} className={cls} onClick={() => start(async () => { await cancelRequestAction(id); setRequested(false) })}>{t('groups.cancelRequest')}</Button>
  )
  return (
    <Button disabled={pending} className={cls} onClick={() => start(async () => {
      const r = await joinGroupAction(id, via)
      if (!r.ok) return void toast.error(t(`groups.err.${r.error}` as MessageKey))
      if (r.status === 'requested') { setRequested(true); toast.success(t('groups.requested')); return }
      toast.success(t('groups.joined'))
      router.push(`/messages/${id}`)
    })}>{approve ? t('groups.request') : t('groups.join')}</Button>
  )
}
