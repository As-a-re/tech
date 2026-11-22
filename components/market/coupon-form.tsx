'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { removeCouponAction, saveCouponAction } from '@/server/actions/market'
import type { CouponInput } from '@/server/market/seller'

const blank: CouponInput = { code: '', kind: 'percent', value: 10, minSpendGhs: 0, maxUses: null, startsAt: null, endsAt: null, active: true }

/** New coupon button, or the pencil on an existing coupon. */
export function CouponDialog({ id, initial }: { id?: string; initial?: CouponInput }) {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [v, setV] = useState<CouponInput>(initial ?? blank)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const set = <K extends keyof CouponInput>(k: K, val: CouponInput[K]) => setV((x) => ({ ...x, [k]: val }))
  const save = () => start(async () => {
    setError('')
    const r = await saveCouponAction(v, id)
    if (!r.ok) { setError(t(`market.sell.err.${r.error}` as MessageKey)); return }
    toast.success(t('market.sell.coupons.saved')); setOpen(false); if (!id) setV(blank); router.refresh()
  })
  return (
    <>
      {id ? <button type="button" aria-label={t('market.sell.coupons.edit')} onClick={() => setOpen(true)} className="rounded-full p-2 hover:bg-muted"><Pencil className="size-4" /></button>
        : <Button onClick={() => setOpen(true)} className="rounded-full" data-new-coupon><Plus className="size-4" />{t('market.sell.coupons.add')}</Button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{id ? t('market.sell.coupons.edit') : t('market.sell.coupons.add')}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2" data-coupon-form>
            <label className="space-y-1 text-sm sm:col-span-2"><span className="font-semibold">{t('market.sell.coupons.code')}</span>
              <Input value={v.code} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} maxLength={20} placeholder={t('market.sell.coupons.codePh')} className="uppercase placeholder:normal-case" name="code" /></label>
            <div className="space-y-1 text-sm"><span className="font-semibold">{t('market.sell.coupons.kind')}</span>
              <div className="flex gap-2">{(['percent', 'amount'] as const).map((k) => (
                <button key={k} type="button" aria-pressed={v.kind === k} onClick={() => set('kind', k)} className={cn('flex-1 rounded-lg border px-2 py-2 font-medium', v.kind === k ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>{t(`market.sell.coupons.${k}`)}</button>
              ))}</div></div>
            <label className="space-y-1 text-sm"><span className="font-semibold">{t('market.sell.coupons.value')}</span>
              <Input inputMode="decimal" value={v.value} onChange={(e) => set('value', Number(e.target.value.replace(/[^\d.]/g, '') || 0))} name="value" /></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">{t('market.sell.coupons.min')}</span>
              <Input inputMode="decimal" value={v.minSpendGhs ?? 0} onChange={(e) => set('minSpendGhs', Number(e.target.value.replace(/[^\d.]/g, '') || 0))} name="min" /></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">{t('market.sell.coupons.maxUses')}</span>
              <Input inputMode="numeric" value={v.maxUses ?? ''} onChange={(e) => set('maxUses', e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null)} name="maxUses" /></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">{t('market.sell.coupons.starts')}</span>
              <Input type="date" value={v.startsAt?.slice(0, 10) ?? ''} onChange={(e) => set('startsAt', e.target.value || null)} /></label>
            <label className="space-y-1 text-sm"><span className="font-semibold">{t('market.sell.coupons.ends')}</span>
              <Input type="date" value={v.endsAt?.slice(0, 10) ?? ''} onChange={(e) => set('endsAt', e.target.value ? `${e.target.value}T23:59:59` : null)} /></label>
            <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={v.active ?? true} onChange={(e) => set('active', e.target.checked)} className="size-4" />{t('market.sell.coupons.active')}</label>
          </div>
          {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
          <DialogFooter><Button disabled={pending || v.code.length < 3} onClick={save} data-save-coupon>{t('market.sell.coupons.save')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function RemoveCoupon({ id }: { id: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [pending, start] = useTransition()
  return <button type="button" disabled={pending} aria-label={t('market.sell.coupons.remove')} onClick={() => start(async () => { if (await removeCouponAction(id)) { toast.success(t('market.sell.coupons.removed')); router.refresh() } })}
    className="rounded-full p-2 text-destructive hover:bg-muted"><Trash2 className="size-4" /></button>
}
