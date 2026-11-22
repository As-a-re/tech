'use server'

import { getCurrentUser, requireUser } from '@/server/identity/session'
import * as chat from '@/server/messages/chat'
import { canMessage } from '@/server/messages/access'

/** Open (or create) the direct chat with a member. */
export async function startChatAction(userId: string): Promise<{ ok: true; id: string; error?: never } | { ok: false; error: 'blocked' | 'not_allowed' | 'inactive' | 'self' }> {
  const me = await requireUser()
  if (me.id === userId) return { ok: false, error: 'self' }
  const can = await canMessage(me.id, userId)
  if (!can.ok && 'reason' in can && can.reason !== 'self') {
    // An existing chat can still be opened to read it; a new one needs permission
    const existing = await chat.existingDirectChat(me.id, userId)
    if (!existing || can.reason === 'blocked') return { ok: false, error: can.reason === 'blocked' ? 'blocked' : 'not_allowed' }
    return { ok: true, id: existing }
  }
  return { ok: true, id: await chat.directChat(me.id, userId) }
}

export async function chatsAction(filter: chat.ChatFilter, q?: string) {
  const me = await requireUser()
  return chat.listChats(me.id, filter, q)
}




export async function sendMessageAction(conversationId: string, input: chat.SendInput) {
  const me = await requireUser()
  return chat.sendMessage(me.id, conversationId, input)
}

export async function editMessageAction(id: string, body: string) {
  const me = await requireUser()
  return chat.editMessage(me.id, id, body)
}

export async function unsendAction(id: string) {
  const me = await requireUser()
  return chat.unsend(me.id, id)
}

export async function hideMessageAction(id: string) {
  const me = await requireUser()
  return chat.hideForMe(me.id, id)
}

export async function reactMessageAction(id: string, emoji: string | null) {
  const me = await requireUser()
  return chat.react(me.id, id, emoji)
}

export async function forwardAction(id: string, conversationIds: string[]) {
  const me = await requireUser()
  return chat.forward(me.id, id, conversationIds)
}

/** Share a link (a post, event…) into chats. */
export async function shareToChatsAction(conversationIds: string[], text: string) {
  const me = await requireUser()
  let sent = 0
  for (const c of conversationIds.slice(0, 5)) if ((await chat.sendMessage(me.id, c, { body: text })).ok) sent++
  return sent
}




export async function chatOptionAction(conversationId: string, opt: { muted?: boolean; pinned?: boolean; archived?: boolean; cleared?: boolean }) {
  const me = await requireUser()
  return chat.setChatOption(me.id, conversationId, opt)
}

export async function searchMessagesAction(q: string) {
  const me = await requireUser()
  return chat.searchMessages(me.id, q)
}
