import { sql } from 'drizzle-orm'
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { assemblies, churchMembers } from './church'

const ts = (n: string) => timestamp(n, { withTimezone: true })

export const userRole = pgEnum('user_role', ['member', 'tech_admin'])
export const userStatus = pgEnum('user_status', ['active', 'suspended'])
export const codePurpose = pgEnum('code_purpose', ['register', 'reset_password', 'change_phone'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  churchId: text('church_id').notNull().unique().references(() => churchMembers.churchId, { onDelete: 'restrict' }),
  username: text('username').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  passwordHash: text('password_hash').notNull(),
  assemblyId: uuid('assembly_id').notNull().references(() => assemblies.id, { onDelete: 'restrict' }),
  role: userRole('role').default('member').notNull(),
  status: userStatus('status').default('active').notNull(),
  locale: text('locale').default('en').notNull(),
  avatarUrl: text('avatar_url'),
  coverUrl: text('cover_url'),
  bio: text('bio'),
  website: text('website'),
  /** Optional wedding anniversary the member adds themselves (only day and month are shown). */
  anniversary: date('anniversary'),
  usernameChangedAt: ts('username_changed_at'),
  /** TOTP secret, encrypted with AUTH_SECRET (AES-256-GCM). */
  totpSecret: text('totp_secret'),
  totpEnabledAt: ts('totp_enabled_at'),
  /** Verified badge (official accounts), set by Tech Admins. */
  verifiedAt: ts('verified_at'),
  verifiedLabel: text('verified_label'),
  onboardedAt: ts('onboarded_at'),
  passwordChangedAt: ts('password_changed_at').defaultNow().notNull(),
  lastSeenAt: ts('last_seen_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`),
  index('users_assembly_idx').on(t.assemblyId),
])

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // SHA-256 of the cookie token; the token itself is never stored
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: ts('expires_at').notNull(),
  userAgent: text('user_agent'),
  ip: text('ip'),
  lastUsedAt: ts('last_used_at').defaultNow().notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [index('sessions_user_idx').on(t.userId)])

/** One-time SMS codes. Only a hash is stored. */
export const verificationCodes = pgTable('verification_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull(),
  purpose: codePurpose('purpose').notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  expiresAt: ts('expires_at').notNull(),
  consumedAt: ts('consumed_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [index('verification_codes_phone_idx').on(t.phone, t.purpose)])

/** Fixed-window counters shared by all app servers (sign-in, SMS sends…). */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: ts('reset_at').notNull(),
})

/** Security and admin trail. */
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  target: text('target'),
  meta: jsonb('meta'),
  ip: text('ip'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [index('audit_log_created_idx').on(t.createdAt), index('audit_log_actor_idx').on(t.actorId)])

/** Per-member settings (privacy, display). Created with defaults on first read. */
export const textSize = pgEnum('text_size', ['small', 'default', 'large', 'xlarge'])
export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  privateProfile: boolean('private_profile').default(false).notNull(),
  visibleToGuests: boolean('visible_to_guests').default(true).notNull(),
  textSize: textSize('text_size').default('default').notNull(),
  dataSaver: boolean('data_saver').default(false).notNull(),
  /** Day and month of the birthday (from the church register) shown to members. The year is never shown. */
  showBirthday: boolean('show_birthday').default(true).notNull(),
  /** Who can start a chat: everyone, or only people I follow. */
  messagesFrom: text('messages_from').default('everyone').notNull(),
  /** Blue ticks: when off, others don't see when you've read, and you don't see theirs. */
  readReceipts: boolean('read_receipts').default(true).notNull(),
  /** "Online" / "last seen" in chats. */
  showLastSeen: boolean('show_last_seen').default(true).notNull(),
  /** Who can call me: everyone, people I follow, or nobody. */
  callsFrom: text('calls_from').default('everyone').notNull(),
  /** Missed calls after this time count on the Messages badge until the Calls tab is opened. */
  callsSeenAt: ts('calls_seen_at'),
  /** Kids mode: the parent's PIN (hashed) needed to leave it. */
  kidsPinHash: text('kids_pin_hash'),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})

/** One-time backup codes for 2-step verification (hash only). */
export const backupCodes = pgTable('backup_codes', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  usedAt: ts('used_at'),
}, (t) => [primaryKey({ columns: [t.userId, t.codeHash] })])
