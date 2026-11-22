'use client'

import { useActionState } from 'react'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Field, FormAlert, SubmitButton } from '@/components/forms/fields'
import { verifySecondStep, type AuthState } from '@/server/actions/auth'

export function VerifyForm() {
  const { t } = useI18n()
  const [s, action] = useActionState<AuthState, FormData>(verifySecondStep, {})
  return (
    <form action={action} className="mt-6 space-y-4">
      <FormAlert message={s.error && t(`auth.err.${s.error}` as MessageKey)} />
      <Field label={t('auth.twoFaCode')} name="code" required autoComplete="one-time-code" autoCapitalize="none" maxLength={11} autoFocus
        className="[&_input]:text-center [&_input]:font-mono [&_input]:text-xl [&_input]:tracking-[0.3em]" />
      <SubmitButton>{t('auth.verify')}</SubmitButton>
    </form>
  )
}
