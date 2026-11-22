'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { applyRiderAction, updateRiderAction } from '@/server/actions/market'
import type { RiderInput } from '@/server/market/riders'

const input = 'h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary'
const VEHICLES = ['motorbike', 'car', 'bicycle', 'foot'] as const
const NETS = ['mtn', 'telecel', 'airteltigo'] as const

/** Rider application and rider settings. */
export function RiderForm({ initial, mode }: { initial: RiderInput; mode: 'apply' | 'edit' }) {
  const { t } = useI18n()
  const router = useRouter()
  const [v, setV] = useState<RiderInput>(initial)
  const [areas, setAreas] = useState(initial.areas.join(', '))
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const set = <K extends keyof RiderInput>(k: K, val: RiderInput[K]) => setV((x) => ({ ...x, [k]: val }))
  const save = () => start(async () => {
    setError('')
    const data = { ...v, areas: areas.split(',').map((a) => a.trim()).filter(Boolean) }
    const r = mode === 'apply' ? await applyRiderAction(data) : await updateRiderAction(data)
    if (!r.ok) { setError(t(`market.ride.err.${r.error}` as MessageKey)); return }
    toast.success(mode === 'apply' ? t('market.ride.become.applied') : t('market.ride.form.saved')); router.refresh()
  })
  return (
    <form onSubmit={(e) => { e.preventDefault(); save() }} className="space-y-4 px-4 py-5" data-rider-form={mode}>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.ride.form.phone')}</span>
        <input name="phone" type="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} className={input} required /></label>
      <fieldset className="space-y-1"><legend className="text-sm font-semibold">{t('market.ride.form.vehicle')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{VEHICLES.map((k) => (
          <button key={k} type="button" aria-pressed={v.vehicle === k} onClick={() => set('vehicle', k)} data-vehicle={k}
            className={cn('rounded-lg border px-2 py-2.5 text-sm font-medium', v.vehicle === k ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>{t(`market.ride.vehicle.${k}`)}</button>
        ))}</div></fieldset>
      {(v.vehicle === 'motorbike' || v.vehicle === 'car') && <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.ride.form.plate')}</span>
        <input name="plate" maxLength={20} value={v.plate ?? ''} onChange={(e) => set('plate', e.target.value)} className={cn(input, 'uppercase')} /></label>}
      <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.ride.form.areas')}</span>
        <input name="areas" value={areas} onChange={(e) => setAreas(e.target.value)} placeholder={t('market.ride.form.areasPh')} className={input} required />
        <span className="text-xs text-muted-foreground">{t('market.ride.form.areasHint')}</span></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.ride.form.about')}</span>
        <textarea name="about" rows={2} maxLength={500} value={v.about ?? ''} onChange={(e) => set('about', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" /></label>
      <section className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-3">
        <h2 className="font-bold sm:col-span-3">{t('market.ride.form.payout')}</h2>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.ride.form.network')}</span>
          <select value={v.payoutProvider} onChange={(e) => set('payoutProvider', e.target.value)} className={input}>{NETS.map((n) => <option key={n} value={n}>{t(`market.sell.form.${n}`)}</option>)}</select></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.ride.form.number')}</span>
          <input name="payoutNumber" inputMode="numeric" value={v.payoutNumber} onChange={(e) => set('payoutNumber', e.target.value)} className={input} required /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.ride.form.name')}</span>
          <input name="payoutName" maxLength={80} value={v.payoutName} onChange={(e) => set('payoutName', e.target.value)} className={input} required /></label>
      </section>
      {mode === 'apply' && (
        <label className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <input type="checkbox" checked={!!v.acceptTerms} onChange={(e) => set('acceptTerms', e.target.checked)} className="mt-0.5 size-5 accent-[var(--primary)]" data-rider-terms />
          <span><b>{t('market.ride.become.terms')}</b>
            <span className="mt-1 block text-muted-foreground">{(['rule1', 'rule2', 'rule3'] as const).map((r) => <span key={r} className="block">• {t(`market.ride.become.${r}`)}</span>)}</span></span>
        </label>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full rounded-full" disabled={pending || (mode === 'apply' && !v.acceptTerms)} data-save-rider>{mode === 'apply' ? t('market.ride.become.apply') : t('market.ride.form.save')}</Button>
    </form>
  )
}
