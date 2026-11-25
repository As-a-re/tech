import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { db, pool, schema } from '@/db'
import { parseRegisterCsv } from '@/lib/identity/register-ops'
import * as register from '@/server/admin/register'
import * as structure from '@/server/admin/structure'
import * as accounts from '@/server/admin/accounts'
import * as roles from '@/server/admin/roles'
import { getSetting, setSetting } from '@/server/admin/platform-settings'
import { listAudit } from '@/server/admin/audit-log'
import { stats } from '@/server/admin/dashboard'
import { audit } from '@/server/identity/audit'
import { visibleNav } from '@/lib/navigation'
import { cleanup, makeUser } from './helpers'

const D = 'ZZTEST-District Admin', D2 = 'ZZTEST-Other District'
let admin: { id: string }, member: { id: string; churchId: string }
async function wipe() {
  await cleanup()
  await db.delete(schema.churchMembers).where(like(schema.churchMembers.churchId, 'ZZCSV%'))
  await db.delete(schema.assemblies).where(like(schema.assemblies.name, 'ZZTEST%'))
  await db.delete(schema.districts).where(like(schema.districts.name, 'ZZTEST%'))
  await db.delete(schema.platformSettings).where(eq(schema.platformSettings.key, 'bannedWords'))
}
beforeAll(async () => {
  await wipe()
  admin = await makeUser(301, 'zz_admin'); member = await makeUser(302, 'zz_member')
  await db.update(schema.users).set({ role: 'tech_admin' }).where(eq(schema.users.id, admin.id))
})
afterAll(async () => { await wipe(); await pool.end() })

describe('register import', () => {
  it('validates rows and reports problems by line', () => {
    const r = parseRegisterCsv('church_id,full_name,phone,assembly,district,town,date_of_birth\nZZCSV-1,Kojo Annan,0241112222,ZZTEST-Grace,ZZTEST-District Admin,Osu,1990-01-02\nZZCSV-1,Dup,0241112222,A,B\nZZCSV-2,Bad Phone,123,A,B\nZZCSV-3,No Date,0241113333,A,B,,02/01/1990')
    expect(r.records).toHaveLength(1)
    expect(r.problems).toEqual([
      'Line 3: ZZCSV-1 appears more than once',
      'Line 4 (ZZCSV-2): "123" is not a valid Ghana mobile number',
      'Line 5 (ZZCSV-3): date_of_birth must be YYYY-MM-DD',
    ])
    expect(parseRegisterCsv('name,phone\nx,y').fatal).toMatch(/Missing columns/)
  })

  it('adds new members, updates existing ones, creates districts and assemblies, and refreshes linked accounts', async () => {
    const first = await register.importCsv(`church_id,full_name,phone,assembly,district\nZZCSV-10,Abena Mensah,0241110000,ZZTEST-Grace,${D}\nZZCSV-11,Yaw Boateng,0241110001,ZZTEST-Zion,${D}`)
    expect(first).toMatchObject({ ok: true, added: 2, updated: 0, skipped: 0 })
    const again = await register.importCsv(`church_id,full_name,phone,assembly,district\nZZCSV-10,Abena Mensah-Owusu,0241110000,ZZTEST-Zion,${D}`)
    expect(again).toMatchObject({ ok: true, added: 0, updated: 1 })
    const m = await register.getMember('ZZCSV-10')
    expect(m?.fullName).toBe('Abena Mensah-Owusu')
    expect(m?.assemblyName).toBe('ZZTEST-Zion')
    // linked account follows the register
    await register.importCsv(`church_id,full_name,phone,assembly,district\n${member.churchId},Renamed Member,0249000302,ZZTEST-Grace,${D}`)
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, member.id))
    expect(u.fullName).toBe('Renamed Member')
  })
})

describe('member register', () => {
  it('lists with search and status filters', async () => {
    expect((await register.listMembers({ q: 'Yaw Boat' })).rows.map((r) => r.churchId)).toEqual(['ZZCSV-11'])
    expect((await register.listMembers({ q: 'ZZCSV', status: 'not_registered' })).total).toBe(2)
    expect((await register.listMembers({ q: '024 111 0001' })).rows[0]?.churchId).toBe('ZZCSV-11')
  })

  it('validates when adding or editing', async () => {
    const [a] = await structure.listAssemblies({ q: 'ZZTEST-Grace' })
    const base = { churchId: 'ZZCSV-20', fullName: 'Esi Darko', phone: '0241110020', assemblyId: a.id, dateOfBirth: '' }
    expect(await register.saveMember({ ...base, phone: '12' })).toEqual({ ok: false, field: 'phone', error: 'phone_invalid' })
    expect(await register.saveMember({ ...base, assemblyId: '' })).toEqual({ ok: false, field: 'assemblyId', error: 'assembly_required' })
    expect(await register.saveMember(base)).toEqual({ ok: true, churchId: 'ZZCSV-20' })
    expect(await register.saveMember(base)).toEqual({ ok: false, field: 'churchId', error: 'church_id_taken' })
    expect(await register.saveMember({ ...base, fullName: 'Esi Darko-Ofori', dateOfBirth: '1988-12-25' }, 'ZZCSV-20')).toEqual({ ok: true, churchId: 'ZZCSV-20' })
    expect((await register.getMember('ZZCSV-20'))?.dateOfBirth).toBe('1988-12-25')
  })

  it('deactivating a member signs their account out everywhere', async () => {
    await db.insert(schema.sessions).values({ id: 'zz-s1', userId: member.id, expiresAt: new Date(Date.now() + 1e7) })
    await register.setMemberActive(member.churchId, false)
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.userId, member.id))).toEqual([])
    await register.setMemberActive(member.churchId, true)
  })
})

describe('structure', () => {
  it('adds and renames districts and assemblies without duplicates', async () => {
    const d = await structure.saveDistrict(D2)
    expect(d.ok).toBe(true)
    expect(await structure.saveDistrict(` ${D2} `)).toEqual({ ok: false, field: 'name', error: 'name_taken' })
    if (!d.ok) return
    const a = await structure.saveAssembly({ name: 'ZZTEST-Hope', town: 'Ho', districtId: d.id })
    expect(a.ok).toBe(true)
    expect(await structure.saveAssembly({ name: 'ZZTEST-Hope', town: '', districtId: d.id })).toEqual({ ok: false, field: 'name', error: 'name_taken' })
    expect(await structure.saveAssembly({ name: 'X', town: '', districtId: '00000000-0000-0000-0000-000000000000' })).toEqual({ ok: false, field: 'name', error: 'name_short' })
    const list = await structure.listDistricts()
    expect(list.find((x) => x.name === D2)?.assemblies).toBe(1)
  })
})

describe('accounts', () => {
  it('suspends (ending sessions) and restores, but never the admin themself', async () => {
    await db.insert(schema.sessions).values({ id: 'zz-s2', userId: member.id, expiresAt: new Date(Date.now() + 1e7) })
    expect(await accounts.setStatus(admin.id, admin.id, 'suspended')).toEqual({ ok: false, error: 'self' })
    expect(await accounts.setStatus(admin.id, member.id, 'suspended')).toEqual({ ok: true })
    expect(await db.select().from(schema.sessions).where(eq(schema.sessions.userId, member.id))).toEqual([])
    expect((await accounts.listAccounts({ q: 'zz_member', status: 'suspended' })).total).toBe(1)
    expect(await accounts.setStatus(admin.id, member.id, 'active')).toEqual({ ok: true })
  })

  it('keeps at least one Tech Admin', async () => {
    const others = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, 'tech_admin'))
    if (others.length === 1) {
      expect(await accounts.setRole(member.id, admin.id, 'member')).toEqual({ ok: false, error: 'last_admin' })
    }
    expect(await accounts.setRole(admin.id, member.id, 'tech_admin')).toEqual({ ok: true })
    expect(await accounts.setRole(admin.id, member.id, 'member')).toEqual({ ok: true })
    expect(await accounts.setRole(admin.id, admin.id, 'member')).toEqual({ ok: false, error: 'self' })
  })

  it('verified badge on and off', async () => {
    await accounts.setVerified(member.id, 'Official · Test Assembly')
    expect((await accounts.getAccount(member.id))?.verifiedLabel).toBe('Official · Test Assembly')
    await accounts.setVerified(member.id, null)
    expect((await accounts.getAccount(member.id))?.verifiedAt).toBeNull()
  })

  it('searches active accounts for pickers', async () => {
    expect((await accounts.searchAccounts('zz_mem')).map((r) => r.username)).toEqual(['zz_member'])
    expect(await accounts.searchAccounts('z')).toEqual([])
  })
})

describe('level roles', () => {
  it('grants resource managers at a level, refusing duplicates and missing scope', async () => {
    const [dist] = (await structure.listDistricts()).filter((d) => d.name === D)
    expect(await roles.grantLevelRole(admin.id, member.id, 'resource_manager', { level: 'district' })).toEqual({ ok: false, error: 'scope_required' })
    expect(await roles.grantLevelRole(admin.id, member.id, 'resource_manager', { level: 'district', districtId: dist.id })).toEqual({ ok: true })
    expect(await roles.grantLevelRole(admin.id, member.id, 'resource_manager', { level: 'district', districtId: dist.id })).toEqual({ ok: false, error: 'exists' })
    expect(await roles.grantLevelRole(admin.id, member.id, 'resource_manager', { level: 'national' })).toEqual({ ok: true })
    expect(await roles.isResourceManager(member.id, { level: 'district', districtId: dist.id })).toBe(true)
    expect(await roles.isResourceManager(member.id, { level: 'district', districtId: '00000000-0000-0000-0000-000000000000' })).toBe(false)
    const mine = (await roles.listLevelRoles()).filter((r) => r.userId === member.id)
    expect(mine.map((r) => r.level).sort()).toEqual(['district', 'national'])
    for (const r of mine) await roles.revokeLevelRole(r.id)
    expect(await roles.isResourceManager(member.id, { level: 'national' })).toBe(false)
  })
})

describe('platform settings, audit, dashboard, menu', () => {
  it('validates settings and falls back to defaults', async () => {
    expect(await getSetting('bannedWords')).toEqual([])
    expect(await setSetting('bannedWords', ['badword', 'x'])).toBe(false)
    expect(await setSetting('bannedWords', ['Badword'])).toBe(true)
    expect(await getSetting('bannedWords')).toEqual(['badword'])
    expect(await setSetting('marketFeePercent', 50)).toBe(false)
  })
  it('filters the audit log', async () => {
    await audit('admin.zztest_event', { actorId: admin.id, target: 'x' })
    const r = await listAudit({ action: 'admin.zztest', actor: 'ZZ_ADMIN' })
    expect(r.rows[0]?.action).toBe('admin.zztest_event')
  })
  it('computes dashboard numbers', async () => {
    const s = await stats()
    expect(s.accounts).toBeGreaterThanOrEqual(2)
    expect(s.uptake).toBeGreaterThanOrEqual(0)
  })
  it('shows Admin in the menu only to Tech Admins', () => {
    expect(visibleNav(true, { role: 'member' }).some((i) => i.href === '/admin')).toBe(false)
    expect(visibleNav(true, { role: 'tech_admin' }).some((i) => i.href === '/admin')).toBe(true)
  })
})
