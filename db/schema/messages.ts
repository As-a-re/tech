import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { users } from './identity'

const ts = (n: string) => timestamp(n, { withTimezone: true })
const userRef = (n: string) => uuid(n).notNull().references(() => users.id, { onDelete: 'cascade' })

/** direct = two members; group = many (Batch 10 builds on the same tables). */
export const conversationKind = pgEnum('conversation_kind', ['direct', 'group'])
export const memberRole = pgEnum('conversation_role', ['member', 'admin'])
export const messageKind = pgEnum('message_kind', ['text', 'image', 'video', 'audio', 'file', 'system', 'call'])
export const groupVisibility = pgEnum('group_visibility', ['private', 'public'])

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: conversationKind('kind').notNull(),
  /** For direct chats: the two member ids, sorted and joined, so each pair has only one chat. */
  directKey: text('direct_key'),
  title: text('title'),
  avatarUrl: text('avatar_url'),
  /* Groups only */
  description: text('description'),
  /** public = listed in Groups → Discover, anyone can join (or ask to); private = by invitation only. */
  visibility: groupVisibility('visibility').default('private').notNull(),
  /** "Announcement" mode: only admins can send. */
  onlyAdminsSend: boolean('only_admins_send').default(false).notNull(),
  /** Only admins can change the name, photo and description. */
  onlyAdminsEdit: boolean('only_admins_edit').default(true).notNull(),
  /** Members (not just admins) can add people. */
  membersCanAdd: boolean('members_can_add').default(false).notNull(),
  /** Joining by link or from Discover needs an admin's approval. */
  approveJoins: boolean('approve_joins').default(false).notNull(),
  inviteCode: text('invite_code'),
  deletedAt: ts('deleted_at'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  lastMessageAt: ts('last_message_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('conversations_direct_key_idx').on(t.directKey), index('conversations_last_idx').on(t.lastMessageAt), uniqueIndex('conversations_invite_idx').on(t.inviteCode),
  index('conversations_public_idx').on(t.visibility).where(sql`${t.kind} = 'group' and ${t.deletedAt} is null`)])

export const conversationMembers = pgTable('conversation_members', {
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
  role: memberRole('role').default('member').notNull(),
  joinedAt: ts('joined_at').defaultNow().notNull(),
  /** Read receipts and delivery ticks. */
  lastReadAt: ts('last_read_at'),
  lastDeliveredAt: ts('last_delivered_at'),
  mutedUntil: ts('muted_until'),
  archived: boolean('archived').default(false).notNull(),
  pinnedAt: ts('pinned_at'),
  /** "Clear chat" hides everything before this time for this member only. */
  clearedAt: ts('cleared_at'),
  leftAt: ts('left_at'),
}, (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index('conversation_members_user_idx').on(t.userId)])

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  kind: messageKind('kind').default('text').notNull(),
  body: text('body').notNull().default(''),
  replyToId: uuid('reply_to_id').references((): AnyPgColumn => messages.id, { onDelete: 'set null' }),
  forwarded: boolean('forwarded').default(false).notNull(),
  /** Sent by the browser so a retried send never creates two messages. */
  clientId: text('client_id'),
  createdAt: ts('created_at').defaultNow().notNull(),
  editedAt: ts('edited_at'),
  /** "Delete for everyone". */
  deletedAt: ts('deleted_at'),
}, (t) => [
  index('messages_conversation_idx').on(t.conversationId, t.createdAt),
  uniqueIndex('messages_client_idx').on(t.senderId, t.clientId),
  index('messages_search_idx').using('gin', sql`to_tsvector('simple', ${t.body})`),
])

export const messageAttachments = pgTable('message_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  kind: messageKind('kind').notNull(),
  url: text('url').notNull(),
  name: text('name'),
  size: integer('size'),
  mime: text('mime'),
  width: integer('width'),
  height: integer('height'),
  /** Seconds, for voice notes and videos. */
  duration: integer('duration'),
}, (t) => [index('message_attachments_msg_idx').on(t.messageId)])

export const messageReactions = pgTable('message_reactions', {
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
  emoji: text('emoji').notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.messageId, t.userId] })])

/** "Delete for me". */
export const messageHidden = pgTable('message_hidden', {
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
}, (t) => [primaryKey({ columns: [t.messageId, t.userId] })])

/** People asking to join a group that needs approval. */
export const groupJoinRequests = pgTable('group_join_requests', {
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.conversationId, t.userId] })])

/* ───── Calls (Batch 11) ───── */
export const callMedia = pgEnum('call_media', ['voice', 'video'])
export const callStatus = pgEnum('call_status', ['ringing', 'active', 'ended'])
/** How a call finished: completed (someone answered), missed (no answer), declined, busy, cancelled (caller hung up first), failed. */
export const callResult = pgEnum('call_result', ['completed', 'missed', 'declined', 'busy', 'cancelled', 'failed'])
export const callPartState = pgEnum('call_participant_state', ['ringing', 'joined', 'left', 'declined', 'missed', 'busy'])

/** One call in a chat or group. The LiveKit room is named after the call id. */
export const calls = pgTable('calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  startedBy: uuid('started_by').references(() => users.id, { onDelete: 'set null' }),
  media: callMedia('media').notNull(),
  status: callStatus('status').default('ringing').notNull(),
  result: callResult('result'),
  startedAt: ts('started_at').defaultNow().notNull(),
  answeredAt: ts('answered_at'),
  endedAt: ts('ended_at'),
}, (t) => [index('calls_conversation_idx').on(t.conversationId, t.startedAt), index('calls_open_idx').on(t.status).where(sql`${t.status} <> 'ended'`)])

/** Everyone rung (or who joined) in a call. lastPingAt keeps a joined member "in" the call while their screen is open. */
export const callParticipants = pgTable('call_participants', {
  callId: uuid('call_id').notNull().references(() => calls.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
  state: callPartState('state').default('ringing').notNull(),
  invitedAt: ts('invited_at').defaultNow().notNull(),
  joinedAt: ts('joined_at'),
  leftAt: ts('left_at'),
  lastPingAt: ts('last_ping_at'),
}, (t) => [primaryKey({ columns: [t.callId, t.userId] }), index('call_participants_user_idx').on(t.userId, t.invitedAt)])
