'use client'

import { useSyncExternalStore } from 'react'

/** False during server render and hydration, true afterwards (for values only the browser knows, like the theme). */
export function useMounted() {
  return useSyncExternalStore(() => () => {}, () => true, () => false)
}
