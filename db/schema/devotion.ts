import { sql } from 'drizzle-orm'
import { boolean, date, index, integer, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './identity'
import { assemblies } from './church'

const ts = (n: string) => timestamp(n, { withTimezone: true })
const userRef = (n: string) => uuid(n).notNull().references(() => users.id, { onDelete: 'cascade' })

/* ───────── Prayer requests ───────── */
/** everyone = the whole church; assembly = only members of the author's assembly. */
export const prayerAudience = pgEnum('prayer_audience', ['everyone', 'assembly'])

export const prayerRequests = pgTable('prayer_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: userRef('author_id'),
  body: text('body').notNull(),
  /** Name hidden from other members (Tech Admins can still see who posted, for safety). */
  anonymous: boolean('anonymous').default(false).notNull(),
  audience: prayerAudience('audience').default('everyone').notNull(),
  assemblyId: uuid('assembly_id').notNull().references(() => assemblies.id, { onDelete: 'cascade' }),
  prayedCount: integer('prayed_count').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  answeredAt: ts('answered_at'),
  answerNote: text('answer_note'),
  createdAt: ts('created_at').defaultNow().notNull(),
  deletedAt: ts('deleted_at'),
}, (t) => [
  index('prayer_requests_created_idx').on(t.createdAt).where(sql`${t.deletedAt} is null`),
  index('prayer_requests_author_idx').on(t.authorId),
  index('prayer_requests_assembly_idx').on(t.assemblyId, t.createdAt),
])

/** "I prayed" — one per member per request. */
export const prayerPrayed = pgTable('prayer_prayed', {
  prayerId: uuid('prayer_id').notNull().references(() => prayerRequests.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.prayerId, t.userId] }), index('prayer_prayed_user_idx').on(t.userId)])

/* ───────── Testimonies ───────── */
export const testimonies = pgTable('testimonies', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: userRef('author_id'),
  title: text('title').notNull(),
  body: text('body').notNull(),
  /** A testimony can tell how a prayer request was answered. */
  prayerId: uuid('prayer_id').references(() => prayerRequests.id, { onDelete: 'set null' }),
  praiseCount: integer('praise_count').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
  editedAt: ts('edited_at'),
  deletedAt: ts('deleted_at'),
}, (t) => [index('testimonies_created_idx').on(t.createdAt).where(sql`${t.deletedAt} is null`), index('testimonies_author_idx').on(t.authorId)])

export const testimonyMedia = pgTable('testimony_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  testimonyId: uuid('testimony_id').notNull().references(() => testimonies.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  alt: text('alt'),
  width: integer('width'),
  height: integer('height'),
  position: smallint('position').notNull(),
}, (t) => [index('testimony_media_idx').on(t.testimonyId)])

/** "Praise God" — one per member per testimony. */
export const testimonyPraises = pgTable('testimony_praises', {
  testimonyId: uuid('testimony_id').notNull().references(() => testimonies.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.testimonyId, t.userId] })])

/** Words of encouragement on a prayer request, or comments on a testimony. */
export const devotionComments = pgTable('devotion_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  prayerId: uuid('prayer_id').references(() => prayerRequests.id, { onDelete: 'cascade' }),
  testimonyId: uuid('testimony_id').references(() => testimonies.id, { onDelete: 'cascade' }),
  authorId: userRef('author_id'),
  body: text('body').notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
  deletedAt: ts('deleted_at'),
}, (t) => [index('devotion_comments_prayer_idx').on(t.prayerId, t.createdAt), index('devotion_comments_testimony_idx').on(t.testimonyId, t.createdAt)])

/* ───────── Verse of the day ───────── */
/** Verses chosen by Tech Admins for particular days. Other days use PAPA's built-in list. */
export const dailyVerses = pgTable('daily_verses', {
  day: date('day').primaryKey(),
  reference: text('reference').notNull(),
  text: text('text').notNull(),
  translation: text('translation').default('KJV').notNull(),
  setBy: uuid('set_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
})

/** Daily jobs record the day they ran, so each runs once per day across all servers. */
export const jobRuns = pgTable('job_runs', {
  job: text('job').notNull(),
  day: date('day').notNull(),
  ranAt: ts('ran_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.job, t.day] })])
