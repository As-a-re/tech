'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { alertAction, wishlistAction } from '@/server/actions/market'

export function RemoveWish({ productId, label }: { productId: string; label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button type="button" disabled={pending} aria-label={label} title={label} onClick={() => start(async () => { await wishlistAction(productId, false); router.refresh() })}
      className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-black"><X className="size-4" /></button>
  )
}

export function RemoveAlert({ productId, kind, label }: { productId: string; kind: 'stock' | 'price'; label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return <button type="button" disabled={pending} onClick={() => start(async () => { await alertAction(productId, kind, false); router.refresh() })} className="rounded-full border px-3 py-1 text-sm hover:bg-muted">{label}</button>
}
