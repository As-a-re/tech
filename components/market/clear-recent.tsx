'use client'

import { useTransition } from 'react'
import { clearRecentAction } from '@/server/actions/market'

export function ClearRecent({ label }: { label: string }) {
  const [pending, start] = useTransition()
  return <button type="button" disabled={pending} onClick={() => start(() => clearRecentAction())} className="text-sm text-muted-foreground hover:underline">{label}</button>
}
