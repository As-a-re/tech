'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Field, SubmitButton } from '@/components/forms/fields'
import { useSettingsError } from '@/components/settings/use-err'
import { saveEmail, saveUsername, type FormResult } from '@/server/actions/account'

function useSavedToast(s: FormResult) { const { t } = useI18n(); useEffect(() => { if (s.ok) toast.success(t('settings.saved')) }, [s, t]) }

export function UsernameForm({ username }: { username: string }) {
  const { t } = useI18n(); const err = useSettingsError()
  const [s, action] = useActionState<FormResult, FormData>(saveUsername, {})
  const [value, setValue] = useState(username)
  useSavedToast(s)
  return (
    <form action={action} className="space-y-3">
      <Field label={t('settings.account.username')} name="username" value={value} onChange={(e) => setValue(e.target.value)} maxLength={20} autoCapitalize="none"
        hint={t('settings.account.usernameHint', { username: value || username })} error={err(s.fields?.username, { days: Number(s.data?.days ?? 0) })} />
      <SubmitButton variant="outline" className="sm:w-auto sm:px-6">{t('settings.account.saveUsername')}</SubmitButton>
    </form>
  )
}

export function EmailForm({ email }: { email: string }) {
  const { t } = useI18n(); const err = useSettingsError()
  const [s, action] = useActionState<FormResult, FormData>(saveEmail, {})
  useSavedToast(s)
  return (
    <form action={action} className="space-y-3">
      <Field label={t('settings.account.email')} name="email" type="email" defaultValue={email} autoComplete="email" hint={t('settings.account.emailHint')} error={err(s.fields?.email)} />
      <SubmitButton variant="outline" className="sm:w-auto sm:px-6">{t('settings.account.saveEmail')}</SubmitButton>
    </form>
  )
}
