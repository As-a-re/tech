import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import { env } from '@/lib/env'
import { open, seal } from '@/lib/secret-box'
import { base32Encode, totpAt, verifyTotp } from '@/lib/totp'
import { describeDevice } from '@/lib/user-agent'
import * as account from '@/server/account/account'
import * as twoFactor from '@/server/account/two-factor'
import { normaliseWebsite } from '@/server/account/profile'
import { login } from '@/server/identity/login'
import { cleanup, makeUser } from './helpers'

let u: { id: string; username: string }, v: { id: string; username: string }
beforeAll(async () => { await cleanup(); u = await makeUser(201); v = await makeUser(202) })
afterAll(async () => { await cleanup(); await pool.end() })

describe('helpers', () => {
  it('TOTP matches the RFC 6238 test vector', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'))
    expect(totpAt(secret, 1)).toBe('287082')
    expect(verifyTotp(secret, '287082', 59_000)).toBe(true)
    expect(verifyTotp(secret, '287083', 59_000)).toBe(false)
  })
  it('seals and opens secrets; wrong key fails', () => {
    const s = seal('JBSWY3DPEHPK3PXP', env.authSecret)
    expect(open(s, env.authSecret)).toBe('JBSWY3DPEHPK3PXP')
    expect(() => open(s, 'x'.repeat(40))).toThrow()
  })
  it('normalises websites', () => {
    expect(normaliseWebsite('example.com')).toBe('https://example.com')
    expect(normaliseWebsite('')).toBeNull()
    expect(normaliseWebsite('javascript:alert(1)')).toBe(false)
    expect(normaliseWebsite('not a site')).toBe(false)
  })
  it('names devices', () => {
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/129.0 Mobile Safari/537.36')).toBe('Chrome on Android')
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Version/17.0 Mobile Safari/604.1')).toBe('Safari on iPhone/iPad')
  })
})

describe('account', () => {
  it('changes username with checks and a 30-day wait', async () => {
    expect(await account.changeUsername(u.id, v.username.toUpperCase())).toEqual({ ok: false, error: 'username_taken' })
    expect(await account.changeUsername(u.id, 'settings')).toEqual({ ok: false, error: 'username_reserved' })
    expect(await account.changeUsername(u.id, 'zz_renamed')).toEqual({ ok: true })
    expect(await account.changeUsername(u.id, 'ZZ_Renamed')).toEqual({ ok: true }) // case-only change is always allowed
    const r = await account.changeUsername(u.id, 'zz_again')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('username_cooldown')
    u.username = 'ZZ_Renamed'
  })

  it('changes password only with the current one, signing out other devices', async () => {
    await db.insert(schema.sessions).values([{ id: 'zz-keep', userId: u.id, expiresAt: new Date(Date.now() + 1e7) }, { id: 'zz-other', userId: u.id, expiresAt: new Date(Date.now() + 1e7) }])
    expect(await account.changePassword(u.id, 'wrong', 'newgrace2026', 'newgrace2026', 'zz-keep')).toEqual({ ok: false, field: 'current', error: 'current_wrong' })
    expect(await account.changePassword(u.id, 'grace2026', 'short', 'short', 'zz-keep')).toEqual({ ok: false, field: 'password', error: 'password_short' })
    expect(await account.changePassword(u.id, 'grace2026', 'newgrace2026', 'newgrace2026', 'zz-keep')).toEqual({ ok: true })
    const left = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.userId, u.id))
    expect(left.map((s) => s.id)).toEqual(['zz-keep'])
    expect((await login(u.username, 'newgrace2026', 'zz-ip')).ok).toBe(true)
  })

  it('2-step verification: setup, sign-in codes, single-use backup codes, turning off', async () => {
    const secret = await twoFactor.beginSetup(u.id)
    expect(await twoFactor.isEnabled(u.id)).toBe(false)
    expect(await twoFactor.confirmSetup(u.id, '000000')).toBeNull()
    const step = Math.floor(Date.now() / 30_000)
    const codes = await twoFactor.confirmSetup(u.id, totpAt(secret, step))
    expect(codes).toHaveLength(10)
    expect(await twoFactor.isEnabled(u.id)).toBe(true)
    expect(await twoFactor.checkSecondFactor(u.id, totpAt(secret, step))).toBe('ok')
    expect(await twoFactor.checkSecondFactor(u.id, codes![0])).toBe('ok')
    expect(await twoFactor.checkSecondFactor(u.id, codes![0])).toBe('wrong')
    expect(await twoFactor.remainingBackupCodes(u.id)).toBe(9)
    expect(await twoFactor.disable(u.id, 'wrong')).toBe(false)
    expect(await twoFactor.disable(u.id, 'newgrace2026')).toBe(true)
    expect(await twoFactor.isEnabled(u.id)).toBe(false)
    const [row] = await db.select({ s: schema.users.totpSecret }).from(schema.users).where(eq(schema.users.id, u.id))
    expect(row.s).toBeNull()
  })

  it('exports data and deletes the account', async () => {
    const data = await account.exportData(v.id)
    expect(data.account.username).toBe(v.username)
    expect(data.account).not.toHaveProperty('passwordHash')
    expect(await account.deleteAccount(v.id, 'nope')).toBe(false)
    expect(await account.deleteAccount(v.id, 'grace2026')).toBe(true)
    expect(await db.select().from(schema.users).where(eq(schema.users.id, v.id))).toEqual([])
  })
})
