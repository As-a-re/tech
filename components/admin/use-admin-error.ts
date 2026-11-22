'use client'

import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'

export function useAdminError() {
  const { t } = useI18n()
  return (code?: string) => {
    if (!code) return undefined
    for (const k of [`admin.err.${code}`, `admin.accounts.err.${code}`, `admin.roles.err.${code}`]) {
      const v = t(k as MessageKey)
      if (v !== k) return v
    }
    return code
  }
}
