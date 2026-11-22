'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { useTheme } from 'next-themes'
import { useMounted } from '@/hooks/use-mounted'
import { Camera, Check, Loader2, Monitor, Moon, Sun } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { LOCALES, LOCALE_NAMES, type MessageKey } from '@/lib/i18n/config'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { FormAlert, SubmitButton } from '@/components/forms/fields'
import { UserAvatar } from '@/components/common/user-avatar'
import { finishOnboarding, saveBasics, type OnboardingState } from '@/server/actions/onboarding'
import { setLocale } from '@/server/actions/preferences'
import { cn } from '@/lib/utils'

export function Onboarding({ name, avatarUrl, bio }: { name: string; avatarUrl: string | null; bio: string }) {
  const [step, setStep] = useState(1)
  return (
    <div className="mt-6">
      <div className="mb-5 flex gap-1.5" aria-hidden>{[1, 2].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />)}</div>
      {step === 1 ? <Basics name={name} avatarUrl={avatarUrl} bio={bio} onDone={() => setStep(2)} /> : <Looks onBack={() => setStep(1)} />}
    </div>
  )
}

function Basics({ name, avatarUrl, bio, onDone }: { name: string; avatarUrl: string | null; bio: string; onDone: () => void }) {
  const { t } = useI18n()
  const [s, action] = useActionState<OnboardingState, FormData>(saveBasics, {})
  const [preview, setPreview] = useState(avatarUrl)
  useEffect(() => { if (s.ok) onDone() }, [s, onDone])
  return (
    <form action={action} className="space-y-5">
      <h2 className="font-semibold">{t('onboarding.photoTitle')}</h2>
      <FormAlert message={s.error && t(`onboarding.${s.error}` as MessageKey)} />
      <label className="mx-auto flex w-fit cursor-pointer flex-col items-center gap-2">
        <span className="relative">
          <UserAvatar name={name} src={preview} className="size-24 text-3xl" />
          <span className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"><Camera className="size-4" /></span>
        </span>
        <span className="text-sm font-medium text-primary">{preview ? t('onboarding.changePhoto') : t('onboarding.addPhoto')}</span>
        <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setPreview(URL.createObjectURL(f)) }} />
      </label>
      <div className="space-y-1.5">
        <Label htmlFor="bio">{t('onboarding.bio')}</Label>
        <Textarea id="bio" name="bio" defaultValue={bio} maxLength={280} rows={3} placeholder={t('onboarding.bioPh')} />
      </div>
      <SubmitButton>{t('onboarding.next')}</SubmitButton>
    </form>
  )
}

function Looks({ onBack }: { onBack: () => void }) {
  const { t, locale } = useI18n()
  const { theme: rawTheme, setTheme } = useTheme()
  const theme = useMounted() ? rawTheme : undefined
  const [pending, start] = useTransition()
  const [finishing, finish] = useTransition()
  const themes = [{ v: 'light', l: t('prefs.light'), i: Sun }, { v: 'dark', l: t('prefs.dark'), i: Moon }, { v: 'system', l: t('prefs.system'), i: Monitor }]
  return (
    <div className="space-y-5">
      <h2 className="font-semibold">{t('onboarding.prefsTitle')}</h2>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('prefs.theme')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(({ v, l, i: Icon }) => (
            <button key={v} type="button" onClick={() => setTheme(v)} aria-pressed={theme === v}
              className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium', theme === v ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted')}>
              <Icon className="size-5" />{l}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t('prefs.language')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {LOCALES.map((l) => (
            <button key={l} type="button" disabled={pending} onClick={() => start(() => setLocale(l))} aria-pressed={locale === l}
              className={cn('flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm', locale === l ? 'border-primary bg-primary/5 font-semibold text-primary' : 'hover:bg-muted')}>
              {LOCALE_NAMES[l]}{locale === l && <Check className="size-4" />}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11" onClick={onBack}>{t('onboarding.back')}</Button>
        <Button type="button" className="h-11 flex-1 text-[15px]" disabled={finishing} onClick={() => finish(() => finishOnboarding())}>
          {finishing && <Loader2 className="animate-spin" />}{t('onboarding.finish')}
        </Button>
      </div>
    </div>
  )
}
