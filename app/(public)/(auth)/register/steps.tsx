'use client'

import Link from 'next/link'
import { useActionState, useTransition } from 'react'
import { BadgeCheck } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Field, FormAlert, SubmitButton } from '@/components/forms/fields'
import { registerComplete, registerResend, registerRestart, registerStart, registerVerify, type AuthState } from '@/server/actions/auth'

const useErr = () => { const { t } = useI18n(); return (k?: string) => (k ? t(`auth.err.${k}` as MessageKey) : undefined) }

export function StepMember() {
  const { t } = useI18n(); const err = useErr()
  const [s, action] = useActionState<AuthState, FormData>(registerStart, {})
  return (
    <form action={action} className="mt-5 space-y-4">
      <h1 className="text-2xl font-bold">{t('auth.regTitle1')}</h1>
      <p className="text-sm text-muted-foreground">{t('auth.regLead1')}</p>
      <FormAlert message={err(s.error)} />
      <Field label={t('auth.churchId')} name="churchId" required autoCapitalize="characters" autoComplete="off" placeholder={t('auth.churchIdPh')} defaultValue={s.values?.churchId} />
      <Field label={t('auth.phone')} name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder={t('auth.phonePh')} defaultValue={s.values?.phone} />
      <SubmitButton>{t('auth.continue')}</SubmitButton>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('auth.noChurchId')}</p>
    </form>
  )
}

export function StepCode({ masked }: { masked: string }) {
  const { t } = useI18n(); const err = useErr()
  const [s, action] = useActionState<AuthState, FormData>(registerVerify, {})
  const [resend, doResend] = useActionState<AuthState, FormData>(registerResend, {})
  const [pending, start] = useTransition()
  return (
    <div className="mt-5 space-y-4">
      <h1 className="text-2xl font-bold">{t('auth.regTitle2')}</h1>
      <p className="text-sm text-muted-foreground">{t('auth.regLead2', { phone: masked })}</p>
      <form action={action} className="space-y-4">
        <FormAlert message={err(s.error)} />
        <FormAlert tone="info" message={resend.notice === 'resent' ? t('auth.resent') : undefined} />
        <FormAlert message={err(resend.error)} />
        <Field label={t('auth.code')} name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
          className="[&_input]:text-center [&_input]:font-mono [&_input]:text-2xl [&_input]:tracking-[0.5em]" />
        <SubmitButton>{t('auth.verify')}</SubmitButton>
      </form>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <form action={doResend}><button className="font-medium text-primary hover:underline">{t('auth.resend')}</button></form>
        <button disabled={pending} onClick={() => start(() => registerRestart())} className="text-muted-foreground hover:underline">{t('auth.changeDetails')}</button>
      </div>
    </div>
  )
}

export function StepAccount({ churchId }: { churchId: string }) {
  const { t } = useI18n(); const err = useErr()
  const [s, action] = useActionState<AuthState, FormData>(registerComplete, {})
  const agree = t('auth.agree', { terms: '\u0001', privacy: '\u0002' }).split(/[\u0001\u0002]/)
  return (
    <form action={action} className="mt-5 space-y-4">
      <h1 className="text-2xl font-bold">{t('auth.regTitle3')}</h1>
      <div className="flex items-center gap-2 rounded-lg bg-secondary/70 px-3 py-2 text-sm"><BadgeCheck className="size-4 text-primary" /><span className="font-mono">{churchId}</span></div>
      <FormAlert message={err(s.error)} />
      <Field label={t('auth.username')} name="username" required autoCapitalize="none" autoComplete="username" maxLength={20}
        hint={t('auth.usernameHint')} error={err(s.fields?.username)} defaultValue={s.values?.username} />
      <Field label={t('auth.password')} name="password" type="password" required autoComplete="new-password" hint={t('auth.passwordHint')} error={err(s.fields?.password)} />
      <Field label={t('auth.confirm')} name="confirm" type="password" required autoComplete="new-password" error={err(s.fields?.confirm)} />
      <SubmitButton>{t('auth.createAccount')}</SubmitButton>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {agree[0]}<Link href="/terms" className="underline">{t('auth.terms')}</Link>{agree[1]}<Link href="/privacy" className="underline">{t('auth.privacy')}</Link>{agree[2]}
      </p>
    </form>
  )
}
