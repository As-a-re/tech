'use client'

import { useMounted } from './use-mounted'

/** True when Data saver is on (set on <html data-saver="on"> from Settings). */
export function useDataSaver() {
  const mounted = useMounted()
  return mounted && document.documentElement.dataset.saver === 'on'
}
