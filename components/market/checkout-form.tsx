'use client'

import { useState, useTransition } from 'react'
import { MapPin, ShieldCheck, Store, Tag, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { placeOrderAction, quoteAction } from '@/server/actions/market'
import type { Address, CheckoutChoice, Fulfilment, QuoteGroup } from '@/server/market/cart'

type Shop = {
  id: string; name: string; offersPickup: boolean; offersDelivery: boolean; pickupAddress: string | null; deliveryNote: string | null
  lines: { id: string; title: string; variantName: string; image: string | null; qty: number; unitPesewas: number; stock: number }[]
}

/** Delivery or pickup per shop, address, coupons, then one payment for everything. */
export function CheckoutForm({ shops, initial, address }: { shops: Shop[]; initial: QuoteGroup[]; address: Address }) {
  const { t } = useI18n()
  const [groups, setGroups] = useState(initial)
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [addr, setAddr] = useState<Address>(address)
  const [error, setError] = useState<{ msg: string; shopId?: string } | null>(null)
  const [pending, start] = useTransition()
  const choices = (patch?: { shopId: string; fulfilment?: Fulfilment; coupon?: string | null }): CheckoutChoice[] => groups.map((g) => ({
    shopId: g.shopId, fulfilment: patch?.shopId === g.shopId && patch.fulfilment ? patch.fulfilment : g.fulfilment,
    coupon: patch?.shopId === g.shopId && patch.coupon !== undefined ? patch.coupon : g.coupon,
  }))
  const requote = (patch: { shopId: string; fulfilment?: Fulfilment; coupon?: string | null }) => start(async () => {
    const q = await quoteAction(choices(patch))
    setGroups(q.groups)
    const g = q.groups.find((x) => x.shopId === patch.shopId)
    if (patch.coupon && g?.couponError) toast.error(t(`market.err.${g.couponError}` as MessageKey))
    else if (patch.coupon && g?.coupon) toast.success(t('market.checkout.couponOk', { code: g.coupon }))
  })
  const total = groups.reduce((a, g) => a + g.totalPesewas, 0)
  const needsAddress = groups.some((g) => g.fulfilment === 'delivery')
  const pay = () => start(async () => {
    setError(null)
    const r = await placeOrderAction(choices(), needsAddress ? addr : null)
    if (!r.ok) { setError({ msg: t(`market.err.${r.error}` as MessageKey), shopId: r.shopId }); return }
    window.location.href = r.url
  })
  const field = (k: keyof Address, label: string, opts: { type?: string; autoComplete?: string; optional?: boolean } = {}) => (
    <label className="space-y-1 text-sm"><span className="font-medium">{label}</span>
      <Input value={addr[k] ?? ''} onChange={(e) => setAddr({ ...addr, [k]: e.target.value })} type={opts.type} autoComplete={opts.autoComplete} name={k} required={!opts.optional} /></label>
  )
  return (
    <div className="space-y-4 px-4 py-4" data-checkout-form>
      {shops.map((s) => {
        const g = groups.find((x) => x.shopId === s.id)
        if (!g) return null
        return (
          <section key={s.id} className={cn('space-y-3 rounded-2xl border p-4', error?.shopId === s.id && 'border-destructive')} data-checkout-shop={s.id}>
            <h2 className="flex items-center gap-2 font-bold"><Store className="size-4 text-primary" />{s.name}</h2>
            <ul className="space-y-2">{s.lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 text-sm">
                <span className="size-12 shrink-0 overflow-hidden rounded-lg border bg-muted">{l.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.image} alt="" className="size-full object-cover" />}</span>
                <span className="min-w-0 flex-1"><span className="line-clamp-1 font-medium">{l.title}</span><span className="text-muted-foreground">{[l.variantName, `× ${l.qty}`].filter(Boolean).join(' · ')}</span></span>
                <b>{ghs(l.unitPesewas * l.qty)}</b>
              </li>))}</ul>
            <fieldset className="space-y-2"><legend className="text-sm font-semibold">{t('market.checkout.how')}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['delivery', 'pickup'] as const).map((f) => {
                  const ok = f === 'delivery' ? s.offersDelivery : s.offersPickup
                  const Icon = f === 'delivery' ? Truck : MapPin
                  return (
                    <button key={f} type="button" disabled={!ok || pending} aria-pressed={g.fulfilment === f} data-fulfilment={f} onClick={() => requote({ shopId: s.id, fulfilment: f })}
                      className={cn('flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold', g.fulfilment === f ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted', !ok && 'opacity-40')}>
                      <Icon className="size-4" />{t(`market.checkout.${f}`)}</button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">{g.fulfilment === 'pickup' ? (s.pickupAddress ? t('market.checkout.pickupAt', { place: s.pickupAddress }) : t('market.checkout.pickupArrange')) : s.deliveryNote}</p>
            </fieldset>
            <div className="flex gap-2">
              <span className="relative flex-1"><Tag className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={codes[s.id] ?? g.coupon ?? ''} onChange={(e) => setCodes({ ...codes, [s.id]: e.target.value.toUpperCase() })} placeholder={t('market.checkout.coupon')} aria-label={t('market.checkout.coupon')} className="pl-9 uppercase placeholder:normal-case" data-coupon-input /></span>
              <button type="button" disabled={pending || (codes[s.id] ?? g.coupon ?? '').trim() === (g.coupon ?? '')} onClick={() => requote({ shopId: s.id, coupon: (codes[s.id] ?? '').trim() || null })} data-apply-coupon className="rounded-full border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-40">{t('market.checkout.apply')}</button>
            </div>
            <dl className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">{t('market.checkout.items')}</dt><dd>{ghs(g.subtotalPesewas)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{t('market.checkout.deliveryFee')}</dt><dd data-delivery-fee={g.deliveryFeePesewas}>{g.deliveryFeePesewas ? ghs(g.deliveryFeePesewas) : t('market.checkout.free')}</dd></div>
              {g.discountPesewas > 0 && <div className="flex justify-between text-green-700 dark:text-green-400"><dt>{t('market.checkout.discount')} ({g.coupon})</dt><dd data-discount={g.discountPesewas}>−{ghs(g.discountPesewas)}</dd></div>}
              <div className="flex justify-between font-bold"><dt>{t('market.checkout.orderTotal')}</dt><dd>{ghs(g.totalPesewas)}</dd></div>
            </dl>
          </section>
        )
      })}
      {needsAddress && (
        <section className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2" data-address>
          <h2 className="font-bold sm:col-span-2">{t('market.checkout.address')}</h2>
          {field('name', t('market.checkout.name'), { autoComplete: 'name' })}
          {field('phone', t('market.checkout.phone'), { type: 'tel', autoComplete: 'tel' })}
          {field('town', t('market.checkout.town'), { autoComplete: 'address-level2' })}
          {field('landmark', t('market.checkout.landmark'), { optional: true })}
          <div className="sm:col-span-2">{field('address', t('market.checkout.street'), { autoComplete: 'street-address' })}</div>
          <div className="sm:col-span-2">{field('note', t('market.checkout.note'), { optional: true })}</div>
        </section>
      )}
      <div className="space-y-3 rounded-2xl border p-4">
        <p className="flex justify-between text-lg"><span className="font-semibold">{t('market.checkout.total')}</span><b data-grand-total={total}>{ghs(total)}</b></p>
        {error && <p role="alert" className="text-sm font-semibold text-destructive">{error.msg}</p>}
        <button type="button" disabled={pending || !groups.length} onClick={pay} data-pay className="w-full rounded-full bg-amber-400 py-3.5 text-lg font-black text-black hover:bg-amber-300 disabled:opacity-50">{t('market.checkout.pay', { amount: ghs(total) })}</button>
        <p className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-primary" />{t('market.checkout.payNote')}</p>
      </div>
    </div>
  )
}
