'use client'

import { useState, useTransition } from 'react'
import { Delete } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { enterKidsModeAction, exitKidsModeAction } from '@/server/actions/library'

/** A big number pad for the 4-digit parent PIN. */
function PinPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n()
  return (
    <div className="mx-auto w-64 space-y-4">
      <div className="flex justify-center gap-3" aria-live="polite" data-pin-dots={value.length}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={cn('size-4 rounded-full border-2 border-primary', i < value.length && 'bg-primary')} />)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => k === '' ? <span key="x" /> : (
          <button key={k} type="button" aria-label={k === 'del' ? t('profile.cancel') : k} onClick={() => onChange(k === 'del' ? value.slice(0, -1) : (value + k).slice(0, 4))}
            className="flex h-14 items-center justify-center rounded-2xl bg-muted text-2xl font-bold hover:bg-accent">{k === 'del' ? <Delete className="size-6" /> : k}</button>
        ))}
      </div>
    </div>
  )
}

export function EnterKidsMode({ hasPin }: { hasPin: boolean }) {
  const { t } = useI18n()
  const [age, setAge] = useState('5_8')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const go = () => start(async () => {
    const r = await enterKidsModeAction(age, hasPin ? undefined : pin)
    if (!r.ok) { setError(t('kids.mode.badPin')); return }
    window.location.href = '/children'
  })
  return (
    <div className="space-y-6 px-4 py-6">
      <p className="text-[15px]">{t('kids.mode.lead')}</p>
      <div className="space-y-2">
        <p className="font-semibold">{t('kids.mode.age')}</p>
        <div className="flex flex-wrap gap-2">
          {(['0_4', '5_8', '9_12', 'all'] as const).map((a) => (
            <button key={a} type="button" aria-pressed={age === a} onClick={() => setAge(a)}
              className={cn('rounded-full border-2 px-4 py-2 font-bold', age === a ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>{t(`kids.agesLong.${a}`)}</button>
          ))}
        </div>
      </div>
      {!hasPin && (
        <div className="space-y-3 text-center">
          <p className="font-semibold">{t('kids.mode.setPin')}</p>
          <p className="text-sm text-muted-foreground">{t('kids.mode.pinHint')}</p>
          <PinPad value={pin} onChange={setPin} />
        </div>
      )}
      {error && <p className="text-center text-sm font-semibold text-destructive">{error}</p>}
      <button type="button" disabled={pending || (!hasPin && pin.length !== 4)} onClick={go} data-kids-start
        className="w-full rounded-full bg-amber-400 py-4 text-lg font-black text-black shadow disabled:opacity-40">{t('kids.mode.start')}</button>
    </div>
  )
}

export function ExitKidsMode() {
  const { t } = useI18n()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const change = (v: string) => {
    setPin(v); setError('')
    if (v.length === 4) start(async () => {
      const r = await exitKidsModeAction(v)
      if (r.ok) { window.location.href = '/children'; return }
      setError(r.error === 'too_many' ? t('kids.mode.tooMany') : t('kids.mode.wrongPin')); setPin('')
    })
  }
  return (
    <div className="space-y-5 px-4 py-10 text-center">
      <h1 className="text-2xl font-black">{t('kids.mode.exitTitle')}</h1>
      <p className="text-muted-foreground">{t('kids.mode.exitLead')}</p>
      <PinPad value={pin} onChange={pending ? () => {} : change} />
      {error && <p className="font-semibold text-destructive" data-pin-error>{error}</p>}
    </div>
  )
}
