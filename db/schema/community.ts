import { sql } from 'drizzle-orm'
import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './identity'
import { assemblies, districts } from './church'
import { level } from './admin'
import type { Leader, ServiceTime } from '@/lib/church/types'
export type { Leader, ServiceTime } from '@/lib/church/types'

const ts = (n: string) => timestamp(n, { withTimezone: true })
const userRef = (n: string) => uuid(n).notNull().references(() => users.id, { onDelete: 'cascade' })
const districtRef = () => uuid('district_id').references(() => districts.id, { onDelete: 'cascade' })
const assemblyRef = () => uuid('assembly_id').references(() => assemblies.id, { onDelete: 'cascade' })

/* ───────── Announcements (National / District / Local) ───────── */
export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: userRef('author_id'),
  level: level('level').notNull(),
  districtId: districtRef(),
  assemblyId: assemblyRef(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  /** Shown with a red "Important" label and kept at the top of its level for 7 days. */
  important: boolean('important').default(false).notNull(),
  viewCount: integer('view_count').default(0).notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
  editedAt: ts('edited_at'),
  deletedAt: ts('deleted_at'),
}, (t) => [
  index('announcements_level_idx').on(t.level, t.createdAt).where(sql`${t.deletedAt} is null`),
  index('announcements_district_idx').on(t.districtId, t.createdAt),
  index('announcements_assembly_idx').on(t.assemblyId, t.createdAt),
  index('announcements_author_idx').on(t.authorId, t.createdAt),
  index('announcements_search_idx').using('gin', sql`to_tsvector('simple', ${t.title} || ' ' || ${t.body})`),
])

export const announcementMedia = pgTable('announcement_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  announcementId: uuid('announcement_id').notNull().references(() => announcements.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  alt: text('alt'),
  width: integer('width'),
  height: integer('height'),
  position: smallint('position').notNull(),
}, (t) => [index('announcement_media_idx').on(t.announcementId)])

/**
 * "Notify me" per level. scope = 'national' | 'd:<districtId>' | 'a:<assemblyId>'.
 * With no row, a member is notified for National, their own district and their own assembly.
 */
export const levelSubscriptions = pgTable('level_subscriptions', {
  userId: userRef('user_id'),
  scope: text('scope').notNull(),
  on: boolean('on').notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.scope] }), index('level_subscriptions_scope_idx').on(t.scope)])

/* ───────── Events ───────── */
export const rsvpStatus = pgEnum('rsvp_status', ['going', 'interested'])

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: userRef('author_id'),
  level: level('level').notNull(),
  districtId: districtRef(),
  assemblyId: assemblyRef(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  startsAt: ts('starts_at').notNull(),
  endsAt: ts('ends_at'),
  venue: text('venue'),
  address: text('address'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  onlineUrl: text('online_url'),
  coverUrl: text('cover_url'),
  goingCount: integer('going_count').default(0).notNull(),
  interestedCount: integer('interested_count').default(0).notNull(),
  remindedDayAt: ts('reminded_day_at'),
  remindedHourAt: ts('reminded_hour_at'),
  cancelledAt: ts('cancelled_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
  deletedAt: ts('deleted_at'),
}, (t) => [
  index('events_starts_idx').on(t.startsAt).where(sql`${t.deletedAt} is null`),
  index('events_district_idx').on(t.districtId, t.startsAt),
  index('events_assembly_idx').on(t.assemblyId, t.startsAt),
  index('events_author_idx').on(t.authorId),
])

export const eventRsvps = pgTable('event_rsvps', {
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
  status: rsvpStatus('status').notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.eventId, t.userId] }), index('event_rsvps_user_idx').on(t.userId)])

/* ───────── Assembly directory ───────── */

/** App-owned details about an assembly (kept even in api mode, where the assembly itself comes from the church database). */
export const assemblyProfiles = pgTable('assembly_profiles', {
  assemblyId: uuid('assembly_id').primaryKey().references(() => assemblies.id, { onDelete: 'cascade' }),
  about: text('about'),
  address: text('address'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  phone: text('phone'),
  email: text('email'),
  photoUrl: text('photo_url'),
  serviceTimes: jsonb('service_times').$type<ServiceTime[]>().default([]).notNull(),
  leaders: jsonb('leaders').$type<Leader[]>().default([]).notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: ts('updated_at').defaultNow().notNull(),
})
