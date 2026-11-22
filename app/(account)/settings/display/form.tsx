'use client'

import { useState, useTransition } from 'react'
import { useTheme } from 'next-themes'
import { useMounted } from '@/hooks/use-mounted'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { TEXT_SIZES, type TextSize } from '@/lib/display'
import { Card } from '@/components/settings/section'
import { saveDisplay } from '@/server/actions/account'
import { cn } from '@/lib/utils'

export function DisplayForm({ textSize }: { textSize: TextSize }) {
  const { t } = useI18n()
  const { theme: rawTheme, setTheme } = useTheme()
  const theme = useMounted() ? rawTheme : undefined
  const [size, setSize] = useState(textSize)
  const [, start] = useTransition()
  const themes = [{ v: 'light', l: t('prefs.light'), i: Sun }, { v: 'dark', l: t('prefs.dark'), i: Moon }, { v: 'system', l: t('prefs.system'), i: Monitor }]
  const choose = (s: TextSize) => { setSize(s); document.documentElement.dataset.textSize = s; start(() => saveDisplay({ textSize: s })) }
  return (
    <>
      <Card title={t('settings.display.themeTitle')}>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(({ v, l, i: Icon }) => (
            <button key={v} type="button" onClick={() => setTheme(v)} aria-pressed={theme === v}
              className={cn('flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium', theme === v ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted')}>
              <Icon className="size-5" />{l}
            </button>
          ))}
        </div>
      </Card>
      <Card title={t('settings.display.sizeTitle')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TEXT_SIZES.map((s, i) => (
            <button key={s} type="button" onClick={() => choose(s)} aria-pressed={size === s}
              className={cn('rounded-xl border px-3 py-3 font-medium', size === s ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted')}
              style={{ fontSize: `${[13, 15, 17, 19][i]}px` }}>
              {t(`settings.display.sizes.${s}`)}
            </button>
          ))}
        </div>
        <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3 text-[15px] italic">{t('settings.display.preview')}</p>
      </Card>
    </>
  )
}
