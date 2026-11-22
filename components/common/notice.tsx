'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'

/** Shows a one-off success message, then removes ?notice= from the address bar. */
export function Notice({ message }: { message: string }) {
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    // wait one tick so the toast area (mounted by the root layout) is listening
    const id = setTimeout(() => { toast.success(message); router.replace(pathname, { scroll: false }) }, 50)
    return () => clearTimeout(id)
  }, [message, router, pathname])
  return null
}
