'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ShoppingCart } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { useLive } from '@/hooks/use-live'
import { fetchCounts } from '@/lib/live-fetch'
import { isActive } from '@/lib/navigation'
import { cn } from '@/lib/utils'

/** Tells every cart badge on the page the new count (after adding, removing or checking out). */
export function announceCart(count: number) {
  window.dispatchEvent(new CustomEvent('papa:cart', { detail: count }))
}

function useCartCount(initial: number) {
  const [count, setCount] = useState(initial)
  useEffect(() => setCount(initial), [initial])
  useEffect(() => {
    const on = (e: Event) => setCount(Number((e as CustomEvent).detail) || 0)
    window.addEventListener('papa:cart', on)
    return () => window.removeEventListener('papa:cart', on)
  }, [])
  useLive((e) => { if (e.kind === 'hello') fetchCounts().then((c) => c && typeof c.cart === 'number' && setCount(c.cart)) })
  return count
}

const Badge = ({ n }: { n: number }) => n > 0 ? <span data-cart-count={n} className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[11px] font-bold text-white">{n > 99 ? '99+' : n}</span> : null

/** Cart button in the top bar (computers). */
export function CartLink({ initial, className }: { initial: number; className?: string }) {
  const { t } = useI18n()
  const n = useCartCount(initial)
  return <Link href="/cart" aria-label={`${t('nav.cart')}${n ? ` (${n})` : ''}`} className={cn('relative', className)}><ShoppingCart className="size-[18px]" /><Badge n={n} /></Link>
}

/** Cart tab in the phone's bottom bar. */
export function CartTab({ initial }: { initial: number }) {
  const { t } = useI18n()
  const pathname = usePathname()
  const n = useCartCount(initial)
  const active = isActive(pathname, '/cart')
  return (
    <Link href="/cart" aria-current={active ? 'page' : undefined} aria-label={`${t('nav.cart')}${n ? ` (${n})` : ''}`}
      className={cn('flex h-full flex-col items-center justify-center gap-0.5 text-[11px]', active ? 'font-semibold text-primary' : 'text-muted-foreground')}>
      <span className="relative"><ShoppingCart className="size-[22px]" strokeWidth={active ? 2.4 : 1.8} /><Badge n={n} /></span>{t('nav.cart')}
    </Link>
  )
}
