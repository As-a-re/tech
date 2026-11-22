'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Truck, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ImagePicker, toPicked, type PickedImage } from '@/components/common/image-picker'
import { openShopAction, updateShopAction } from '@/server/actions/market'
import type { ShopInput } from '@/server/market/seller'

const input = 'h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary'
const PROVIDERS = ['mtn', 'telecel', 'airteltigo'] as const

/** Opening a shop ("Become a seller") and Shop settings use the same form. */
export function ShopForm({ initial, mode }: { initial: ShopInput; mode: 'open' | 'edit' }) {
  const { t } = useI18n()
  const router = useRouter()
  const [v, setV] = useState<ShopInput>(initial)
  const set = <K extends keyof ShopInput>(k: K, val: ShopInput[K]) => setV((x) => ({ ...x, [k]: val }))
  const [logo, setLogo] = useState<PickedImage[]>(toPicked(initial.logoUrl ? [{ url: initial.logoUrl }] : []))
  const [cover, setCover] = useState<PickedImage[]>(toPicked(initial.coverUrl ? [{ url: initial.coverUrl }] : []))
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/[^\d.]/g, '')))
  const submit = () => start(async () => {
    setError('')
    if ([...logo, ...cover].some((i) => i.uploading)) return
    const data = { ...v, logoUrl: logo[0]?.url ?? null, coverUrl: cover[0]?.url ?? null }
    const r = mode === 'open' ? await openShopAction(data) : await updateShopAction(data)
    if (!r.ok) { setError(t(`market.sell.err.${r.error}` as MessageKey)); return }
    if (mode === 'open') { toast.success(t('market.sell.form.opened')); router.push('/market/sell/products/new') }
    else { toast.success(t('market.sell.form.saved')); router.refresh() }
  })
  const check = (k: 'offersPickup' | 'offersDelivery', label: string, Icon: typeof Truck) => (
    <label className={cn('flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold', v[k] ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>
      <input type="checkbox" checked={v[k]} onChange={(e) => set(k, e.target.checked)} className="size-4 accent-[var(--primary)]" data-check={k} /><Icon className="size-4" />{label}
    </label>
  )
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-5 px-4 py-5" data-shop-form={mode}>
      <section className="space-y-4">
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.name')}</span>
          <input name="name" required maxLength={60} value={v.name} onChange={(e) => set('name', e.target.value)} placeholder={t('market.sell.form.namePh')} className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.bio')}</span>
          <textarea name="bio" rows={3} maxLength={1000} value={v.bio ?? ''} onChange={(e) => set('bio', e.target.value)} placeholder={t('market.sell.form.bioPh')} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="max-w-40 space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.logo')}</span>
            <ImagePicker value={logo} onChange={setLogo} max={1} label={t('market.sell.form.logo')} onError={() => setError(t('market.sell.err.upload'))} /></div>
          <div className="space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.cover')}</span>
            <ImagePicker value={cover} onChange={setCover} max={1} wide label={t('market.sell.form.cover')} onError={() => setError(t('market.sell.err.upload'))} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.town')}</span>
            <input name="town" maxLength={60} value={v.town ?? ''} onChange={(e) => set('town', e.target.value)} className={input} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.phone')}</span>
            <input name="phone" type="tel" value={v.phone ?? ''} onChange={(e) => set('phone', e.target.value)} className={input} /></label>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border p-4">
        <h2 className="font-bold">{t('market.sell.form.how')}</h2>
        <div className="grid grid-cols-2 gap-2">{check('offersPickup', t('market.sell.form.pickup'), MapPin)}{check('offersDelivery', t('market.sell.form.delivery'), Truck)}</div>
        {v.offersPickup && <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.pickupAddress')}</span>
          <input name="pickupAddress" maxLength={200} value={v.pickupAddress ?? ''} onChange={(e) => set('pickupAddress', e.target.value)} placeholder={t('market.sell.form.pickupPh')} className={input} /></label>}
        {v.offersDelivery && <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.fee')}</span>
            <input name="fee" inputMode="decimal" value={v.deliveryFeeGhs ?? 0} onChange={(e) => set('deliveryFeeGhs', num(e.target.value) ?? 0)} className={input} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.freeOver')}</span>
            <input name="freeOver" inputMode="decimal" value={v.freeDeliveryOverGhs ?? ''} onChange={(e) => set('freeDeliveryOverGhs', num(e.target.value))} className={input} /></label>
          <label className="block space-y-1 sm:col-span-2"><span className="text-sm font-semibold">{t('market.sell.form.deliveryNote')}</span>
            <input name="deliveryNote" maxLength={200} value={v.deliveryNote ?? ''} onChange={(e) => set('deliveryNote', e.target.value)} placeholder={t('market.sell.form.deliveryNotePh')} className={input} /></label>
        </div>}
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.returns')}</span>
          <input name="returnDays" inputMode="numeric" value={v.returnDays ?? 7} onChange={(e) => set('returnDays', Number(e.target.value.replace(/\D/g, '') || 0))} className={cn(input, 'max-w-28')} /></label>
      </section>

      <section id="payout" className="scroll-mt-32 space-y-3 rounded-2xl border p-4" data-payout>
        <h2 className="flex items-center gap-2 font-bold"><Wallet className="size-4 text-primary" />{t('market.sell.form.payout')}</h2>
        <p className="text-sm text-muted-foreground">{t('market.sell.form.payoutLead')}</p>
        <div className="flex flex-wrap gap-2">{([null, 'momo', 'bank'] as const).map((m) => (
          <button key={m ?? 'none'} type="button" aria-pressed={v.payoutMethod === m || (!m && !v.payoutMethod)} data-payout-method={m ?? 'none'}
            onClick={() => setV((x) => ({ ...x, payoutMethod: m, payoutProvider: m === 'momo' ? 'mtn' : m === 'bank' ? '' : null }))}
            className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', (v.payoutMethod ?? null) === m ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
            {m ? t(`market.sell.form.${m}`) : t('market.sell.form.payoutNone')}</button>
        ))}</div>
        {v.payoutMethod && <div className="grid gap-3 sm:grid-cols-3">
          {v.payoutMethod === 'momo' ? (
            <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.network')}</span>
              <select value={v.payoutProvider ?? 'mtn'} onChange={(e) => set('payoutProvider', e.target.value)} className={input}>{PROVIDERS.map((p) => <option key={p} value={p}>{t(`market.sell.form.${p}`)}</option>)}</select></label>
          ) : (
            <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.bankName')}</span>
              <input name="bank" maxLength={60} value={v.payoutProvider ?? ''} onChange={(e) => set('payoutProvider', e.target.value)} className={input} /></label>
          )}
          <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.number')}</span>
            <input name="payoutNumber" inputMode="numeric" value={v.payoutNumber ?? ''} onChange={(e) => set('payoutNumber', e.target.value)} className={input} /></label>
          <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.form.accountName')}</span>
            <input name="payoutName" maxLength={80} value={v.payoutName ?? ''} onChange={(e) => set('payoutName', e.target.value)} className={input} /></label>
        </div>}
      </section>

      {mode === 'open' && (
        <label className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <input type="checkbox" checked={!!v.acceptTerms} onChange={(e) => set('acceptTerms', e.target.checked)} className="mt-0.5 size-5 accent-[var(--primary)]" data-terms />
          <span><b>{t('market.sell.form.terms')}</b>
            <span className="mt-1 block space-y-1 text-muted-foreground">{(['rule1', 'rule2', 'rule3', 'rule4'] as const).map((r) => <span key={r} className="block">• {t(`market.sell.become.${r}`)}</span>)}</span></span>
        </label>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full rounded-full" disabled={pending || !v.name.trim() || (mode === 'open' && !v.acceptTerms)} data-save-shop>
        {mode === 'open' ? t('market.sell.form.open') : t('market.sell.form.save')}</Button>
    </form>
  )
}
