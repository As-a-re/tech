'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { reportAction } from '@/server/actions/discovery'
import type { ReportTarget } from '@/server/moderation/reports'

const REASONS = ['spam', 'abuse', 'false_info', 'inappropriate', 'impersonation', 'other'] as const

export function ReportDialog({ target, title, open, onOpenChange }: {
  target: ReportTarget; title: string; open: boolean; onOpenChange: (o: boolean) => void
}) {
  const { t } = useI18n()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const send = () => start(async () => {
    const r = await reportAction(target, reason, details)
    if (r.ok) { toast.success(t('report.sent')); onOpenChange(false); setReason(''); setDetails(''); setError('') }
    else setError(t(`report.err.${r.error}` as MessageKey))
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{t('report.lead')}</DialogDescription></DialogHeader>
        <fieldset className="space-y-1" aria-label={t('report.title')}>
          {REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted">
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--primary)]" />
              <span className="text-[15px]">{t(`report.reasons.${r}`)}</span>
            </label>
          ))}
        </fieldset>
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={2} placeholder={t('report.details')} aria-label={t('report.details')} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter><Button disabled={!reason || pending} onClick={send}>{t('report.send')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
