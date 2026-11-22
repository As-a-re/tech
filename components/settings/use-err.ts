'use client'

import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'

/** Maps error codes from settings actions to messages (settings.err.* then auth.err.*). */
export function useSettingsError() {
  const { t } = useI18n()
  return (code?: string, vars?: Record<string, string | number>) => {
    if (!code) return undefined
    const own = t(`settings.err.${code}` as MessageKey, vars)
    return own.startsWith('settings.err.') ? t(`auth.err.${code}` as MessageKey, vars) : own
  }
}
