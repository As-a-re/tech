'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { wishlistAction } from '@/server/actions/market'

/** Heart: save to (or remove from) the wishlist. */
export function WishButton({ productId, initial, signedIn, className }: { productId: string; initial: boolean; signedIn: boolean; className?: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  const click = () => {
    if (!signedIn) { router.push(`/login?next=${encodeURIComponent(`/market/p/${productId}`)}`); return }
    const next = !on
    setOn(next)
    start(async () => { const r = await wishlistAction(productId, next); if (!r.ok) { setOn(!next); toast.error(t(`market.err.${r.error}` as MessageKey)) } })
  }
  return (
    <button type="button" disabled={pending} onClick={click} aria-pressed={on} data-wish={on ? 'on' : 'off'} aria-label={on ? t('market.product.wishlisted') : t('market.product.wishlist')}
      title={on ? t('market.product.wishlisted') : t('market.product.wishlist')} className={cn('flex size-10 items-center justify-center rounded-full border bg-background hover:bg-muted', className)}>
      <Heart className={cn('size-5', on && 'fill-brand-red text-brand-red')} />
    </button>
  )
}
