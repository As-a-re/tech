'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { markPaidAction, retryPayoutAction, riderStatusAction, setProductStatusAction, setShopStatusAction, setShopVerifiedAction } from '@/server/actions/market'

export function ProductStatusButton({ id, removed }: { id: string; removed: boolean }) {
  const { t } = useI18n()
  const [p, start] = useTransition()
  return <Button size="sm" variant={removed ? 'outline' : 'destructive'} disabled={p} data-product-status={id}
    onClick={() => start(async () => { if (await setProductStatusAction(id, removed ? 'active' : 'removed')) toast.success(t('market.admin.done')) })}>{removed ? t('market.admin.restore') : t('market.admin.remove')}</Button>
}

export function ShopControls({ id, suspended, verified }: { id: string; suspended: boolean; verified: boolean }) {
  const { t } = useI18n()
  const [p, start] = useTransition()
  return (
    <span className="flex gap-2">
      <Button size="sm" variant="outline" disabled={p} onClick={() => start(async () => { if (await setShopVerifiedAction(id, !verified)) toast.success(t('market.admin.done')) })}>{verified ? t('market.admin.unverify') : t('market.admin.verify')}</Button>
      <Button size="sm" variant={suspended ? 'outline' : 'destructive'} disabled={p} data-shop-status={id}
        onClick={() => start(async () => { if (await setShopStatusAction(id, suspended ? 'active' : 'suspended')) toast.success(t('market.admin.done')) })}>{suspended ? t('market.admin.unsuspend') : t('market.admin.suspend')}</Button>
    </span>
  )
}

export function RiderControls({ id, status }: { id: string; status: string }) {
  const { t } = useI18n()
  const [p, start] = useTransition()
  const set = (s: 'active' | 'paused' | 'rejected' | 'suspended') => start(async () => { if (await riderStatusAction(id, s)) toast.success(t('market.admin.done')) })
  return (
    <span className="flex flex-wrap gap-2">
      {status !== 'active' && status !== 'suspended' && <Button size="sm" disabled={p} onClick={() => set('active')} data-approve-rider>{status === 'pending' || status === 'rejected' ? t('market.admin.approve') : t('market.admin.resume')}</Button>}
      {status === 'pending' && <Button size="sm" variant="outline" disabled={p} onClick={() => set('rejected')}>{t('market.admin.reject')}</Button>}
      {status === 'active' && <Button size="sm" variant="outline" disabled={p} onClick={() => set('paused')}>{t('market.admin.pause')}</Button>}
      {status !== 'suspended' && status !== 'pending' && status !== 'rejected' && <Button size="sm" variant="outline" className="text-destructive" disabled={p} onClick={() => set('suspended')}>{t('market.admin.suspendRider')}</Button>}
      {status === 'suspended' && <Button size="sm" variant="outline" disabled={p} onClick={() => set('active')}>{t('market.admin.unsuspend')}</Button>}
    </span>
  )
}

export function PayoutControls({ id, status }: { id: string; status: string }) {
  const { t } = useI18n()
  const [p, start] = useTransition()
  const [ref, setRef] = useState('')
  if (status !== 'failed' && status !== 'manual') return null
  return (
    <span className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      {status === 'failed' && <Button size="sm" variant="outline" disabled={p} onClick={() => start(async () => { if (await retryPayoutAction(id)) toast.success(t('market.admin.done')) })}>{t('market.admin.retry')}</Button>}
      <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t('market.admin.markPaidPh')} aria-label={t('market.admin.markPaidPh')} className="h-8 w-36" />
      <Button size="sm" disabled={p || !ref.trim()} onClick={() => start(async () => { if (await markPaidAction(id, ref)) toast.success(t('market.admin.done')) })} data-mark-paid>{t('market.admin.markPaid')}</Button>
    </span>
  )
}
