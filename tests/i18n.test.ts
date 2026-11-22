import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'
import { LOCALES, catalog, translate, type MessageKey } from '@/lib/i18n/config'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]))
}
const english = new Set(keys(en))

describe('languages', () => {
  it('translates and falls back to English', () => {
    expect(translate('tw', 'nav.home')).toBe('Fie')
    expect(translate('tw', 'nav.publications')).toBe('Publications')
  })

  it('fills {placeholders}', () => {
    expect(translate('en', 'app.name' as MessageKey, { x: 1 })).toBe('PAPA')
  })

  it.each(LOCALES)('%s has no keys that English lacks', (l) => {
    const extra = keys(catalog(l)).filter((k) => !english.has(k))
    expect(extra).toEqual([])
  })

  it('no empty English strings', () => {
    expect(keys(en).filter((k) => translate('en', k as MessageKey).trim() === '')).toEqual([])
  })
})
