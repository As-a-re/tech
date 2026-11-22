'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Textarea } from '@/components/ui/textarea'
import { answerFromInboxAction } from '@/server/actions/market'

/** Answer (or change the answer to) a buyer's question from the seller's inbox. */
export function AnswerInline({ id, initial }: { id: string; initial: string | null }) {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(!initial)
  const [text, setText] = useState(initial ?? '')
  const [pending, start] = useTransition()
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-primary hover:underline">{t('market.qa.answer')}</button>
  return (
    <div className="space-y-2">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={2} placeholder={t('market.qa.answerPh')} aria-label={t('market.qa.answer')} data-inbox-answer={id} />
      <button type="button" disabled={pending || !text.trim()} data-inbox-save={id} onClick={() => start(async () => {
        const r = await answerFromInboxAction(id, text)
        if (!r.ok) toast.error(t(`market.err.${r.error}` as MessageKey)); else { toast.success(t('market.qa.answered')); setOpen(false); router.refresh() }
      })} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">{t('market.qa.answer')}</button>
    </div>
  )
}
