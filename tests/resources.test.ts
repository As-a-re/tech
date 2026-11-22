import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { PDFDocument } from 'pdf-lib'
import { db, pool, schema } from '@/db'
import * as res from '@/server/resources/resources'
import { confirmPayment, settleStalePayments } from '@/server/payments/payments'
import { grantLevelRole } from '@/server/admin/roles'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string; role: 'member' | 'tech_admin' }
let mgr: U, buyer: U, buyer2: U, admin: U
let uniform: string, guide: string, guideFile: string
const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }> }
const stockOf = async (id: string, size: string) => (await db.select().from(schema.resources).where(eq(schema.resources.id, id)))[0].sizes.find((s) => s.size === size)!.stock

beforeAll(async () => {
  delete process.env.PAYSTACK_SECRET_KEY
  await cleanup()
  const mk = async (n: number, u: string, role: U['role'] = 'member') => ({ ...(await makeUser(n, u)), role })
  mgr = await mk(961, 'zz_rmgr'); buyer = await mk(962, 'zz_rbuy'); buyer2 = await mk(963, 'zz_rbuy2'); admin = await mk(964, 'zz_radmin', 'tech_admin')
  await db.update(schema.users).set({ role: 'tech_admin' }).where(eq(schema.users.id, admin.id))
  const doc = await PDFDocument.create(); for (let i = 0; i < 3; i++) doc.addPage([200, 300])
  const dir = path.resolve(process.env.UPLOAD_DIR || './uploads', 'res', mgr.id); await mkdir(dir, { recursive: true })
  const name = `${randomUUID()}.pdf`; await writeFile(path.join(dir, name), await doc.save()); guideFile = `/media/res/${mgr.id}/${name}`
})
afterAll(async () => { await db.delete(schema.resources).where(sql`title like 'ZZ %'`); await cleanup(); await pool.end() })

describe('managing', () => {
  it('only resource managers add items at their level', async () => {
    expect(await res.saveResource(mgr, { kind: 'uniform', level: 'local', title: 'ZZ Shirt', priceGhs: 80, sizes: [{ size: 'M', stock: 2 }] })).toEqual({ ok: false, error: 'not_allowed' })
    const [m] = await db.select({ a: schema.users.assemblyId }).from(schema.users).where(eq(schema.users.id, mgr.id))
    ok(await grantLevelRole(admin.id, mgr.id, 'resource_manager', { level: 'local', assemblyId: m.a }))
    expect(await res.saveResource(mgr, { kind: 'uniform', level: 'local', title: 'ZZ Shirt', priceGhs: 80, sizes: [] })).toEqual({ ok: false, error: 'sizes' })
    expect(await res.saveResource(mgr, { kind: 'uniform', level: 'local', title: 'ZZ Shirt', priceGhs: 80, sizes: [{ size: 'M', stock: 1 }, { size: 'm', stock: 1 }] })).toEqual({ ok: false, error: 'sizes' })
    expect(await res.saveResource(mgr, { kind: 'uniform', level: 'national', title: 'ZZ Shirt', priceGhs: 80, sizes: [{ size: 'M', stock: 2 }] })).toEqual({ ok: false, error: 'not_allowed' })
    uniform = ok(await res.saveResource(mgr, { kind: 'uniform', level: 'local', title: 'ZZ Choir Robe', priceGhs: 150, sizes: [{ size: 'M', stock: 2 }, { size: 'L', stock: 0 }], pickupInfo: 'Office' })).id
    expect(await res.saveResource(mgr, { kind: 'study_guide', level: 'local', title: 'ZZ Guide', priceGhs: 10 })).toEqual({ ok: false, error: 'file' })
    guide = ok(await res.saveResource(mgr, { kind: 'study_guide', level: 'local', title: 'ZZ Guide', priceGhs: 10, fileUrl: guideFile })).id
    expect((await res.getResource(guide, mgr))!.pageCount).toBe(3)
    const [b] = await db.select({ a: schema.users.assemblyId }).from(schema.users).where(eq(schema.users.id, buyer.id))
    expect((await res.listResources({ level: 'local', assemblyId: b.a })).map((x) => x.title)).toEqual(expect.arrayContaining(['ZZ Choir Robe', 'ZZ Guide']))
  })
})

describe('uniform orders', () => {
  let orderRef: string
  it('holds stock while paying; can’t buy more than is left', async () => {
    expect(await res.orderResource(buyer, uniform, 'L', 1)).toEqual({ ok: false, error: 'stock' })
    expect(await res.orderResource(buyer, uniform, 'XL', 1)).toEqual({ ok: false, error: 'size' })
    expect(await res.orderResource(buyer, uniform, 'M', 3)).toEqual({ ok: false, error: 'stock' })
    const r = ok(await res.orderResource(buyer, uniform, 'M', 2))
    orderRef = r.reference
    expect(await stockOf(uniform, 'M')).toBe(0)
    expect(await res.orderResource(buyer2, uniform, 'M', 1)).toEqual({ ok: false, error: 'stock' })
  })

  it('a failed payment gives the stock back', async () => {
    await confirmPayment(orderRef, 'failed')
    expect(await stockOf(uniform, 'M')).toBe(2)
    expect((await res.myOrders(buyer.id))[0].status).toBe('cancelled')
  })

  it('paid → ready (buyer told) → collected with the right code', async () => {
    const r = ok(await res.orderResource(buyer, uniform, 'M', 1))
    await confirmPayment(r.reference, 'success')
    const o = (await res.myOrders(buyer.id)).find((x) => x.status === 'paid')!
    expect(o.collectionCode).toMatch(/^\d{6}$/)
    expect(o.totalPesewas).toBe(15_000)
    expect(await res.updateOrder(buyer2, o.id, 'ready')).toEqual({ ok: false, error: 'not_found' })
    ok(await res.updateOrder(mgr, o.id, 'ready'))
    const n = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, buyer.id))
    expect(n.some((x) => x.type === 'resource_order' && x.resourceOrderId === o.id)).toBe(true)
    expect(await res.updateOrder(mgr, o.id, 'collected', '000000')).toEqual({ ok: false, error: 'code' })
    ok(await res.updateOrder(mgr, o.id, 'collected', o.collectionCode!))
    expect((await res.managerView(mgr, 'collected'))!.orders.map((x) => x.id)).toContain(o.id)
    expect(await stockOf(uniform, 'M')).toBe(1)
  })

  it('cancelling a paid order refunds the record and returns stock; abandoned checkouts too', async () => {
    const r = ok(await res.orderResource(buyer2, uniform, 'M', 1))
    await confirmPayment(r.reference, 'success')
    const o = (await res.myOrders(buyer2.id))[0]
    ok(await res.updateOrder(mgr, o.id, 'cancel'))
    expect(await stockOf(uniform, 'M')).toBe(1)
    const [p] = await db.select().from(schema.payments).where(eq(schema.payments.reference, r.reference))
    expect(p.status).toBe('refunded')
    const r2 = ok(await res.orderResource(buyer2, uniform, 'M', 1))
    expect(await stockOf(uniform, 'M')).toBe(0)
    await db.update(schema.payments).set({ createdAt: sql`now() - interval '3 hours'` }).where(eq(schema.payments.reference, r2.reference))
    await settleStalePayments()
    expect(await stockOf(uniform, 'M')).toBe(1)
  })
})

describe('study guides', () => {
  it('paid guides open only after buying', async () => {
    expect((await res.getResource(guide, buyer))!).toMatchObject({ access: false, fileUrl: null })
    expect(await res.canReadResourceFile(buyer, guideFile)).toBe(false)
    expect(await res.canReadResourceFile(mgr, guideFile)).toBe(true)
    const r = ok(await res.orderResource(buyer, guide, null, 1))
    await confirmPayment(r.reference, 'success')
    expect((await res.getResource(guide, buyer))!.access).toBe(true)
    expect(await res.canReadResourceFile(buyer, guideFile)).toBe(true)
    expect(await res.orderResource(buyer, guide, null, 1)).toEqual({ ok: false, error: 'owned' })
  })
})
