import { sql } from 'drizzle-orm'
import { boolean, index, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './identity'
import { posts } from './posts'
import { announcements, events } from './community'
import { prayerRequests, testimonies } from './devotion'
import { conversations } from './messages'
import { publications } from './library'
import { payments } from './payments'
import { resourceOrders } from './resources'
import { lives } from './live'
import { marketOrders, products, shops } from './market'

const ts = (n: string) => timestamp(n, { withTimezone: true })
const userRef = (n: string) => uuid(n).notNull().references(() => users.id, { onDelete: 'cascade' })

/* ───────── Notifications ───────── */
export const notificationType = pgEnum('notification_type', [
  'like', 'repost', 'reply', 'quote', 'mention', 'follow', 'follow_request', 'follow_accept', 'poll_ended',
  'announcement', 'event', 'event_reminder', 'event_cancelled',
  'prayed', 'prayer_comment', 'prayer_answered', 'testimony_praise', 'testimony_comment', 'birthday',
  /** Push only (chats have their own unread counts, not rows in Notifications). */
  'message',
  /** Push only: incoming and missed calls. */
  'call',
  /** A new issue in a series the member follows. */
  'publication',
  /** A service you follow (your levels) or asked to be reminded about went live. */
  'live',
  /** "Thank you: your gift was received". */
  'payment',
  /** A uniform order is ready to collect (or was collected). */
  'resource_order',
  /** Buyer: an order of mine was confirmed, shipped, delivered, cancelled or refunded. */
  'market_order',
  /** Seller: a new paid order, or a buyer's cancel/return request. */
  'market_sale',
  /** Seller: a question about my product; buyer: my question was answered. */
  'market_question',
  /** Seller: a new review of my product. */
  'market_review',
  /** Back in stock or price dropped (alerts the member asked for). */
  'market_alert',
  /** A shop the member follows put a new item on sale. */
  'market_new',
  /** Riders: a new delivery job near them, or an update on one (seller/buyer get delivery steps as market_order/market_sale). */
  'market_delivery',
  /** Sellers and riders: money was sent (or a payout failed). */
  'market_payout',
  /** Riders: application approved or not. */
  'market_rider',
])

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef('user_id'),
  type: notificationType('type').notNull(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'cascade' }),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  announcementId: uuid('announcement_id').references(() => announcements.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
  prayerId: uuid('prayer_id').references(() => prayerRequests.id, { onDelete: 'cascade' }),
  testimonyId: uuid('testimony_id').references(() => testimonies.id, { onDelete: 'cascade' }),
  publicationId: uuid('publication_id').references(() => publications.id, { onDelete: 'cascade' }),
  liveId: uuid('live_id').references(() => lives.id, { onDelete: 'cascade' }),
  paymentId: uuid('payment_id').references(() => payments.id, { onDelete: 'cascade' }),
  resourceOrderId: uuid('resource_order_id').references(() => resourceOrders.id, { onDelete: 'cascade' }),
  marketOrderId: uuid('market_order_id').references(() => marketOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  readAt: ts('read_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [index('notifications_user_idx').on(t.userId, t.createdAt), index('notifications_unread_idx').on(t.userId).where(sql`read_at is null`)])

/** Browser push subscriptions (one per device). */
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef('user_id'),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [index('push_user_idx').on(t.userId)])

/** Per-member notification choices: { like: { inApp: true, push: true }, ... }. Missing = defaults. */
export type NotificationPrefs = Partial<Record<(typeof notificationType.enumValues)[number], { inApp: boolean; push: boolean }>>
export const notificationSettings = pgTable('notification_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  prefs: jsonb('prefs').$type<NotificationPrefs>().default({}).notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})

/* ───────── Lists ───────── */
export const lists = pgTable('lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: userRef('owner_id'),
  name: text('name').notNull(),
  description: text('description'),
  isPrivate: boolean('is_private').default(false).notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [index('lists_owner_idx').on(t.ownerId)])

export const listMembers = pgTable('list_members', {
  listId: uuid('list_id').notNull().references(() => lists.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
  addedAt: ts('added_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.listId, t.userId] })])

/* ───────── Bookmark folders ───────── */
export const bookmarkFolders = pgTable('bookmark_folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: userRef('user_id'),
  name: text('name').notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [index('bookmark_folders_user_idx').on(t.userId)])

/* ───────── Reports (moderation) ───────── */
export const reportReason = pgEnum('report_reason', ['spam', 'abuse', 'false_info', 'inappropriate', 'impersonation', 'other'])
export const reportStatus = pgEnum('report_status', ['open', 'actioned', 'dismissed'])

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: userRef('reporter_id'),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
  announcementId: uuid('announcement_id').references(() => announcements.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
  prayerId: uuid('prayer_id').references(() => prayerRequests.id, { onDelete: 'cascade' }),
  testimonyId: uuid('testimony_id').references(() => testimonies.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'cascade' }),
  targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }),
  reason: reportReason('reason').notNull(),
  details: text('details'),
  status: reportStatus('status').default('open').notNull(),
  handledBy: uuid('handled_by').references(() => users.id, { onDelete: 'set null' }),
  handledAt: ts('handled_at'),
  resolution: text('resolution'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [index('reports_status_idx').on(t.status, t.createdAt)])
