import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { notify, unnotify } from '@/server/notifications/notify'

const sb = () => createSupabaseAdminClient()
const quiet = (p: Promise<unknown>) => p.catch((e) => console.error('notify failed', e))
const fail = (label: string, error: { message: string }) => { throw new Error(`${label}: ${error.message}`) }

export async function getPreferences(userId: string) {
  const client = sb()
  const { data, error } = await client.from('user_preferences').select('*').eq('user_id', userId).maybeSingle()
  if (error) fail('Unable to load user preferences', error)
  if (data) return { userId: data.user_id, privateProfile: data.private_profile, visibleToGuests: data.visible_to_guests,
    textSize: data.text_size, dataSaver: data.data_saver, showBirthday: data.show_birthday, messagesFrom: data.messages_from, callsFrom: data.calls_from, readReceipts: data.read_receipts, showLastSeen: data.show_last_seen, updatedAt: data.updated_at }
  const { data: created, error: createError } = await client.from('user_preferences').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true }).select('*').maybeSingle()
  if (createError) fail('Unable to initialize user preferences', createError)
  if (created) return { userId: created.user_id, privateProfile: created.private_profile, visibleToGuests: created.visible_to_guests,
    textSize: created.text_size, dataSaver: created.data_saver, updatedAt: created.updated_at }
  const { data: existing, error: reloadError } = await client.from('user_preferences').select('*').eq('user_id', userId).single()
  if (reloadError) fail('Unable to reload user preferences', reloadError)
  return { userId: existing.user_id, privateProfile: existing.private_profile, visibleToGuests: existing.visible_to_guests,
    textSize: existing.text_size, dataSaver: existing.data_saver, updatedAt: existing.updated_at }
}

export async function isBlockedEitherWay(a: string, b: string) {
  const { data, error } = await sb().from('blocks').select('blocker_id').or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`).limit(1)
  if (error) fail('Unable to check block status', error)
  return !!data?.length
}

export type Relationship = { self: boolean; following: boolean; followsYou: boolean; requested: boolean; blocking: boolean; blockedBy: boolean; muting: boolean }
export async function relationship(viewerId: string | null, targetId: string): Promise<Relationship> {
  const none = { self: false, following: false, followsYou: false, requested: false, blocking: false, blockedBy: false, muting: false }
  if (!viewerId) return none
  if (viewerId === targetId) return { ...none, self: true }
  const client = sb()
  const checks = await Promise.all([
    client.from('follows').select('follower_id').eq('follower_id', viewerId).eq('followee_id', targetId).maybeSingle(),
    client.from('follows').select('follower_id').eq('follower_id', targetId).eq('followee_id', viewerId).maybeSingle(),
    client.from('follow_requests').select('requester_id').eq('requester_id', viewerId).eq('target_id', targetId).maybeSingle(),
    client.from('blocks').select('blocker_id').eq('blocker_id', viewerId).eq('blocked_id', targetId).maybeSingle(),
    client.from('blocks').select('blocker_id').eq('blocker_id', targetId).eq('blocked_id', viewerId).maybeSingle(),
    client.from('mutes').select('muter_id').eq('muter_id', viewerId).eq('muted_id', targetId).maybeSingle(),
  ])
  const bad = checks.find(x => x.error)
  if (bad?.error) fail('Unable to load relationship', bad.error)
  return { self: false, following: !!checks[0].data, followsYou: !!checks[1].data, requested: !!checks[2].data,
    blocking: !!checks[3].data, blockedBy: !!checks[4].data, muting: !!checks[5].data }
}

export type FollowOutcome = 'following' | 'requested' | 'blocked' | 'self'
export async function follow(viewerId: string, targetId: string): Promise<FollowOutcome> {
  if (viewerId === targetId) return 'self'
  if (await isBlockedEitherWay(viewerId, targetId)) return 'blocked'
  const prefs = await getPreferences(targetId)
  const client = sb()
  if (prefs.privateProfile) {
    const { data: already, error: checkError } = await client.from('follows').select('follower_id').eq('follower_id', viewerId).eq('followee_id', targetId).maybeSingle()
    if (checkError) fail('Unable to check follow', checkError)
    if (already) return 'following'
    const { data, error } = await client.from('follow_requests').upsert({ requester_id: viewerId, target_id: targetId }, { onConflict: 'requester_id,target_id', ignoreDuplicates: true }).select('requester_id')
    if (error) fail('Unable to request follow', error)
    if (data?.length) await quiet(notify(targetId, 'follow_request', viewerId))
    return 'requested'
  }
  const { data, error } = await client.from('follows').upsert({ follower_id: viewerId, followee_id: targetId }, { onConflict: 'follower_id,followee_id', ignoreDuplicates: true }).select('follower_id')
  if (error) fail('Unable to follow member', error)
  if (data?.length) await quiet(notify(targetId, 'follow', viewerId))
  return 'following'
}

export async function unfollow(viewerId: string, targetId: string) {
  const client = sb()
  const [a, b] = await Promise.all([
    client.from('follows').delete().eq('follower_id', viewerId).eq('followee_id', targetId),
    client.from('follow_requests').delete().eq('requester_id', viewerId).eq('target_id', targetId),
  ])
  if (a.error || b.error) fail('Unable to unfollow member', a.error ?? b.error!)
  await quiet(unnotify(targetId, 'follow', viewerId)); await quiet(unnotify(targetId, 'follow_request', viewerId))
}
export async function removeFollower(ownerId: string, followerId: string) {
  const { error } = await sb().from('follows').delete().eq('follower_id', followerId).eq('followee_id', ownerId)
  if (error) fail('Unable to remove follower', error)
}
export async function answerRequest(ownerId: string, requesterId: string, accept: boolean) {
  const client = sb()
  const { data: removed, error } = await client.from('follow_requests').delete().eq('requester_id', requesterId).eq('target_id', ownerId).select('requester_id')
  if (error) fail('Unable to update follow request', error)
  await quiet(unnotify(ownerId, 'follow_request', requesterId))
  if (removed?.length && accept && !(await isBlockedEitherWay(ownerId, requesterId))) {
    const { error: followError } = await client.from('follows').upsert({ follower_id: requesterId, followee_id: ownerId }, { onConflict: 'follower_id,followee_id', ignoreDuplicates: true })
    if (followError) fail('Unable to accept follow request', followError)
    await quiet(notify(requesterId, 'follow_accept', ownerId)); await quiet(notify(ownerId, 'follow', requesterId))
  }
}
export async function acceptAllRequests(ownerId: string) {
  const client = sb()
  const { data, error } = await client.from('follow_requests').delete().eq('target_id', ownerId).select('requester_id')
  if (error) fail('Unable to accept follow requests', error)
  const ids = (data ?? []).map(x => x.requester_id).filter(id => id !== ownerId)
  if (ids.length) {
    const { error: insertError } = await client.from('follows').upsert(ids.map(follower_id => ({ follower_id, followee_id: ownerId })), { onConflict: 'follower_id,followee_id', ignoreDuplicates: true })
    if (insertError) fail('Unable to accept follow requests', insertError)
  }
}
export async function block(viewerId: string, targetId: string) {
  if (viewerId === targetId) return
  const client = sb()
  const { error: blockError } = await client.from('blocks').upsert({ blocker_id: viewerId, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true })
  if (blockError) fail('Unable to block member', blockError)
  const [f, r1, r2] = await Promise.all([
    client.from('follows').delete().or(`and(follower_id.eq.${viewerId},followee_id.eq.${targetId}),and(follower_id.eq.${targetId},followee_id.eq.${viewerId})`),
    client.from('follow_requests').delete().eq('requester_id', viewerId).eq('target_id', targetId),
    client.from('follow_requests').delete().eq('requester_id', targetId).eq('target_id', viewerId),
  ])
  const bad = [f,r1,r2].find(x => x.error)
  if (bad?.error) fail('Unable to clear relationships after blocking', bad.error)
}
export async function unblock(viewerId: string, targetId: string) {
  const { error } = await sb().from('blocks').delete().eq('blocker_id', viewerId).eq('blocked_id', targetId)
  if (error) fail('Unable to unblock member', error)
}
export async function mute(viewerId: string, targetId: string) {
  if (viewerId === targetId) return
  const { error } = await sb().from('mutes').upsert({ muter_id: viewerId, muted_id: targetId }, { onConflict: 'muter_id,muted_id', ignoreDuplicates: true })
  if (error) fail('Unable to mute member', error)
}
export async function unmute(viewerId: string, targetId: string) {
  const { error } = await sb().from('mutes').delete().eq('muter_id', viewerId).eq('muted_id', targetId)
  if (error) fail('Unable to unmute member', error)
}
export async function counts(userId: string) {
  const client = sb()
  const [a,b,c] = await Promise.all([
    client.from('follows').select('follower_id', {count:'exact',head:true}).eq('followee_id', userId),
    client.from('follows').select('followee_id', {count:'exact',head:true}).eq('follower_id', userId),
    client.from('follow_requests').select('requester_id', {count:'exact',head:true}).eq('target_id', userId),
  ])
  const bad = [a,b,c].find(x => x.error); if (bad?.error) fail('Unable to count social relationships', bad.error)
  return { followers:a.count ?? 0, following:b.count ?? 0, requests:c.count ?? 0 }
}

export type PersonRow = { id: string; username: string; fullName: string; avatarUrl: string | null; bio: string | null; assemblyName: string; verified: boolean; at: Date }
const PAGE = 30
export async function listPeople(kind: 'followers' | 'following' | 'requests' | 'blocked' | 'muted', userId: string, before?: Date): Promise<PersonRow[]> {
  const client = sb()
  const spec = {
    followers: { table:'follows', me:'followee_id', them:'follower_id', at:'created_at' },
    following: { table:'follows', me:'follower_id', them:'followee_id', at:'created_at' },
    requests: { table:'follow_requests', me:'target_id', them:'requester_id', at:'created_at' },
    blocked: { table:'blocks', me:'blocker_id', them:'blocked_id', at:'created_at' },
    muted: { table:'mutes', me:'muter_id', them:'muted_id', at:'created_at' },
  }[kind]
  let q = client.from(spec.table).select(`${spec.me},${spec.them},${spec.at}`).eq(spec.me, userId).order(spec.at,{ascending:false}).limit(PAGE)
  if (before) q = q.lt(spec.at, before.toISOString())
  const { data: edges, error } = await q
  if (error) fail('Unable to list social relationships', error)
  const ids = (edges ?? []).map((x:any) => x[spec.them])
  if (!ids.length) return []
  const { data: people, error: peopleError } = await client.from('users').select('id,username,full_name,avatar_url,bio,assembly_id,verified_at,status').in('id',ids).eq('status','active')
  if (peopleError) fail('Unable to load relationship members', peopleError)
  const assemblyIds = [...new Set((people ?? []).map(x => x.assembly_id).filter(Boolean))]
  const { data: assemblies, error: assemblyError } = assemblyIds.length ? await client.from('assemblies').select('id,name').in('id',assemblyIds) : {data:[],error:null}
  if (assemblyError) fail('Unable to load assembly names', assemblyError)
  const names = new Map((assemblies ?? []).map(x => [x.id,x.name]))
  const map = new Map((people ?? []).map(x => [x.id,x]))
  return (edges ?? []).map((edge:any) => { const u:any = map.get(edge[spec.them]); return u ? { id:u.id, username:u.username, fullName:u.full_name, avatarUrl:u.avatar_url,
    bio:u.bio, assemblyName:names.get(u.assembly_id) ?? '', verified:!!u.verified_at, at:new Date(edge[spec.at]) } : null }).filter(Boolean) as PersonRow[]
}
export const PEOPLE_PAGE = PAGE
export async function followingSet(viewerId: string | null, ids: string[]) {
  if (!viewerId || !ids.length) return new Set<string>()
  const { data, error } = await sb().from('follows').select('followee_id').eq('follower_id',viewerId).in('followee_id',ids)
  if (error) fail('Unable to load following status', error)
  return new Set((data ?? []).map(x => x.followee_id))
}
