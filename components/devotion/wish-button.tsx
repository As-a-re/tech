'use client'

import { PartyPopper } from 'lucide-react'
import { useCompose } from '@/components/posts/compose-provider'

/** Opens a new post already addressed to the person (they're mentioned, so they're notified). */
export function WishButton({ text, label }: { text: string; label: string }) {
  const { openCompose } = useCompose()
  return (
    <button type="button" onClick={() => openCompose({ mode: 'post', text })} className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted">
      <PartyPopper className="size-4 text-brand-red" />{label}
    </button>
  )
}
