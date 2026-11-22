'use client'

import { createContext, useContext, useMemo } from 'react'
import { makeT, type Locale, type TFunction } from './config'

const Ctx = createContext<{ locale: Locale; t: TFunction } | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(locale) }), [locale])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>')
  return v
}
