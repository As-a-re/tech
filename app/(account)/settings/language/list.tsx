'use client'

import { useTransition } from 'react'
import { Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n/config'
import { setLocale } from '@/server/actions/preferences'
import { cn } from '@/lib/utils'

export function LanguageList({ note }: { note: string }) {
  const { locale } = useI18n()
  const [pending, start] = useTransition()
  return (
    <>
      <ul className="divide-y rounded-2xl border">
        {LOCALES.map((l) => (
          <li key={l}>
            <button type="button" disabled={pending} onClick={() => start(() => setLocale(l))} aria-pressed={locale === l}
              className={cn('flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/50', locale === l && 'font-semibold text-primary')}>
              {LOCALE_NAMES[l]}{locale === l && <Check className="size-5" />}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">{note}</p>
    </>
  )
}
