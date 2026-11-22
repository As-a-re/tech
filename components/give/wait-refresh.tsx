'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** While a mobile money payment is still being confirmed, check again every few seconds. */
export function WaitRefresh({ every = 4000, max = 30 }: { every?: number; max?: number }) {
  const router = useRouter()
  useEffect(() => {
    let n = 0
    const id = setInterval(() => { if (++n > max) clearInterval(id); else router.refresh() }, every)
    return () => clearInterval(id)
  }, [router, every, max])
  return null
}
