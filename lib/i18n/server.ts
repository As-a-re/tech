import 'server-only'
import { cookies, headers } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, makeT, type Locale } from './config'

/** Saved choice → device language (Accept-Language) → English. */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(saved)) return saved
  const accept = (await headers()).get('accept-language') ?? ''
  for (const part of accept.split(',')) {
    const code = part.split(';')[0].trim().toLowerCase().split('-')[0]
    if (code === 'ak') return 'tw' // Akan
    if (code === 'ee') return 'ee'
    if (code === 'gaa') return 'ga'
    if (code === 'en') return 'en'
  }
  return DEFAULT_LOCALE
}

export async function getT() {
  return makeT(await getLocale())
}
