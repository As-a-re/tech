'use client'

import { useState, useTransition } from 'react'
import { HandCoins } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MessageKey } from '@/lib/i18n/config'
import { startGiftAction } from '@/server/actions/payments'

const AMOUNTS = [5, 10, 20, 50, 100, 200]
const PURPOSES = ['offering', 'tithe', 'seed', 'thanksgiving'] as const

/** Offering during a live service (mobile money switches on with Payments). */
export function GiveButton({ liveId, className }: { liveId: string; className?: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<number | null>(20)
  const [other, setOther] = useState('')
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]>('offering')
  const value = amount ?? Number(other)
  const [pending, start] = useTransition()
  const give = () => start(async () => {
    const r = await startGiftAction({ purpose, amountPesewas: Math.round(value * 100), liveId })
    if (!r.ok) { toast.error(t(`give.err.${r.error}` as MessageKey)); return }
    window.location.href = r.url
  })
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-give
        className={cn('flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2 font-black text-black shadow hover:bg-amber-300', className)}><HandCoins className="size-5" />{t('live.giveBtn')}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" data-give-sheet={liveId}>
          <DialogHeader><DialogTitle>{t('live.give.title')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('live.give.lead')}</p>
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('live.give.purpose')}</p>
            <div className="flex flex-wrap gap-2">{PURPOSES.map((p) => <button key={p} type="button" aria-pressed={purpose === p} onClick={() => setPurpose(p)}
              className={cn('rounded-full border px-3 py-1.5 text-sm font-medium', purpose === p ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>{t(`live.give.purposes.${p}`)}</button>)}</div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">{t('live.give.amount')}</p>
            <div className="grid grid-cols-3 gap-2">{AMOUNTS.map((a) => <button key={a} type="button" aria-pressed={amount === a} onClick={() => { setAmount(a); setOther('') }}
              className={cn('rounded-xl border py-3 text-lg font-bold', amount === a ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>{a}</button>)}</div>
            <input inputMode="decimal" placeholder={t('live.give.other')} value={other} onChange={(e) => { setOther(e.target.value.replace(/[^\d.]/g, '')); setAmount(null) }}
              className="h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary" />
          </div>
          <button type="button" disabled={pending || !value || value <= 0} onClick={give} data-give-submit
            className="w-full rounded-full bg-amber-400 py-3 text-lg font-black text-black disabled:opacity-40">{t('live.give.continue')}{value > 0 ? ` · GHS ${value}` : ''}</button>
        </DialogContent>
      </Dialog>
    </>
  )
}
