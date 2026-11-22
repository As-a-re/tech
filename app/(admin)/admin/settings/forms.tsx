'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Field, SubmitButton } from '@/components/forms/fields'
import { useAdminError } from '@/components/admin/use-admin-error'
import { saveBannedWordsAction, saveMarketFeeAction, saveSupportAction, type AdminResult } from '@/server/actions/admin'

function useSaved(s: AdminResult) { const { t } = useI18n(); useEffect(() => { if (s.ok) toast.success(t('admin.saved')) }, [s, t]) }

export function SupportForm({ email, phone }: { email: string; phone: string }) {
  const { t } = useI18n(); const err = useAdminError()
  const [s, action] = useActionState<AdminResult, FormData>(saveSupportAction, {}); useSaved(s)
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('admin.settings.email')} name="email" type="email" defaultValue={email} error={err(s.fields?.email)} />
        <Field label={t('admin.settings.phone')} name="phone" type="tel" defaultValue={phone} />
      </div>
      <SubmitButton className="sm:w-auto sm:px-6">{t('admin.settings.save')}</SubmitButton>
    </form>
  )
}

export function BannedWordsForm({ words }: { words: string[] }) {
  const { t } = useI18n(); const err = useAdminError()
  const [s, action] = useActionState<AdminResult, FormData>(saveBannedWordsAction, {}); useSaved(s)
  return (
    <form action={action} className="space-y-3">
      <Label htmlFor="words">{t('admin.settings.words')}</Label>
      <Textarea id="words" name="words" rows={6} defaultValue={words.join('\n')} className="font-mono text-sm" />
      {s.fields?.words && <p className="text-xs text-destructive">{err(s.fields.words)}</p>}
      {s.ok && <p className="text-xs text-muted-foreground">{t('admin.settings.wordsSaved', { count: Number(s.data?.count ?? 0) })}</p>}
      <SubmitButton className="sm:w-auto sm:px-6">{t('admin.settings.save')}</SubmitButton>
    </form>
  )
}

export function FeeForm({ fee }: { fee: number }) {
  const { t } = useI18n(); const err = useAdminError()
  const [s, action] = useActionState<AdminResult, FormData>(saveMarketFeeAction, {}); useSaved(s)
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label={t('admin.settings.fee')} name="fee" type="number" min={0} max={20} step={0.1} defaultValue={fee} error={err(s.fields?.fee)} className="sm:w-40" />
      <SubmitButton className="sm:mb-[1px] sm:w-auto sm:px-6">{t('admin.settings.save')}</SubmitButton>
    </form>
  )
}
