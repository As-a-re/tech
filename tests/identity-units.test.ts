import { describe, expect, it } from 'vitest'
import { formatPhone, isGhanaMobile, maskPhone, normaliseChurchId, normalisePhone, slugify } from '@/lib/identity/normalise'
import { passwordProblem, usernameProblem } from '@/lib/identity/rules'
import { signPayload, verifyPayload } from '@/lib/crypto'
import { parseCsv } from '@/lib/csv'

describe('normalising', () => {
  it.each([
    ['024 123 4567', '233241234567'], ['+233 24 123 4567', '233241234567'], ['00233241234567', '233241234567'],
    ['241234567', '233241234567'], ['0551234567', '233551234567'],
  ])('phone %s', (input, out) => expect(normalisePhone(input)).toBe(out))
  it('validates Ghana mobiles', () => {
    expect(isGhanaMobile('233241234567')).toBe(true)
    expect(isGhanaMobile('233123')).toBe(false)
    expect(isGhanaMobile('234801234567')).toBe(false)
  })
  it('formats and masks', () => {
    expect(formatPhone('233241234567')).toBe('+233 24 123 4567')
    expect(maskPhone('233241234567')).toBe('+233 24 *** **67')
  })
  it('church id', () => expect(normaliseChurchId(' cac 0012 ')).toBe('CAC0012'))
  it('slug', () => expect(slugify('Bethel Assembly, Madina!')).toBe('bethel-assembly-madina'))
})

describe('rules', () => {
  it('usernames', () => {
    expect(usernameProblem('ab')).toBe('length')
    expect(usernameProblem('kofi mensah')).toBe('chars')
    expect(usernameProblem('Admin')).toBe('reserved')
    expect(usernameProblem('kofi_mensah')).toBeNull()
  })
  it('passwords', () => {
    expect(passwordProblem('short1')).toBe('short')
    expect(passwordProblem('onlyletters')).toBe('weak')
    expect(passwordProblem('12345678')).toBe('weak')
    expect(passwordProblem('grace2026')).toBeNull()
  })
})

describe('signed tickets', () => {
  const secret = 'x'.repeat(40)
  it('round-trips', () => expect(verifyPayload<{ a: number }>(signPayload({ a: 1 }, secret, 60), secret)?.a).toBe(1))
  it('rejects tampering', () => {
    const t = signPayload({ a: 1 }, secret, 60)
    const forged = Buffer.from(JSON.stringify({ a: 2, exp: 9e9 })).toString('base64url') + '.' + t.split('.')[1]
    expect(verifyPayload(forged, secret)).toBeNull()
    expect(verifyPayload(t, 'y'.repeat(40))).toBeNull()
  })
  it('expires', () => expect(verifyPayload(signPayload({ a: 1 }, secret, -1), secret)).toBeNull())
})

describe('csv', () => {
  it('handles quotes, commas and newlines', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\r\n\n1,2')).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['1', '2']])
  })
})

describe('clientIp (behind AWS load balancers)', async () => {
  const { clientIp } = await import('@/server/identity/session')
  it('takes the address the load balancer added, not one the caller typed', () => {
    expect(clientIp('6.6.6.6, 41.66.1.2', null, 1)).toBe('41.66.1.2')
    expect(clientIp('6.6.6.6, 41.66.1.2, 130.176.0.1', null, 2)).toBe('41.66.1.2')
    expect(clientIp('41.66.1.2', null, 2)).toBe('41.66.1.2')
    expect(clientIp(null, '10.0.0.5', 1)).toBe('10.0.0.5')
    expect(clientIp(null, null, 1)).toBeNull()
  })
})
