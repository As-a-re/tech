'use client'

import { useActionState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Field, FormAlert, SubmitButton } from '@/components/forms/fields'
import { removeVerseAction, setVerseAction, type AdminResult } from '@/server/actions/admin'

export function VerseForm({ defaultDay }: { defaultDay: string }) {
  const { t } = useI18n()
  const [s, action] = useActionState<AdminResult, FormData>(setVerseAction, {})
  useEffect(() => { if (s.ok) toast.success(t('admin.verses.saved')) }, [s, t])
  return (
    <form action={action} className="space-y-3">
      <FormAlert message={s.error && t(`admin.verses.err.${s.error}` as MessageKey)} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('admin.verses.day')} name="day" type="date" defaultValue={defaultDay} required />
        <Field label={t('admin.verses.reference')} name="reference" placeholder={t('admin.verses.referencePh')} maxLength={60} required />
        <Field label={t('admin.verses.translation')} name="translation" defaultValue="KJV" maxLength={12} />
      </div>
      <div className="space-y-1.5"><Label htmlFor="text">{t('admin.verses.text')}</Label><Textarea id="text" name="text" rows={3} maxLength={1000} required /></div>
      <SubmitButton className="sm:w-auto sm:px-6">{t('admin.verses.save')}</SubmitButton>
    </form>
  )
}

export function RemoveVerse({ day }: { day: string }) {
  const { t } = useI18n()
  const [p, start] = useTransition()
  return <Button size="sm" variant="outline" className="text-destructive" disabled={p} onClick={() => start(async () => { await removeVerseAction(day) })}>{t('admin.verses.remove')}</Button>
}
