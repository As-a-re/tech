'use client'

import { useTransition } from 'react'
import { useTheme } from 'next-themes'
import { useMounted } from '@/hooks/use-mounted'
import { Check, Languages, Monitor, Moon, SlidersHorizontal, Sun } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/lib/i18n/client'
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n/config'
import { setLocale } from '@/server/actions/preferences'

/** Theme and language — available to everyone, signed in or not. */
export function PreferencesMenu() {
  const { t, locale } = useI18n()
  const { theme: rawTheme, setTheme } = useTheme()
  const theme = useMounted() ? rawTheme : undefined
  const [pending, start] = useTransition()
  const themes = [
    { value: 'light', label: t('prefs.light'), icon: Sun },
    { value: 'dark', label: t('prefs.dark'), icon: Moon },
    { value: 'system', label: t('prefs.system'), icon: Monitor },
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={t('prefs.title')} className="rounded-full border p-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <SlidersHorizontal className="size-[18px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">{t('prefs.theme')}</DropdownMenuLabel>
        {themes.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onSelect={(e) => { e.preventDefault(); setTheme(value) }}>
            <Icon /> <span className="flex-1">{label}</span>{theme === value && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"><Languages className="size-3.5" />{t('prefs.language')}</DropdownMenuLabel>
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l} disabled={pending} onSelect={(e) => { e.preventDefault(); start(() => setLocale(l)) }}>
            <span className="flex-1">{LOCALE_NAMES[l]}</span>{locale === l && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
