import en from '@/locales/en.json'
import tw from '@/locales/tw.json'
import ga from '@/locales/ga.json'
import ee from '@/locales/ee.json'

export const LOCALES = ['en', 'tw', 'ga', 'ee'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'papa_locale'

/** Shown in each language's own name. Non-English files are drafts until checked by fluent members. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', tw: 'Twi', ga: 'Ga', ee: 'Eʋegbe' }

export type Messages = typeof en
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }
const CATALOG: Record<Locale, DeepPartial<Messages>> = { en, tw, ga, ee }

/** Dotted keys of the English catalogue, e.g. "nav.home". */
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown> ? Paths<T[K], `${P}${K}.`> : `${P}${K}`
}[keyof T & string]
export type MessageKey = Paths<Messages>

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as readonly string[]).includes(v)

function lookup(obj: unknown, key: string): string | undefined {
  const v = key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
  return typeof v === 'string' ? v : undefined
}

/** Translate with English fallback for anything not yet translated. `{name}` placeholders are filled from vars. */
export function translate(locale: Locale, key: MessageKey | string, vars?: Record<string, string | number>) {
  const one = vars?.n === 1 || vars?.n === '1' ? `${key}_one` : null
  const text = (one && (lookup(CATALOG[locale], one) ?? lookup(CATALOG.en, one))) || (lookup(CATALOG[locale], key) ?? lookup(CATALOG.en, key) ?? key)
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text
}

export type TFunction = (key: MessageKey | string, vars?: Record<string, string | number>) => string
export const makeT = (locale: Locale): TFunction => (key, vars) => translate(locale, key, vars)
export const catalog = (locale: Locale) => CATALOG[locale]
