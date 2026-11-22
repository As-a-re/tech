'use client'

import { useState, useTransition } from 'react'
import { Minus, Plus, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { ghs } from '@/lib/give/money'
import { orderResourceAction } from '@/server/actions/resources'

/** Uniform: choose size and quantity, then pay. Study guide: buy. */
export function OrderForm({ id, kind, price, sizes }: { id: string; kind: 'uniform' | 'study_guide'; price: number; sizes: { size: string; stock: number }[] }) {
  const { t } = useI18n()
  const [size, setSize] = useState<string | null>(sizes.find((s) => s.stock > 0)?.size ?? null)
  const [qty, setQty] = useState(1)
  const [pending, start] = useTransition()
  const left = sizes.find((s) => s.size === size)?.stock ?? 0
  const order = () => start(async () => {
    const r = await orderResourceAction(id, kind === 'uniform' ? size : null, kind === 'uniform' ? qty : 1)
    if (!r.ok) { toast.error(t(`res.err.${r.error}` as MessageKey)); return }
    window.location.href = r.url
  })
  if (kind === 'study_guide') return (
    <button type="button" disabled={pending} onClick={order} data-order className="flex items-center gap-2 rounded-full bg-amber-400 px-6 py-2.5 font-black text-black hover:bg-amber-300 disabled:opacity-50"><ShoppingBag className="size-4" />{t('res.buy', { amount: ghs(price) })}</button>
  )
  return (
    <div className="space-y-4" data-order-form>
      <div className="space-y-2">
        <p className="text-sm font-semibold">{t('res.size')}</p>
        <div className="flex flex-wrap gap-2">{sizes.map((s) => (
          <button key={s.size} type="button" disabled={s.stock === 0} aria-pressed={size === s.size} onClick={() => { setSize(s.size); setQty(1) }}
            className={cn('min-w-14 rounded-xl border px-3 py-2 text-center', size === s.size ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted', s.stock === 0 && 'opacity-40 line-through')}>
            <b className="block">{s.size}</b><span className="text-[11px] text-muted-foreground">{s.stock === 0 ? t('res.soldOut') : t('res.left', { n: s.stock })}</span>
          </button>
        ))}</div>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold">{t('res.qty')}</p>
        <button type="button" aria-label="−" disabled={qty <= 1} onClick={() => setQty(qty - 1)} className="rounded-full border p-2 disabled:opacity-40"><Minus className="size-4" /></button>
        <b className="w-6 text-center" data-qty>{qty}</b>
        <button type="button" aria-label="+" disabled={qty >= Math.min(20, left)} onClick={() => setQty(qty + 1)} className="rounded-full border p-2 disabled:opacity-40"><Plus className="size-4" /></button>
      </div>
      <button type="button" disabled={pending || !size || left < qty} onClick={order} data-order
        className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 py-3.5 text-lg font-black text-black hover:bg-amber-300 disabled:opacity-40">
        <ShoppingBag className="size-5" />{t('res.order', { amount: ghs(price * qty) })}
      </button>
    </div>
  )
}
