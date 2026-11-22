import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { eq, sql } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import { syncChurchChanges } from '@/server/identity/church-sync'
import { cleanup, makeUser } from './helpers'

/** The church database's "changes" endpoint, two pages. */
let server: Server, calls: string[] = []
const member = (id: string, o: Record<string, unknown> = {}) => ({ church_id: id, full_name: 'Moved Member', phone: '0244 000 111', status: 'active', date_of_birth: null,
  assembly: { id: 'ZZA-9', name: 'ZZTEST-Sync Assembly', town: 'Tema' }, district: { id: 'ZZD-9', name: 'ZZTEST-Sync District' }, ...o })
let churchId = '', userId = ''

beforeAll(async () => {
  await cleanup()
  const u = await makeUser(1001, 'zz_sync')
  churchId = u.churchId; userId = u.id
  await db.insert(schema.sessions).values({ id: 'zztest-sync-session', userId, expiresAt: new Date(Date.now() + 86_400_000) })
  server = createServer((req, res) => {
    calls.push(req.url!)
    if (req.headers.authorization !== 'Bearer k1') { res.writeHead(401).end(); return }
    const u = new URL(req.url!, 'http://x')
    const page = u.searchParams.get('cursor') === 'p2'
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(page
      ? { members: [member(churchId, { status: 'inactive', full_name: 'Test Member Renamed' })], next_cursor: null, until: '2026-10-28T12:00:00Z' }
      : { members: [member(churchId, { full_name: 'Test Member Renamed' })], next_cursor: 'p2', until: '2026-10-28T11:00:00Z' }))
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  Object.assign(process.env, { CHURCH_DB_MODE: 'api', CHURCH_DB_API_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, CHURCH_DB_API_KEY: 'k1' })
})
afterAll(async () => {
  for (const k of ['CHURCH_DB_MODE', 'CHURCH_DB_API_URL', 'CHURCH_DB_API_KEY']) delete process.env[k]
  await db.execute(sql`delete from platform_settings where key like 'churchSync%'`)
  await new Promise<void>((r) => server.close(() => r()))
  await db.delete(schema.users).where(eq(schema.users.id, userId))
  await cleanup(); await pool.end()
})

describe('background sync from the church database', () => {
  it('applies every page: name, phone, assembly move, and deactivation signs the member out', async () => {
    expect(await syncChurchChanges(true)).toBe(2)
    expect(calls[0]).toMatch(/^\/members\/changes\?since=1970-01-01/)
    expect(calls[1]).toContain('cursor=p2')
    const [m] = await db.select().from(schema.churchMembers).where(eq(schema.churchMembers.churchId, churchId))
    expect(m).toMatchObject({ fullName: 'Test Member Renamed', phone: '233244000111', active: false })
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId))
    expect(u.fullName).toBe('Test Member Renamed')
    const [a] = await db.select().from(schema.assemblies).where(eq(schema.assemblies.id, u.assemblyId))
    expect(a.name).toBe('ZZTEST-Sync Assembly')
    expect(await db.$count(schema.sessions, eq(schema.sessions.userId, userId))).toBe(0)
  })

  it('remembers where it stopped and waits 15 minutes between runs', async () => {
    calls = []
    expect(await syncChurchChanges()).toBe(0)
    expect(calls).toHaveLength(0)
    await syncChurchChanges(true)
    expect(calls[0]).toContain('since=2026-10-28T12%3A00%3A00Z')
  })
})
