'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/server/identity/session'
import * as rel from '@/server/social/relationships'

const refresh = () => revalidatePath('/', 'layout')

export async function followAction(targetId: string) { const me = await requireUser(); const r = await rel.follow(me.id, targetId); refresh(); return r }
export async function unfollowAction(targetId: string) { const me = await requireUser(); await rel.unfollow(me.id, targetId); refresh() }
export async function removeFollowerAction(followerId: string) { const me = await requireUser(); await rel.removeFollower(me.id, followerId); refresh() }
export async function answerRequestAction(requesterId: string, accept: boolean) { const me = await requireUser(); await rel.answerRequest(me.id, requesterId, accept); refresh() }
export async function blockAction(targetId: string) { const me = await requireUser(); await rel.block(me.id, targetId); refresh() }
export async function unblockAction(targetId: string) { const me = await requireUser(); await rel.unblock(me.id, targetId); refresh() }
export async function muteAction(targetId: string) { const me = await requireUser(); await rel.mute(me.id, targetId); refresh() }
export async function unmuteAction(targetId: string) { const me = await requireUser(); await rel.unmute(me.id, targetId); refresh() }
