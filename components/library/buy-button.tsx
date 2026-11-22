'use client'

import { useTransition } from 'react'
import { ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { buyPublicationAction } from '@/server/actions/payments'

/** Buy a paid publication (mobile money or card); it opens in full once paid. */
export function BuyButton({ id, label }: { id: string; label: string }) {
  const { t } = useI18n()
  const [pending, start] = useTransition()
  return (
    <button type="button" disabled={pending} data-buy onClick={() => start(async () => {
      const r = await buyPublicationAction(id)
      if (!r.ok) { toast.error(t(`give.err.${r.error}` as MessageKey)); return }
      window.location.href = r.url
    })} className="flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 font-black text-black hover:bg-amber-300 disabled:opacity-50"><ShoppingBag className="size-4" />{label}</button>
  )
}
