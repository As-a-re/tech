'use client'

import { useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { answerRequestAction, unblockAction, unmuteAction } from '@/server/actions/social'

export function RequestActions({ id }: { id: string }) {
  const { t } = useI18n(); const [p, start] = useTransition(); const [done, setDone] = useState<string | null>(null)
  if (done) return <span className="text-sm text-muted-foreground">{done}</span>
  return (
    <span className="flex shrink-0 gap-2">
      <Button size="sm" disabled={p} onClick={() => start(async () => { await answerRequestAction(id, true); setDone(t('profile.following')) })}>{t('profile.accept')}</Button>
      <Button size="sm" variant="outline" disabled={p} onClick={() => start(async () => { await answerRequestAction(id, false); setDone('—') })}>{t('profile.decline')}</Button>
    </span>
  )
}

export function UndoButton({ id, kind }: { id: string; kind: 'unblock' | 'unmute' }) {
  const { t } = useI18n(); const [p, start] = useTransition()
  return <Button size="sm" variant="outline" disabled={p} onClick={() => start(() => (kind === 'unblock' ? unblockAction(id) : unmuteAction(id)))}>{t(`settings.blocked.${kind}`)}</Button>
}
