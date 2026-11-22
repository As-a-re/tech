import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import { completeRegistration, startRegistration, verifyRegistrationCode } from '@/server/identity/register'
import { login } from '@/server/identity/login'
import { finishReset, startReset } from '@/server/identity/password-reset'
import { checkCode, sendCode } from '@/server/identity/codes'
import { hit } from '@/server/identity/rate-limit'
import { captureSms, cleanup, makeMember } from './helpers'

const IP = 'test-ip'
const sms = captureSms()

beforeAll(cleanup)
afterAll(async () => { await cleanup(); sms.restore(); await pool.end() })

async function register(n: number, username: string, opts?: { grant?: boolean }) {
  const m = await makeMember(n, opts)
  const s = await startRegistration(m.churchId.toLowerCase(), m.local, IP)
  expect(s.ok).toBe(true)
  expect(await verifyRegistrationCode(m.phone, sms.lastCode())).toBe('ok')
  const c = await completeRegistration({ churchId: m.churchId, phone: m.phone, username, password: 'grace2026', confirm: 'grace2026', locale: 'en', ip: IP })
  expect(c.ok).toBe(true)
  return { ...m, userId: c.ok ? c.userId : '' }
}

describe('registration', () => {
  it('registers a member end to end (Church ID → SMS code → account)', async () => {
    const r = await register(1, 'zztest_one')
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.userId))
    expect(u.fullName).toBe('Test Member 1')
    expect(u.role).toBe('member')
    expect(u.passwordHash).toMatch(/^\$argon2id\$/)
  })

  it('rejects wrong phone, unknown ID and inactive members with safe messages', async () => {
    const m = await makeMember(2)
    expect(await startRegistration(m.churchId, '0249999999', IP)).toEqual({ ok: false, error: 'no_match' })
    expect(await startRegistration('ZZTEST-NOPE', m.local, IP)).toEqual({ ok: false, error: 'no_match' })
    const x = await makeMember(3, { active: false })
    expect(await startRegistration(x.churchId, x.local, IP)).toEqual({ ok: false, error: 'inactive' })
    expect(await startRegistration('', 'abc', IP)).toEqual({ ok: false, error: 'invalid' })
  })

  it('blocks a second account for the same Church ID and duplicate usernames', async () => {
    const m = await makeMember(1)
    expect(await startRegistration(m.churchId, m.local, IP)).toEqual({ ok: false, error: 'registered' })
    const n = await makeMember(4)
    await startRegistration(n.churchId, n.local, IP)
    const c = await completeRegistration({ churchId: n.churchId, phone: n.phone, username: 'ZZTEST_ONE', password: 'grace2026', confirm: 'grace2026', locale: 'en', ip: IP })
    expect(c).toEqual({ ok: false, error: 'username_taken' })
  })

  it('validates username and password', async () => {
    const n = await makeMember(5)
    const base = { churchId: n.churchId, phone: n.phone, locale: 'en', ip: IP }
    expect(await completeRegistration({ ...base, username: 'admin', password: 'grace2026', confirm: 'grace2026' })).toEqual({ ok: false, error: 'username_reserved' })
    expect(await completeRegistration({ ...base, username: 'zztest_five', password: 'password', confirm: 'password' })).toEqual({ ok: false, error: 'password_weak' })
    expect(await completeRegistration({ ...base, username: 'zztest_five', password: 'grace2026', confirm: 'grace2027' })).toEqual({ ok: false, error: 'password_mismatch' })
  })

  it('makes the first member a Tech Admin when flagged by setup', async () => {
    const r = await register(6, 'zztest_admin', { grant: true })
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.userId))
    expect(u.role).toBe('tech_admin')
  })
})

describe('SMS codes', () => {
  it('locks after 5 wrong tries and expires used codes', async () => {
    const phone = '233249000901'
    await sendCode(phone, 'register')
    const good = sms.lastCode()
    for (let i = 0; i < 4; i++) expect(await checkCode(phone, 'register', '000000' === good ? '111111' : '000000')).toBe('wrong')
    expect(await checkCode(phone, 'register', good === '222222' ? '333333' : '222222')).toBe('locked')
    expect(await checkCode(phone, 'register', good)).toBe('locked')
    await sendCode(phone, 'register')
    const fresh = sms.lastCode()
    expect(await checkCode(phone, 'register', fresh)).toBe('ok')
    expect(await checkCode(phone, 'register', fresh)).toBe('expired')
  })

  it('limits sends to 3 per phone per 15 minutes', async () => {
    const phone = '233249000902'
    expect((await sendCode(phone, 'reset_password')).ok).toBe(true)
    expect((await sendCode(phone, 'reset_password')).ok).toBe(true)
    expect((await sendCode(phone, 'reset_password')).ok).toBe(true)
    expect(await sendCode(phone, 'reset_password')).toEqual({ ok: false, reason: 'too_many' })
  })
})

describe('sign in', () => {
  it('accepts Church ID, username or phone with the right password', async () => {
    const m = await makeMember(1)
    expect((await login(m.churchId.toLowerCase(), 'grace2026', IP)).ok).toBe(true)
    expect((await login('@ZZTEST_ONE', 'grace2026', IP)).ok).toBe(true)
    expect((await login(m.local, 'grace2026', IP)).ok).toBe(true)
    expect(await login('zztest_one', 'wrong-pass1', IP)).toEqual({ ok: false, error: 'invalid' })
    expect(await login('nobody_here', 'grace2026', IP)).toEqual({ ok: false, error: 'invalid' })
  })

  it('refuses suspended accounts and deactivated members', async () => {
    await db.update(schema.users).set({ status: 'suspended' }).where(eq(schema.users.username, 'zztest_admin'))
    expect(await login('zztest_admin', 'grace2026', IP)).toEqual({ ok: false, error: 'suspended' })
    await db.update(schema.churchMembers).set({ active: false }).where(eq(schema.churchMembers.churchId, 'ZZTEST-1'))
    expect(await login('zztest_one', 'grace2026', IP)).toEqual({ ok: false, error: 'inactive' })
    await db.update(schema.churchMembers).set({ active: true }).where(eq(schema.churchMembers.churchId, 'ZZTEST-1'))
  })
})

describe('forgot password', () => {
  it('resets with the SMS code, then the new password works and the old one does not', async () => {
    const s = await startReset('zztest_one', IP)
    expect(s.ok && s.userId).toBeTruthy()
    if (!s.ok) return
    expect(await finishReset({ ...s, code: '000001', password: 'newgrace2026', confirm: 'newgrace2026', ip: IP })).toEqual({ ok: false, error: 'code_wrong' })
    expect((await finishReset({ ...s, code: sms.lastCode(), password: 'newgrace2026', confirm: 'newgrace2026', ip: IP })).ok).toBe(true)
    expect((await login('zztest_one', 'newgrace2026', IP)).ok).toBe(true)
    expect((await login('zztest_one', 'grace2026', IP)).ok).toBe(false)
  })

  it('gives no hint whether an account exists', async () => {
    expect(await startReset('no_such_member', IP)).toEqual({ ok: true, userId: null, phone: null })
  })
})

describe('rate limits', () => {
  it('counts within a window', async () => {
    const key = `zztest:${Date.now()}`
    expect(await hit(key, 2, 60)).toBe(true)
    expect(await hit(key, 2, 60)).toBe(true)
    expect(await hit(key, 2, 60)).toBe(false)
  })
})
