import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import * as pay from '@/server/payments/payments'
import * as pubs from '@/server/library/publications'
import { grantLevelRole } from '@/server/admin/roles'
import { webhookSignatureOk, paymentProvider } from '@/integrations/payments'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string; role: 'member' | 'tech_admin' }
let giver: U, other: U, treasurer: U, admin: U
const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }> }

beforeAll(async () => {
  delete process.env.PAYSTACK_SECRET_KEY
  await cleanup()
  const mk = async (n: number, u: string, role: U['role'] = 'member') => ({ ...(await makeUser(n, u)), role })
  giver = await mk(951, 'zz_pgive'); other = await mk(952, 'zz_pother'); treasurer = await mk(953, 'zz_ptreas'); admin = await mk(954, 'zz_padmin', 'tech_admin')
  await db.update(schema.users).set({ role: 'tech_admin' }).where(eq(schema.users.id, admin.id))
})
afterAll(async () => { await db.delete(schema.funds).where(sql`name like 'ZZ %'`); await cleanup(); await pool.end() })

describe('giving (test mode)', () => {
  let ref: string
  it('checks the amount and starts a checkout for my assembly', async () => {
    expect(paymentProvider()).toBe('sandbox')
    expect(await pay.startGift(giver, { purpose: 'tithe', amountPesewas: 50 })).toEqual({ ok: false, error: 'amount' })
    expect(await pay.startGift(giver, { purpose: 'tithe', amountPesewas: 20_000_000 })).toEqual({ ok: false, error: 'amount' })
    expect(await pay.startGift(giver, { purpose: 'publication' as never, amountPesewas: 1000 })).toEqual({ ok: false, error: 'purpose' })
    const r = ok(await pay.startGift(giver, { purpose: 'tithe', amountPesewas: 5000, note: 'October tithe' }))
    ref = r.reference
    expect(r.url).toBe(`/give/sandbox?reference=${ref}`)
    const [p] = await db.select().from(schema.payments).where(eq(schema.payments.reference, ref))
    const [u] = await db.select({ a: schema.users.assemblyId }).from(schema.users).where(eq(schema.users.id, giver.id))
    expect(p).toMatchObject({ status: 'pending', level: 'local', assemblyId: u.a, amountPesewas: 5000 })
  })

  it('records success once, thanks the giver, and counts in My giving', async () => {
    expect((await pay.confirmPayment(ref, 'success'))!.status).toBe('success')
    expect((await pay.confirmPayment(ref, 'failed'))!.status).toBe('success') // final results never change
    const n = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, giver.id))
    expect(n.filter((x) => x.type === 'payment')).toHaveLength(1)
    const g = await pay.myGiving(giver.id, new Date().getUTCFullYear())
    expect(g.total).toBe(5000)
    expect(g.byPurpose.tithe).toBe(5000)
    expect((await pay.getReceipt(giver, ref))!.recipient).toMatch(/ZZTEST/)
    expect(await pay.getReceipt(other, ref)).toBeNull()
  })

  it('a failed payment stays failed and does not count', async () => {
    const r = ok(await pay.startGift(giver, { purpose: 'offering', amountPesewas: 2000, level: 'national' }))
    expect((await pay.confirmPayment(r.reference, 'failed'))!.status).toBe('failed')
    expect((await pay.myGiving(giver.id, new Date().getUTCFullYear())).total).toBe(5000)
  })

  it('abandoned checkouts are cleaned up', async () => {
    const r = ok(await pay.startGift(giver, { purpose: 'seed', amountPesewas: 1000 }))
    await db.update(schema.payments).set({ createdAt: sql`now() - interval '3 hours'` }).where(eq(schema.payments.reference, r.reference))
    await pay.settleStalePayments()
    const [p] = await db.select().from(schema.payments).where(eq(schema.payments.reference, r.reference))
    expect(p.status).toBe('abandoned')
  })
})

describe('funds and treasurers', () => {
  let fundId: string
  it('only treasurers (and Tech Admins) create projects; gifts add up', async () => {
    expect(await pay.saveFund(other, { name: 'ZZ Roof', level: 'local' })).toEqual({ ok: false, error: 'not_allowed' })
    const [u] = await db.select({ a: schema.users.assemblyId }).from(schema.users).where(eq(schema.users.id, treasurer.id))
    ok(await grantLevelRole(admin.id, treasurer.id, 'treasurer', { level: 'local', assemblyId: u.a }))
    fundId = ok(await pay.saveFund(treasurer, { name: 'ZZ Roof', level: 'local', targetGhs: 1000 })).id
    const r = ok(await pay.startGift(other, { purpose: 'offering', amountPesewas: 25_000, fundId, anonymous: true }))
    await pay.confirmPayment(r.reference, 'success')
    const f = (await pay.getFund(fundId))!
    expect(f).toMatchObject({ raised: 25_000, targetPesewas: 100_000, givers: 1 })
    const [p] = await db.select().from(schema.payments).where(eq(schema.payments.reference, r.reference))
    expect(p.purpose).toBe('project')
  })

  it('treasurers see their level only; anonymous givers stay hidden', async () => {
    const range = { from: new Date(Date.now() - 86_400_000), to: new Date(Date.now() + 60_000) }
    const mine = (await pay.givingReport(treasurer, range))!
    expect(mine.total).toBeGreaterThanOrEqual(30_000) // the tithe (same test assembly) and the project gift
    expect(mine.items.find((x) => x.fundName === 'ZZ Roof')!.giver).toBeNull()
    expect(await pay.givingReport(other, range)).toBeNull()
    expect((await pay.givingReport(admin, range))!.total).toBeGreaterThanOrEqual(mine.total)
    expect((await pay.reportRows(treasurer, range.from, range.to))!.length).toBe(mine.count)
  })
})

describe('buying publications', () => {
  it('a bought publication opens in full', async () => {
    const [m] = await db.select({ a: schema.users.assemblyId }).from(schema.users).where(eq(schema.users.id, admin.id))
    void m
    const id = ok(await pubs.savePublication(admin, { kind: 'book', format: 'article', title: 'ZZ Paid Book', level: 'local', status: 'published', pricePesewas: 1500, previewPages: 1,
      chapters: [{ title: 'One', body: 'Free' }, { title: 'Two', body: 'Paid' }] })).id
    expect((await pubs.getPublication(id, other))!.access).toBe(false)
    const r = ok(await pay.buyPublication(other, id))
    await pay.confirmPayment(r.reference, 'success')
    expect((await pubs.getPublication(id, other))!.access).toBe(true)
    expect((await pubs.getChapter(id, 2, other))!.chapter!.body).toBe('Paid')
    expect(await pay.buyPublication(other, id)).toEqual({ ok: false, error: 'owned' })
  })
})

describe('Paystack', () => {
  it('accepts only correctly signed webhooks', () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_abc'
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'PAPA-X' } })
    const sig = createHmac('sha512', 'sk_test_abc').update(body).digest('hex')
    expect(webhookSignatureOk(body, sig)).toBe(true)
    expect(webhookSignatureOk(body + ' ', sig)).toBe(false)
    expect(webhookSignatureOk(body, null)).toBe(false)
    expect(paymentProvider()).toBe('paystack')
    delete process.env.PAYSTACK_SECRET_KEY
  })
})
