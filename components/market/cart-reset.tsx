'use client'

import { useEffect } from 'react'
import { fetchCounts } from '@/lib/live-fetch'
import { announceCart } from './cart-link'

/** After checking out, the cart badges catch up with what's left in the cart. */
export function CartReset() {
  useEffect(() => { fetchCounts().then((c) => c && typeof c.cart === 'number' && announceCart(c.cart)) }, [])
  return null
}
