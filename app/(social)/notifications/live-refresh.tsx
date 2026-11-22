'use client'

import { useRouter } from 'next/navigation'
import { useLive } from '@/hooks/use-live'

/** New notification while this page is open → reload the list. */
export function LiveRefresh() {
  const router = useRouter()
  useLive((e) => { if (e.kind === 'notification') router.refresh() })
  return null
}
