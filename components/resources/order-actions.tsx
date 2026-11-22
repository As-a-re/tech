'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { updateOrderAction } from '@/server/actions/resources'

/** Manager buttons on a uniform order: ready, collected (with the buyer's code), cancel. */
export function OrderActions({ id, status }: { id: string; status: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [sure, setSure] = useState(false)
  const [pending, start] = useTransition()
  const act = (action: 'ready' | 'collected' | 'cancel') => start(async () => {
    const r = await updateOrderAction(id, action, code)
    if (!r.ok) { toast.error(t(`res.err.${r.error}` as MessageKey)); return }
    toast.success(t('res.mgr.done')); router.refresh()
  })
  if (status !== 'paid' && status !== 'ready') return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'paid' && <button type="button" disabled={pending} onClick={() => act('ready')} data-mark-ready className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">{t('res.mgr.ready')}</button>}
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder={t('res.mgr.codePh')} aria-label={t('res.mgr.codePh')}
        className="h-9 w-32 rounded-full border bg-background px-3 text-center font-mono text-sm outline-none focus:border-primary" />
      <button type="button" disabled={pending || code.length !== 6} onClick={() => act('collected')} data-mark-collected className="rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted disabled:opacity-40">{t('res.mgr.collected')}</button>
      {sure ? <button type="button" disabled={pending} onClick={() => act('cancel')} className="rounded-full bg-destructive px-3 py-1.5 text-sm font-semibold text-white">{t('res.mgr.cancelConfirm')}</button>
        : <button type="button" onClick={() => setSure(true)} className="rounded-full px-3 py-1.5 text-sm text-destructive hover:underline">{t('res.mgr.cancel')}</button>}
    </div>
  )
}
