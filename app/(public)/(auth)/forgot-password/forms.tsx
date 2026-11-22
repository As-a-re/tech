'use client'

import { useActionState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Field, FormAlert, SubmitButton } from '@/components/forms/fields'
import { resetFinish, resetRestart, resetStart, type AuthState } from '@/server/actions/auth'

const useErr = () => { const { t } = useI18n(); return (k?: string) => (k ? t(`auth.err.${k}` as MessageKey) : undefined) }

export function ResetStart() {
  const { t } = useI18n(); const err = useErr()
  const [s, action] = useActionState<AuthState, FormData>(resetStart, {})
  return (
    <form action={action} className="space-y-4">
      <h1 className="text-2xl font-bold">{t('auth.resetTitle')}</h1>
      <p className="text-sm text-muted-foreground">{t('auth.resetLead')}</p>
      <FormAlert message={err(s.error)} />
      <Field label={t('auth.identifier')} name="identifier" required autoCapitalize="none" autoComplete="username" defaultValue={s.values?.identifier} />
      <SubmitButton>{t('auth.sendCode')}</SubmitButton>
    </form>
  )
}

export function ResetFinish() {
  const { t } = useI18n(); const err = useErr()
  const [s, action] = useActionState<AuthState, FormData>(resetFinish, {})
  const [pending, start] = useTransition()
  return (
    <form action={action} className="space-y-4">
      <h1 className="text-2xl font-bold">{t('auth.resetTitle2')}</h1>
      <p className="text-sm text-muted-foreground">{t('auth.resetLead2')}</p>
      <FormAlert message={err(s.error)} />
      <Field label={t('auth.code')} name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} error={err(s.fields?.code)}
        className="[&_input]:text-center [&_input]:font-mono [&_input]:text-2xl [&_input]:tracking-[0.5em]" />
      <Field label={t('auth.newPassword')} name="password" type="password" required autoComplete="new-password" hint={t('auth.passwordHint')} error={err(s.fields?.password)} />
      <Field label={t('auth.confirm')} name="confirm" type="password" required autoComplete="new-password" error={err(s.fields?.confirm)} />
      <SubmitButton>{t('auth.savePassword')}</SubmitButton>
      <button type="button" disabled={pending} onClick={() => start(() => resetRestart())} className="w-full text-center text-sm text-muted-foreground hover:underline">{t('auth.resend')}</button>
    </form>
  )
}
