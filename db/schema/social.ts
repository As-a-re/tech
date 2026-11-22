import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './identity'

const ts = (n: string) => timestamp(n, { withTimezone: true })
const userRef = (n: string) => uuid(n).notNull().references(() => users.id, { onDelete: 'cascade' })

export const follows = pgTable('follows', {
  followerId: userRef('follower_id'),
  followeeId: userRef('followee_id'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.followerId, t.followeeId] }), index('follows_followee_idx').on(t.followeeId)])

/** Pending follows for private profiles. */
export const followRequests = pgTable('follow_requests', {
  requesterId: userRef('requester_id'),
  targetId: userRef('target_id'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.requesterId, t.targetId] }), index('follow_requests_target_idx').on(t.targetId)])

/** Blocking hides both members from each other and removes follows. */
export const blocks = pgTable('blocks', {
  blockerId: userRef('blocker_id'),
  blockedId: userRef('blocked_id'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index('blocks_blocked_idx').on(t.blockedId)])

/** Muting quietly hides someone's posts from your feeds; they are not told. */
export const mutes = pgTable('mutes', {
  muterId: userRef('muter_id'),
  mutedId: userRef('muted_id'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.muterId, t.mutedId] })])
