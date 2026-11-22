'use client'

import { useTransition } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { saveForLaterAction, setCartQtyAction } from '@/server/actions/market'
import { announceCart } from './cart-link'

/** Quantity stepper, remove, save for later / move to cart. */
export function CartLineControls({ id, qty, max, saved, available }: { id: string; qty: number; max: number; saved: boolean; available: boolean }) {
  const { t } = useI18n()
  const [pending, start] = useTransition()
  const run = (p: Promise<{ ok: boolean; count?: number; error?: string }>) => start(async () => {
    const r = await p
    if (!r.ok) toast.error(t(`market.err.${r.error}` as MessageKey))
    else if (typeof r.count === 'number') announceCart(r.count)
  })
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
      {!saved && available && (
        <span className="flex items-center gap-2">
          <button type="button" aria-label="−" disabled={pending || qty <= 1} onClick={() => run(setCartQtyAction(id, qty - 1))} className="rounded-full border p-1.5 disabled:opacity-40"><Minus className="size-3.5" /></button>
          <b className="w-6 text-center text-sm" data-line-qty>{qty}</b>
          <button type="button" aria-label="+" disabled={pending || qty >= max} onClick={() => run(setCartQtyAction(id, qty + 1))} className="rounded-full border p-1.5 disabled:opacity-40"><Plus className="size-3.5" /></button>
        </span>
      )}
      {available && <button type="button" disabled={pending} onClick={() => run(saveForLaterAction(id, !saved))} className="text-sm font-semibold text-primary hover:underline">{saved ? t('market.cart.moveToCart') : t('market.cart.saveLater')}</button>}
      <button type="button" disabled={pending} onClick={() => run(setCartQtyAction(id, 0))} data-remove-line className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" />{t('market.cart.remove')}</button>
    </div>
  )
}
