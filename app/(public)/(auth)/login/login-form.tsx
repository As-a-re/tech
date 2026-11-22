'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Field, FormAlert, SubmitButton } from '@/components/forms/fields'
import { signIn, type AuthState } from '@/server/actions/auth'

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n()
  const [state, action] = useActionState<AuthState, FormData>(signIn, {})
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next ?? '/'} />
      <FormAlert message={state.error && t(`auth.err.${state.error}` as MessageKey)} />
      <Field label={t('auth.identifier')} name="identifier" autoComplete="username" autoCapitalize="none" required defaultValue={state.values?.identifier} />
      <div>
        <Field label={t('auth.password')} name="password" type="password" autoComplete="current-password" required />
        <Link href="/forgot-password" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">{t('auth.forgot')}</Link>
      </div>
      <SubmitButton>{t('auth.signIn')}</SubmitButton>
    </form>
  )
}
