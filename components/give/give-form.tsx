'use client'

import { useState, useTransition } from 'react'
import { HandCoins, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { startGiftAction } from '@/server/actions/payments'

const AMOUNTS = [10, 20, 50, 100, 200, 500]
const PURPOSES = ['offering', 'tithe', 'seed', 'thanksgiving', 'welfare'] as const
type Purpose = (typeof PURPOSES)[number]

/** Choose what for, where to, and how much; then pay on the secure page. */
export function GiveForm({ assemblyName, districtName, fundId, liveId, initialPurpose = 'offering', compact }: {
  assemblyName: string; districtName: string; fundId?: string; liveId?: string; initialPurpose?: Purpose; compact?: boolean
}) {
  const { t } = useI18n()
  const [purpose, setPurpose] = useState<Purpose>(initialPurpose)
  const [level, setLevel] = useState<'local' | 'district' | 'national'>('local')
  const [amount, setAmount] = useState<number | null>(compact ? 20 : 50)
  const [other, setOther] = useState('')
  const [note, setNote] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [pending, start] = useTransition()
  const value = amount ?? Number(other || 0)
  const give = () => start(async () => {
    const r = await startGiftAction({ purpose: fundId ? 'project' : purpose, amountPesewas: Math.round(value * 100), level, fundId: fundId ?? null, liveId: liveId ?? null, note, anonymous })
    if (!r.ok) { toast.error(t(`give.err.${r.error}` as MessageKey)); return }
    window.location.href = r.url
  })
  const chip = (on: boolean) => cn('rounded-full border px-3.5 py-1.5 text-sm font-medium', on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')
  return (
    <div className="space-y-5" data-give-form>
      {!fundId && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">{PURPOSES.map((p) => <button key={p} type="button" aria-pressed={purpose === p} onClick={() => setPurpose(p)} className={chip(purpose === p)}>{t(`give.purposes.${p}`)}</button>)}</div>
        </div>
      )}
      {!fundId && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t('give.to')}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {([['local', t('give.toLocal'), assemblyName], ['district', t('give.toDistrict'), districtName], ['national', t('give.toNational'), 'Christ Anointed Church']] as const).map(([k, label, name]) => (
              <button key={k} type="button" aria-pressed={level === k} onClick={() => setLevel(k)}
                className={cn('rounded-xl border p-3 text-left', level === k ? 'border-primary bg-primary/5' : 'hover:bg-muted')}><b className="block text-sm">{label}</b><span className="text-xs text-muted-foreground">{name}</span></button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <p className="text-sm font-semibold">{t('give.amount')}</p>
        <div className="grid grid-cols-3 gap-2">{AMOUNTS.map((a) => (
          <button key={a} type="button" aria-pressed={amount === a} onClick={() => { setAmount(a); setOther('') }}
            className={cn('rounded-xl border py-3 text-lg font-bold', amount === a ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>{a}</button>
        ))}</div>
        <input name="other" inputMode="decimal" placeholder={t('give.other')} value={other} onChange={(e) => { setOther(e.target.value.replace(/[^\d.]/g, '')); setAmount(null) }}
          className="h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary" />
      </div>
      {!compact && <input name="note" maxLength={200} placeholder={t('give.notePh')} aria-label={t('give.note')} value={note} onChange={(e) => setNote(e.target.value)} className="h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary" />}
      <label className="flex items-start gap-3"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 size-4" />
        <span><span className="block text-sm font-medium">{t('give.anonymous')}</span><span className="text-xs text-muted-foreground">{t('give.anonymousHint')}</span></span></label>
      <button type="button" disabled={pending || !(value >= 1)} onClick={give} data-give-submit
        className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 py-3.5 text-lg font-black text-black shadow hover:bg-amber-300 disabled:opacity-40">
        <HandCoins className="size-5" />{value >= 1 ? t('give.giveNow', { amount: `GHS ${value.toLocaleString('en-GH')}` }) : t('give.choose')}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground"><Lock className="size-3.5" />{t('give.secure')}</p>
    </div>
  )
}
