'use client'

import { useOptimistic, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'

/** A titled on/off setting that saves immediately. */
export function SwitchRow({ title, text, checked, onSave }: { title: string; text: string; checked: boolean; onSave: (v: boolean) => Promise<void> }) {
  const [value, setValue] = useOptimistic(checked)
  const [pending, start] = useTransition()
  const id = title.toLowerCase().replace(/\W+/g, '-')
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border p-5">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block font-bold">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{text}</span>
      </label>
      <Switch id={id} checked={value} disabled={pending} onCheckedChange={(v) => start(async () => { setValue(v); await onSave(v) })} className="mt-1" />
    </div>
  )
}
