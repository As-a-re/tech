'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { Copy, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { Field, SubmitButton } from '@/components/forms/fields'
import { useSettingsError } from '@/components/settings/use-err'
import { confirmTwoFactor, disableTwoFactor, savePassword, startTwoFactor, type FormResult } from '@/server/actions/account'

export function PasswordForm() {
  const { t } = useI18n(); const err = useSettingsError()
  const [s, action] = useActionState<FormResult, FormData>(savePassword, {})
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => { if (s.ok) { toast.success(t('settings.saved')); ref.current?.reset() } }, [s, t])
  return (
    <form ref={ref} action={action} className="space-y-3">
      <Field label={t('settings.security.current')} name="current" type="password" autoComplete="current-password" required error={err(s.fields?.current)} />
      <Field label={t('settings.security.new')} name="password" type="password" autoComplete="new-password" required hint={t('auth.passwordHint')} error={err(s.fields?.password)} />
      <Field label={t('settings.security.confirm')} name="confirm" type="password" autoComplete="new-password" required error={err(s.fields?.confirm)} />
      <SubmitButton variant="outline" className="sm:w-auto sm:px-6">{t('settings.security.save')}</SubmitButton>
    </form>
  )
}

export function TwoFactor({ enabled, backupLeft }: { enabled: boolean; backupLeft: number }) {
  const { t } = useI18n(); const err = useSettingsError()
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null)
  const [starting, start] = useTransition()
  const [confirmed, confirm] = useActionState<FormResult, FormData>(confirmTwoFactor, {})
  const [disabled, disable] = useActionState<FormResult, FormData>(disableTwoFactor, {})
  const [showOff, setShowOff] = useState(false)
  const codes = (confirmed.data?.codes as string[] | undefined) ?? null

  useEffect(() => { if (disabled.ok) { setShowOff(false); toast.success(t('settings.saved')) } }, [disabled, t])

  if (codes) return (
    <div className="space-y-3">
      <p className="font-semibold">{t('settings.security.backupTitle')}</p>
      <p className="text-sm text-muted-foreground">{t('settings.security.backupText')}</p>
      <ul className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-4 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => { navigator.clipboard.writeText(codes.join('\n')); toast.success(t('profile.linkCopied')) }}><Copy />{t('settings.security.copyCodes')}</Button>
        <Button onClick={() => location.reload()}>{t('settings.security.done')}</Button>
      </div>
    </div>
  )

  if (enabled) return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-sm"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-green-600" />{t('settings.security.twoFaOn')}</p>
      <p className="text-sm text-muted-foreground">{t('settings.security.backupLeft', { n: backupLeft })}</p>
      {showOff ? (
        <form action={disable} className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('settings.security.disableNote')}</p>
          <Field label={t('settings.yourData.password')} id="disable-password" name="password" type="password" autoComplete="current-password" required error={err(disabled.fields?.password)} />
          <SubmitButton variant="outline" className="sm:w-auto sm:px-6">{t('settings.security.turnOff')}</SubmitButton>
        </form>
      ) : <Button variant="outline" onClick={() => setShowOff(true)}>{t('settings.security.turnOff')}</Button>}
    </div>
  )

  if (setup) return (
    <div className="space-y-4">
      <p className="text-sm">{t('settings.security.scan')}</p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="rounded-xl border bg-white p-2 [&_svg]:size-44" dangerouslySetInnerHTML={{ __html: setup.qr }} />
        <code className="break-all rounded-lg bg-muted px-3 py-2 text-sm tracking-wider">{setup.secret.match(/.{1,4}/g)?.join(' ')}</code>
      </div>
      <form action={confirm} className="space-y-3">
        <Field label={t('settings.security.enterCode')} id="totp-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
          error={err(confirmed.fields?.code)} className="[&_input]:max-w-48 [&_input]:font-mono [&_input]:tracking-[0.3em]" />
        <SubmitButton className="sm:w-auto sm:px-6">{t('settings.security.confirm2fa')}</SubmitButton>
      </form>
    </div>
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('settings.security.twoFaOff')}</p>
      <Button disabled={starting} onClick={() => start(async () => setSetup(await startTwoFactor()))}>{starting && <Loader2 className="animate-spin" />}{t('settings.security.turnOn')}</Button>
    </div>
  )
}
