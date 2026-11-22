'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createPrayerAction, answerPrayerAction } from '@/server/actions/devotion'

export function PrayerForm({ assemblyName }: { assemblyName: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [body, setBody] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [audience, setAudience] = useState<'everyone' | 'assembly'>('everyone')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    start(async () => {
      const r = await createPrayerAction({ body, anonymous, audience })
      if (!r.ok) return setError(t(`prayer.err.${r.error}` as MessageKey))
      toast.success(t('prayer.posted')); router.push(`/prayer/${r.id}`)
    })
  }
  return (
    <form onSubmit={submit} className="space-y-5 p-4 sm:p-6">
      {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="space-y-1.5"><Label htmlFor="body">{t('prayer.bodyLabel')}</Label>
        <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={1000} placeholder={t('prayer.bodyPh')} required />
        <p className="text-right text-xs text-muted-foreground">{body.length}/1000</p></div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">{t('prayer.audience')}</legend>
        {([['everyone', t('prayer.everyone')], ['assembly', t('prayer.assemblyOnly', { assembly: assemblyName })]] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2.5 text-[15px]"><input type="radio" name="audience" checked={audience === k} onChange={() => setAudience(k)} className="size-4 accent-[var(--primary)]" />{label}</label>
        ))}
      </fieldset>
      <label className="flex items-start gap-2.5 text-[15px]">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
        <span>{t('prayer.anonymous')}<span className="block text-xs text-muted-foreground">{t('prayer.anonymousHelp')}</span></span>
      </label>
      <Button type="submit" disabled={pending || !body.trim()} className="w-full sm:w-auto sm:px-8">{pending && <Loader2 className="animate-spin" />}{t('prayer.post')}</Button>
    </form>
  )
}

/** The author marks their request answered. */
export function AnswerForm({ id }: { id: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()
  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{t('prayer.markAnswered')}</Button>
  return (
    <div className="w-full space-y-2 rounded-xl border p-3">
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder={t('prayer.answerNote')} aria-label={t('prayer.answerNote')} />
      <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await answerPrayerAction(id, note); if (r.ok) { toast.success(t('prayer.answerDone')); router.refresh() } })}>
        {pending && <Loader2 className="animate-spin" />}{t('prayer.answerSave')}</Button>
    </div>
  )
}
