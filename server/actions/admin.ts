'use server'

import { closeGroup } from '@/server/messages/groups'
import { deletePublication } from '@/server/library/publications'
import { deleteKidsItem } from '@/server/library/kids'
import { deleteLive } from '@/server/live/live'
import { deleteResource } from '@/server/resources/resources'
import * as marketAdmin from '@/server/market/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { env } from '@/lib/env'
import { requestMeta, requireTechAdmin } from '@/server/identity/session'
import { audit } from '@/server/identity/audit'
import * as register from '@/server/admin/register'
import * as structure from '@/server/admin/structure'
import * as accounts from '@/server/admin/accounts'
import * as roles from '@/server/admin/roles'
import { setSetting } from '@/server/admin/platform-settings'
import * as reports from '@/server/moderation/reports'
import { deletePost } from '@/server/posts/compose'
import * as directory from '@/server/community/directory'
import { deleteAnnouncement } from '@/server/community/announcements'
import { deleteEvent } from '@/server/community/events'
import { deletePrayer } from '@/server/devotion/prayer'
import { deleteTestimony } from '@/server/devotion/testimonies'
import * as verses from '@/server/devotion/verse'

export type AdminResult = { ok?: boolean; error?: string; fields?: Record<string, string>; data?: Record<string, unknown> }
const s = (f: FormData, k: string) => String(f.get(k) ?? '')
async function admin() {
  const me = await requireTechAdmin('/admin')
  return { me, ip: (await requestMeta()).ip }
}
const localOnly = (): AdminResult | null => (env.churchDbMode === 'api' ? { error: 'api_mode' } : null)

/* ───── Member register ───── */

export async function saveMemberAction(_: AdminResult, f: FormData): Promise<AdminResult> {
  const { me, ip } = await admin()
  const blocked = localOnly(); if (blocked) return blocked
  const existing = s(f, 'existing') || undefined
  const r = await register.saveMember({ churchId: s(f, 'churchId'), fullName: s(f, 'fullName'), phone: s(f, 'phone'), assemblyId: s(f, 'assemblyId'), dateOfBirth: s(f, 'dateOfBirth') }, existing)
  if (!r.ok) return { fields: { [('field' in r ? r.field : 'form')]: ('error' in r ? ('error' in r ? r.error : 'unknown') : 'unknown') } }
  await audit(existing ? 'admin.member_updated' : 'admin.member_added', { actorId: me.id, target: r.churchId, ip })
  revalidatePath('/admin', 'layout')
  if (!existing) redirect(`/admin/members/${encodeURIComponent(r.churchId)}?notice=added`)
  return { ok: true }
}

export async function setMemberActiveAction(churchId: string, active: boolean) {
  const { me, ip } = await admin()
  if (localOnly()) return
  await register.setMemberActive(churchId, active)
  await audit(active ? 'admin.member_activated' : 'admin.member_deactivated', { actorId: me.id, target: churchId, ip })
  revalidatePath('/admin', 'layout')
}

export async function importCsvAction(_: AdminResult, f: FormData): Promise<AdminResult> {
  const { me, ip } = await admin()
  const blocked = localOnly(); if (blocked) return blocked
  const file = f.get('file')
  if (!(file instanceof File) || file.size === 0) return { fields: { file: 'file_required' } }
  if (file.size > 10 * 1024 * 1024) return { fields: { file: 'file_too_large' } }
  const r = await register.importCsv(await file.text())
  if (!r.ok) return { error: 'csv_columns', data: { detail: ('error' in r ? ('error' in r ? r.error : 'unknown') : 'unknown') } }
  await audit('admin.register_imported', { actorId: me.id, ip, meta: { added: r.added, updated: r.updated, skipped: r.skipped, file: file.name } })
  revalidatePath('/admin', 'layout')
  return { ok: true, data: { added: r.added, updated: r.updated, skipped: r.skipped, problems: r.problems } }
}

/* ───── Districts & assemblies ───── */

export async function saveDistrictAction(_: AdminResult, f: FormData): Promise<AdminResult> {
  const { me, ip } = await admin()
  const blocked = localOnly(); if (blocked) return blocked
  const id = s(f, 'id') || undefined
  const r = await structure.saveDistrict(s(f, 'name'), id)
  if (!r.ok) return { fields: { [('field' in r ? r.field : 'form')]: ('error' in r ? ('error' in r ? r.error : 'unknown') : 'unknown') } }
  await audit(id ? 'admin.district_updated' : 'admin.district_added', { actorId: me.id, target: s(f, 'name').trim(), ip })
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function saveAssemblyAction(_: AdminResult, f: FormData): Promise<AdminResult> {
  const { me, ip } = await admin()
  const blocked = localOnly(); if (blocked) return blocked
  const id = s(f, 'id') || undefined
  const r = await structure.saveAssembly({ name: s(f, 'name'), town: s(f, 'town'), districtId: s(f, 'districtId') }, id)
  if (!r.ok) return { fields: { [('field' in r ? r.field : 'form')]: ('error' in r ? ('error' in r ? r.error : 'unknown') : 'unknown') } }
  await audit(id ? 'admin.assembly_updated' : 'admin.assembly_added', { actorId: me.id, target: s(f, 'name').trim(), ip })
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

/* ───── Accounts ───── */

export async function setAccountStatusAction(id: string, status: 'active' | 'suspended'): Promise<AdminResult> {
  const { me, ip } = await admin()
  const r = await accounts.setStatus(me.id, id, status)
  if (!r.ok) return { error: ('error' in r ? ('error' in r ? r.error : 'unknown') : 'unknown') }
  await audit(status === 'suspended' ? 'admin.account_suspended' : 'admin.account_restored', { actorId: me.id, target: id, ip })
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function setAccountRoleAction(id: string, role: 'member' | 'tech_admin'): Promise<AdminResult> {
  const { me, ip } = await admin()
  const r = await accounts.setRole(me.id, id, role)
  if (!r.ok) return { error: ('error' in r ? ('error' in r ? r.error : 'unknown') : 'unknown') }
  await audit(role === 'tech_admin' ? 'admin.tech_admin_granted' : 'admin.tech_admin_revoked', { actorId: me.id, target: id, ip })
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function setVerifiedAction(_: AdminResult, f: FormData): Promise<AdminResult> {
  const { me, ip } = await admin()
  const id = s(f, 'id'); const remove = f.get('remove') === '1'
  await accounts.setVerified(id, remove ? null : s(f, 'label'))
  await audit(remove ? 'admin.verified_removed' : 'admin.verified_set', { actorId: me.id, target: id, ip, meta: remove ? undefined : { label: s(f, 'label') } })
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function resetTwoFactorAction(id: string): Promise<AdminResult> {
  const { me, ip } = await admin()
  await accounts.resetTwoFactor(id)
  await audit('admin.2fa_reset', { actorId: me.id, target: id, ip })
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function signOutEverywhereAction(id: string): Promise<AdminResult> {
  const { me, ip } = await admin()
  await accounts.signOutEverywhere(id)
  await audit('admin.sessions_ended', { actorId: me.id, target: id, ip })
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function searchAccountsAction(q: string) {
  await admin()
  return accounts.searchAccounts(q)
}

/* ───── Level roles (resource managers) ───── */

export async function grantRoleAction(_: AdminResult, f: FormData): Promise<AdminResult> {
  const { me, ip } = await admin()
  const level = s(f, 'level') as 'national' | 'district' | 'local'
  if (!['national', 'district', 'local'].includes(level)) return { fields: { level: 'scope_required' } }
  if (!s(f, 'userId')) return { fields: { userId: 'member_required' } }
  const role = (roles.LEVEL_ROLES as readonly string[]).includes(s(f, 'role')) ? s(f, 'role') as roles.LevelRole : 'resource_manager'
  const r = await roles.grantLevelRole(me.id, s(f, 'userId'), role, { level, districtId: s(f, 'districtId'), assemblyId: s(f, 'assemblyId') })
  if (!r.ok) return { error: ('error' in r ? ('error' in r ? r.error : 'unknown') : 'unknown') }
  await audit(`admin.${role}_granted`, { actorId: me.id, target: s(f, 'userId'), ip, meta: { level } })
  revalidatePath('/admin/roles')
  return { ok: true }
}

export async function revokeRoleAction(id: string) {
  const { me, ip } = await admin()
  const row = await roles.revokeLevelRole(id)
  if (row) await audit(`admin.${row.role}_revoked`, { actorId: me.id, target: row.userId, ip, meta: { level: row.level } })
  revalidatePath('/admin/roles')
}

/* ───── Platform settings ───── */

export async function saveSupportAction(_: AdminResult, f: FormData): Promise<AdminResult> {
  const { me, ip } = await admin()
  const email = s(f, 'email').trim(), phone = s(f, 'phone').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { fields: { email: 'email_invalid' } }
  await setSetting('support', { email, phone })
  await audit('admin.settings_support', { actorId: me.id, ip })
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function saveBannedWordsAction(_: AdminResult, f: FormData): Promise<AdminResult> {
  const { me, ip } = await admin()
  const words = [...new Set(s(f, 'words').split(/[\n,]/).map((w) => w.trim().toLowerCase()).filter((w) => w.length >= 2))]
  if (!(await setSetting('bannedWords', words))) return { fields: { words: 'words_invalid' } }
  await audit('admin.settings_banned_words', { actorId: me.id, ip, meta: { count: words.length } })
  revalidatePath('/admin/settings')
  return { ok: true, data: { count: words.length } }
}

export async function saveMarketFeeAction(_: AdminResult, f: FormData): Promise<AdminResult> {
  const { me, ip } = await admin()
  const v = Number(s(f, 'fee'))
  if (!Number.isFinite(v) || !(await setSetting('marketFeePercent', Math.round(v * 100) / 100))) return { fields: { fee: 'fee_invalid' } }
  await audit('admin.settings_market_fee', { actorId: me.id, ip, meta: { percent: v } })
  revalidatePath('/admin/settings')
  return { ok: true }
}

export async function searchAssembliesAction(q: string) {
  await admin()
  if (q.trim().length < 2) return []
  return (await structure.listAssemblies({ q })).slice(0, 12).map((a) => ({ id: a.id, name: a.name, town: a.town, districtName: a.districtName }))
}

/* ───── Reports ───── */
export async function resolveReportAction(reportId: string, action: 'remove_post' | 'suspend' | 'dismiss'): Promise<AdminResult> {
  const { me, ip } = await admin()
  const r = await reports.resolveReports(reportId, me.id, action === 'dismiss' ? 'dismissed' : 'actioned', action)
  if (!r) return { error: 'not_found' }
  if (action === 'remove_post') {
    if (r.postId) await deletePost(me.id, r.postId, true)
    if (r.announcementId) await deleteAnnouncement(me.id, r.announcementId, true)
    if (r.eventId) await deleteEvent(me.id, r.eventId, true)
    if (r.prayerId) await deletePrayer(me.id, r.prayerId, true)
    if (r.testimonyId) await deleteTestimony(me.id, r.testimonyId, true)
    if (r.conversationId) await closeGroup(r.conversationId)
    if (r.productId) await marketAdmin.setProductStatus(r.productId, 'removed')
    if (r.shopId) await marketAdmin.setShopStatus(r.shopId, 'suspended')
  }
  if (action === 'suspend' && r.targetUserId) {
    const s = await accounts.setStatus(me.id, r.targetUserId, 'suspended')
    if (!s.ok) return { error: 'error' in s ? s.error : 'unknown' }
  }
  await audit(`admin.report_${action}`, { actorId: me.id, target: r.postId ?? r.announcementId ?? r.eventId ?? r.prayerId ?? r.testimonyId ?? r.conversationId ?? r.productId ?? r.shopId ?? r.targetUserId ?? reportId, ip, meta: { reportId, reason: r.reason } })
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

/* ───── Directory & content ───── */
export async function saveAssemblyProfileAction(assemblyId: string, input: directory.ProfileInput): Promise<AdminResult> {
  const { me, ip } = await admin()
  const r = await directory.saveAssemblyProfile(me.id, assemblyId, input)
  if (!r.ok) return { error: ('error' in r ? ('error' in r ? r.error : 'unknown') : 'unknown') }
  await audit('admin.assembly_profile_saved', { actorId: me.id, target: assemblyId, ip })
  revalidatePath('/assemblies', 'layout')
  return { ok: true }
}

export async function removeContentAction(kind: 'announcement' | 'event' | 'prayer' | 'testimony' | 'publication' | 'kids' | 'live' | 'resource', id: string): Promise<AdminResult> {
  const { me, ip } = await admin()
  const ok = kind === 'resource' ? await deleteResource(me, id) : kind === 'live' ? await deleteLive(me, id) : kind === 'publication' ? await deletePublication(me, id) : kind === 'kids' ? await deleteKidsItem(me, id) : kind === 'announcement' ? await deleteAnnouncement(me.id, id, true) : kind === 'event' ? await deleteEvent(me.id, id, true)
    : kind === 'prayer' ? await deletePrayer(me.id, id, true) : await deleteTestimony(me.id, id, true)
  if (!ok) return { error: 'not_found' }
  await audit(`admin.${kind}_removed`, { actorId: me.id, target: id, ip })
  revalidatePath('/admin/content')
  return { ok: true }
}

/* ───── Daily verse ───── */
export async function setVerseAction(_: AdminResult, f: FormData): Promise<AdminResult> {
  const { me, ip } = await admin()
  const r = await verses.setVerse(me.id, { day: s(f, 'day'), reference: s(f, 'reference'), text: s(f, 'text'), translation: s(f, 'translation') })
  if (!r.ok) return { error: ('error' in r ? ('error' in r ? r.error : 'unknown') : 'unknown') }
  await audit('admin.verse_set', { actorId: me.id, target: s(f, 'day'), ip })
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function removeVerseAction(day: string): Promise<AdminResult> {
  const { me, ip } = await admin()
  await verses.removeVerse(day)
  await audit('admin.verse_removed', { actorId: me.id, target: day, ip })
  revalidatePath('/', 'layout')
  return { ok: true }
}
