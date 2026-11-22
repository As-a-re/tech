'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellRing, Minus, Plus, ShoppingCart, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { cn } from '@/lib/utils'
import { addToCartAction, alertAction } from '@/server/actions/market'
import type { Variant } from '@/server/market/catalog'
import { announceCart } from './cart-link'

/** Choose options (size, colour…), quantity, then add to cart or buy now. Out of stock: ask to be told when it's back. */
export function BuyBox({ productId, optionNames, variants, signedIn, isOwner, inCart, stockAlert, priceAlert }: {
  productId: string; optionNames: string[]; variants: Variant[]; signedIn: boolean; isOwner: boolean; inCart: number; stockAlert: boolean; priceAlert: boolean
}) {
  const { t } = useI18n()
  const router = useRouter()
  const first = variants.find((v) => v.stock > 0) ?? variants[0]
  const [picked, setPicked] = useState<Record<string, string>>(first?.options ?? {})
  const [qty, setQty] = useState(1)
  const [alerts, setAlerts] = useState({ stock: stockAlert, price: priceAlert })
  const [pending, start] = useTransition()
  const variant = useMemo(() => variants.find((v) => optionNames.every((n) => v.options[n] === picked[n])) ?? (optionNames.length ? null : variants[0]), [variants, optionNames, picked])
  const values = (name: string) => [...new Set(variants.map((v) => v.options[name]).filter(Boolean))]
  const available = (name: string, value: string) => variants.some((v) => v.options[name] === value && v.stock > 0 && optionNames.every((n) => n === name || !picked[n] || v.options[n] === picked[n]))
  const stock = variant?.stock ?? 0
  const login = `/login?next=${encodeURIComponent(`/market/p/${productId}`)}`

  const add = (thenCart: boolean) => start(async () => {
    if (!variant) { toast.error(t('market.product.choose', { name: optionNames.find((n) => !picked[n]) ?? '' })); return }
    const r = await addToCartAction(variant.id, qty)
    if (!r.ok) { toast.error(t(`market.err.${r.error}` as MessageKey)); return }
    announceCart(r.count)
    if (thenCart) router.push('/cart')
    else toast.success(t('market.product.added'), { action: { label: t('market.product.viewCart'), onClick: () => router.push('/cart') } })
  })
  const toggleAlert = (kind: 'stock' | 'price') => start(async () => {
    const on = !alerts[kind]
    const r = await alertAction(productId, kind, on)
    if (!r.ok) { toast.error(t(`market.err.${r.error}` as MessageKey)); return }
    setAlerts((a) => ({ ...a, [kind]: on }))
    toast.success(on ? t('market.product.alertSet') : t('market.product.alertOff'))
  })

  return (
    <div className="space-y-4" data-buy-box>
      {optionNames.map((name) => (
        <div key={name} className="space-y-2">
          <p className="text-sm font-semibold">{name}{picked[name] && <span className="font-normal text-muted-foreground">: {picked[name]}</span>}</p>
          <div className="flex flex-wrap gap-2">
            {values(name).map((v) => {
              const ok = available(name, v)
              return (
                <button key={v} type="button" aria-pressed={picked[name] === v} data-option={v} onClick={() => { setPicked((p) => ({ ...p, [name]: v })); setQty(1) }}
                  className={cn('min-w-12 rounded-xl border px-3 py-2 text-sm font-semibold', picked[name] === v ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted', !ok && 'text-muted-foreground line-through decoration-1')}>{v}</button>
              )
            })}
          </div>
        </div>
      ))}
      {variant && variants.length > 1 && <p className="text-lg font-bold" data-variant-price>{ghs(variant.pricePesewas)}</p>}
      <p className={cn('text-sm font-semibold', stock > 0 ? (stock <= 5 ? 'text-brand-red' : 'text-green-700 dark:text-green-400') : 'text-muted-foreground')} data-stock={stock}>
        {stock <= 0 ? t('market.product.outOfStock') : stock <= 5 ? t('market.product.left', { n: stock }) : t('market.product.inStock')}
      </p>
      {isOwner ? <p className="rounded-xl bg-muted px-4 py-3 text-sm">{t('market.product.yours')}</p> : !signedIn ? (
        <Link href={login} className="block rounded-full bg-primary py-3 text-center font-bold text-primary-foreground">{t('market.product.signIn')}</Link>
      ) : stock > 0 ? (
        <>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold">{t('market.product.qty')}</p>
            <button type="button" aria-label="−" disabled={qty <= 1} onClick={() => setQty(qty - 1)} className="rounded-full border p-2 disabled:opacity-40"><Minus className="size-4" /></button>
            <b className="w-6 text-center" data-qty>{qty}</b>
            <button type="button" aria-label="+" disabled={qty >= Math.min(50, stock)} onClick={() => setQty(qty + 1)} className="rounded-full border p-2 disabled:opacity-40"><Plus className="size-4" /></button>
            {inCart > 0 && <Link href="/cart" className="ml-auto text-sm text-primary hover:underline">{t('market.product.inCart', { n: inCart })}</Link>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} onClick={() => add(false)} data-add-to-cart className="flex items-center justify-center gap-2 rounded-full border-2 border-primary py-3 font-bold text-primary hover:bg-primary/5 disabled:opacity-50">
              <ShoppingCart className="size-4" />{t('market.product.addToCart')}</button>
            <button type="button" disabled={pending} onClick={() => add(true)} data-buy-now className="rounded-full bg-amber-400 py-3 font-black text-black hover:bg-amber-300 disabled:opacity-50">{t('market.product.buyNow')}</button>
          </div>
        </>
      ) : (
        <button type="button" disabled={pending} onClick={() => toggleAlert('stock')} data-stock-alert={alerts.stock ? 'on' : 'off'}
          className={cn('flex w-full items-center justify-center gap-2 rounded-full py-3 font-bold', alerts.stock ? 'border bg-muted' : 'bg-primary text-primary-foreground')}>
          {alerts.stock ? <BellRing className="size-4" /> : <Bell className="size-4" />}{alerts.stock ? t('market.product.stockAlertOn') : t('market.product.stockAlert')}
        </button>
      )}
      {signedIn && !isOwner && (
        <button type="button" disabled={pending} onClick={() => toggleAlert('price')} data-price-alert={alerts.price ? 'on' : 'off'} className="flex items-center gap-2 text-sm text-primary hover:underline">
          <TrendingDown className="size-4" />{alerts.price ? t('market.product.priceAlertOn') : t('market.product.priceAlert')}
        </button>
      )}
    </div>
  )
}
