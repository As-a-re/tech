import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './identity'
import { assemblies, districts } from './church'
import { level } from './admin'

const ts = (n: string) => timestamp(n, { withTimezone: true })
const userRef = (n: string) => uuid(n).notNull().references(() => users.id, { onDelete: 'cascade' })

/** studio = broadcast from PAPA (camera or screen, through LiveKit); youtube = a YouTube Live link shown in PAPA. */
export const liveSource = pgEnum('live_source', ['studio', 'youtube'])
export const liveStatus = pgEnum('live_status', ['scheduled', 'live', 'ended'])

export const lives = pgTable('lives', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  coverUrl: text('cover_url'),
  level: level('level').notNull(),
  districtId: uuid('district_id').references(() => districts.id, { onDelete: 'cascade' }),
  assemblyId: uuid('assembly_id').references(() => assemblies.id, { onDelete: 'cascade' }),
  source: liveSource('source').notNull(),
  youtubeUrl: text('youtube_url'),
  status: liveStatus('status').default('scheduled').notNull(),
  scheduledAt: ts('scheduled_at').notNull(),
  startedAt: ts('started_at'),
  endedAt: ts('ended_at'),
  /** Recording to watch afterwards: an uploaded video or a YouTube link. */
  replayUrl: text('replay_url'),
  /** Show the Give button (offerings) during the service. */
  giving: boolean('giving').default(true).notNull(),
  peakViewers: integer('peak_viewers').default(0).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
  deletedAt: ts('deleted_at'),
}, (t) => [
  index('lives_status_idx').on(t.status, t.scheduledAt).where(sql`${t.deletedAt} is null`),
])

export const liveComments = pgTable('live_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  liveId: uuid('live_id').notNull().references(() => lives.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
  body: text('body').notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
  deletedAt: ts('deleted_at'),
}, (t) => [index('live_comments_idx').on(t.liveId, t.createdAt)])

/** Who is watching now (members by id, guests by a random key); a viewer counts while they checked in within the last minute. */
export const liveViewers = pgTable('live_viewers', {
  liveId: uuid('live_id').notNull().references(() => lives.id, { onDelete: 'cascade' }),
  viewerKey: text('viewer_key').notNull(),
  lastSeenAt: ts('last_seen_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.liveId, t.viewerKey] })])

/** 🙏🏾 🔥 ❤️ 🙌 👏 counts during a live. */
export const liveReactions = pgTable('live_reactions', {
  liveId: uuid('live_id').notNull().references(() => lives.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  count: integer('count').default(0).notNull(),
}, (t) => [primaryKey({ columns: [t.liveId, t.emoji] })])

/** "Remind me": told when this service goes live. */
export const liveReminders = pgTable('live_reminders', {
  liveId: uuid('live_id').notNull().references(() => lives.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
}, (t) => [primaryKey({ columns: [t.liveId, t.userId] })])
