import { describe, expect, it } from 'vitest'
import { BUILT_THROUGH_BATCH, CREATE, NAV, SECTIONS, isActive, isBuilt, visibleNav } from '@/lib/navigation'

describe('navigation', () => {
  it('only shows sections that are built', () => {
    expect(visibleNav(true).every((i) => i.batch <= BUILT_THROUGH_BATCH)).toBe(true)
  })
  it('hides member-only sections from guests', () => {
    expect(visibleNav(false).some((i) => i.auth)).toBe(false)
  })
  it('has unique links', () => {
    expect(new Set(NAV.map((i) => i.href)).size).toBe(NAV.length)
  })
  it('matches active routes', () => {
    expect(isActive('/', '/')).toBe(true)
    expect(isActive('/groups/abc', '/groups')).toBe(true)
    expect(isActive('/groupsx', '/groups')).toBe(false)
    expect(isActive('/market', '/')).toBe(false)
  })
  it('top tabs are For you, Following, Events, Kids', () => {
    expect(SECTIONS.map((s) => s.key)).toEqual(['for_you', 'following', 'events', 'kids'])
  })
  it('Add lists every kind of content, and built ones lead to a form', () => {
    expect(new Set(CREATE.map((c) => c.key)).size).toBe(CREATE.length)
    expect(CREATE.map((c) => c.key)).toEqual(expect.arrayContaining(['post', 'announcement', 'event', 'prayer', 'group', 'live', 'publication', 'product']))
    expect(CREATE.filter((c) => isBuilt(c.batch)).every((c) => c.compose || c.href)).toBe(true)
  })
})
