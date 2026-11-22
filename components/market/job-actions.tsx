'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { deliverJobAction, jobAction, riderAvailableAction } from '@/server/actions/market'

/** Take a job, give it back, collect it, or deliver it with the buyer's code. */
export function JobActions({ id, status, mine, canAccept }: { id: string; status: string; mine: boolean; canAccept: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [pending, start] = useTransition()
  const step = (s: 'accept' | 'drop' | 'pickup', done: string) => start(async () => {
    const r = await jobAction(id, s)
    if (!r.ok) { toast.error(t(`market.ride.err.${'error' in r ? r.error : 'state'}` as MessageKey)); router.refresh(); return }
    toast.success(done); router.push(s === 'accept' ? `/market/ride/jobs/${id}` : s === 'drop' ? '/market/ride' : `/market/ride/jobs/${id}`); router.refresh()
  })
  if (!mine) return canAccept ? <Button size="lg" className="w-full rounded-full" disabled={pending} onClick={() => step('accept', t('market.ride.accepted'))} data-accept-job>{t('market.ride.accept')}</Button> : null
  if (status === 'accepted') return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button size="lg" className="rounded-full" disabled={pending} onClick={() => step('pickup', t('market.ride.picked'))} data-pickup>{t('market.ride.pickup')}</Button>
      <Button size="lg" variant="outline" className="rounded-full" disabled={pending} onClick={() => step('drop', t('market.seller.done'))} data-drop>{t('market.ride.drop')}</Button>
    </div>
  )
  if (status === 'picked_up') return (
    <div className="flex gap-2">
      <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder={t('market.ride.codePh')} aria-label={t('market.ride.codePh')} className="h-12 text-lg tracking-widest" data-rider-code />
      <Button size="lg" className="h-12 rounded-full" disabled={pending || code.length !== 6} data-deliver onClick={() => start(async () => {
        const r = await deliverJobAction(id, code)
        if (!r.ok) { toast.error(t(`market.ride.err.${String('error' in r ? r.error : 'state')}`)); return }
        toast.success(t('market.ride.delivered')); router.refresh()
      })}>{t('market.ride.deliver')}</Button>
    </div>
  )
  return null
}

/** Taking jobs / on a break. */
export function AvailableSwitch({ initial }: { initial: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  return (
    <label className="flex items-center gap-3 rounded-2xl border px-4 py-3" data-available={on ? 'on' : 'off'}>
      <span className="flex-1 font-semibold">{on ? t('market.ride.available') : t('market.ride.break')}</span>
      <Switch checked={on} disabled={pending} onCheckedChange={(v) => { setOn(v); start(async () => { if (!(await riderAvailableAction(v))) setOn(!v); router.refresh() }) }} />
    </label>
  )
}
