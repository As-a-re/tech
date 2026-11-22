'use client'

import { useActionState } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { Field, FormAlert, SubmitButton } from '@/components/forms/fields'
import { useSettingsError } from '@/components/settings/use-err'
import { deleteAccountAction, type FormResult } from '@/server/actions/account'

export function DeleteForm() {
  const { t } = useI18n(); const err = useSettingsError()
  const [s, action] = useActionState<FormResult, FormData>(deleteAccountAction, {})
  return (
    <form action={action} className="space-y-3">
      <FormAlert message={err(s.error)} />
      <Field label={t('settings.yourData.password')} name="password" type="password" autoComplete="current-password" required error={err(s.fields?.password)} />
      <Field label={t('settings.yourData.typeDelete')} name="confirm" autoComplete="off" autoCapitalize="characters" required error={err(s.fields?.confirm)} />
      <SubmitButton className="bg-destructive text-white hover:bg-destructive/90 sm:w-auto sm:px-6">{t('settings.yourData.delete')}</SubmitButton>
    </form>
  )
}
