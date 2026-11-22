import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const sb = () => createSupabaseAdminClient()

/** The member's row in a chat they haven't left, or null. */
export async function membership(conversationId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return null
  const { data: member, error: memberError } = await sb().from('conversation_members')
    .select('*').eq('conversation_id', conversationId).eq('user_id', userId).is('left_at', null).maybeSingle()
  if (memberError) throw new Error(`Unable to check conversation membership: ${memberError.message}`)
  if (!member) return null
  const { data: conversation, error } = await sb().from('conversations').select('deleted_at').eq('id', conversationId).maybeSingle()
  if (error) throw new Error(`Unable to check conversation: ${error.message}`)
  if (!conversation || conversation.deleted_at) return null
  return {
    conversationId: member.conversation_id, userId: member.user_id, role: member.role,
    joinedAt: member.joined_at, leftAt: member.left_at, lastReadAt: member.last_read_at,
    mutedUntil: member.muted_until, archivedAt: member.archived_at, pinnedAt: member.pinned_at, clearedAt: member.cleared_at,
  }
}

export async function isBlockedEitherWay(a: string, b: string) {
  const { data, error } = await sb().from('blocks').select('id').or(
    `and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`,
  ).limit(1)
  if (error) throw new Error(`Unable to check blocks: ${error.message}`)
  return (data?.length ?? 0) > 0
}

export type CanMessage = { ok: true } | { ok: false; reason: 'blocked' | 'not_allowed' | 'inactive' | 'self' }

/** Direct-message authorization, including recipient preferences and existing conversation replies. */
export async function canMessage(from: string, to: string, conversationId?: string | null): Promise<CanMessage> {
  if (from === to) return { ok: false, reason: 'self' }
  const { data: user, error } = await sb().from('users').select('id,status,user_preferences(messages_from)').eq('id', to).maybeSingle()
  if (error) throw new Error(`Unable to check recipient: ${error.message}`)
  if (!user || user.status !== 'active') return { ok: false, reason: 'inactive' }
  if (await isBlockedEitherWay(from, to)) return { ok: false, reason: 'blocked' }
  const prefs = Array.isArray(user.user_preferences) ? user.user_preferences[0] : user.user_preferences
  if ((prefs?.messages_from ?? 'everyone') === 'following') {
    const { data: follows, error: followError } = await sb().from('follows').select('follower_id')
      .eq('follower_id', to).eq('followee_id', from).limit(1)
    if (followError) throw new Error(`Unable to check follow relationship: ${followError.message}`)
    if (follows?.length) return { ok: true }
    if (conversationId) {
      const { data: wrote, error: wroteError } = await sb().from('messages').select('id')
        .eq('conversation_id', conversationId).eq('sender_id', to).limit(1)
      if (wroteError) throw new Error(`Unable to check conversation history: ${wroteError.message}`)
      if (wrote?.length) return { ok: true }
    }
    return { ok: false, reason: 'not_allowed' }
  }
  return { ok: true }
}

/** Private chat files: uploader or a current member who was present when the file was sent. */
export async function canOpenChatFile(userId: string, url: string) {
  if (url.startsWith(`/media/chat/${userId}/`)) return true
  const { data: attachment, error: attachmentError } = await sb().from('message_attachments')
    .select('message_id').eq('url', url).maybeSingle()
  if (attachmentError) throw new Error(`Unable to check attachment: ${attachmentError.message}`)
  if (!attachment) return false
  const { data: message, error: messageError } = await sb().from('messages')
    .select('id,conversation_id,created_at,deleted_at').eq('id', attachment.message_id).maybeSingle()
  if (messageError) throw new Error(`Unable to check message: ${messageError.message}`)
  if (!message || message.deleted_at) return false
  const { data: member, error: memberError } = await sb().from('conversation_members')
    .select('joined_at').eq('conversation_id', message.conversation_id).eq('user_id', userId)
    .lte('joined_at', message.created_at).limit(1)
  if (memberError) throw new Error(`Unable to check file access: ${memberError.message}`)
  return (member?.length ?? 0) > 0
}
