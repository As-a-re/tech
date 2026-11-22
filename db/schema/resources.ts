import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './identity'
import { assemblies, districts } from './church'
import { level } from './admin'

const ts = (n: string) => timestamp(n, { withTimezone: true })

/** uniform = ordered in sizes and collected; study_guide = a PDF to read (free or bought). */
export const resourceKind = pgEnum('resource_kind', ['uniform', 'study_guide'])

/** Uniforms and study guides offered by a level of the church (managed by its resource managers). */
export const resources = pgTable('resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: resourceKind('kind').notNull(),
  level: level('level').notNull(),
  districtId: uuid('district_id').references(() => districts.id, { onDelete: 'cascade' }),
  assemblyId: uuid('assembly_id').references(() => assemblies.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  /** Up to 4 pictures; the first is the cover. */
  images: jsonb('images').$type<string[]>().default([]).notNull(),
  pricePesewas: integer('price_pesewas').default(0).notNull(),
  /** Uniforms: sizes with stock left, e.g. [{ size: 'M', stock: 12 }]. */
  sizes: jsonb('sizes').$type<{ size: string; stock: number }[]>().default([]).notNull(),
  /** Where and when to collect (uniforms). */
  pickupInfo: text('pickup_info'),
  /** Study guide PDF (private; opened only by readers allowed to). */
  fileUrl: text('file_url'),
  pageCount: integer('page_count'),
  active: boolean('active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
  deletedAt: ts('deleted_at'),
}, (t) => [index('resources_level_idx').on(t.level, t.kind).where(sql`${t.deletedAt} is null`)])

export const resourceOrderStatus = pgEnum('resource_order_status', ['pending_payment', 'paid', 'ready', 'collected', 'cancelled'])

export const resourceOrders = pgTable('resource_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  resourceId: uuid('resource_id').notNull().references(() => resources.id, { onDelete: 'cascade' }),
  buyerId: uuid('buyer_id').references(() => users.id, { onDelete: 'set null' }),
  size: text('size'),
  qty: integer('qty').default(1).notNull(),
  totalPesewas: integer('total_pesewas').notNull(),
  status: resourceOrderStatus('status').default('pending_payment').notNull(),
  /** Shown to the buyer and checked by the manager at collection. */
  collectionCode: text('collection_code'),
  note: text('note'),
  createdAt: ts('created_at').defaultNow().notNull(),
  paidAt: ts('paid_at'),
  readyAt: ts('ready_at'),
  collectedAt: ts('collected_at'),
  handledBy: uuid('handled_by').references(() => users.id, { onDelete: 'set null' }),
}, (t) => [index('resource_orders_buyer_idx').on(t.buyerId, t.createdAt), index('resource_orders_resource_idx').on(t.resourceId, t.status)])
