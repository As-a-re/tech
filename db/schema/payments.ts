import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './identity'
import { assemblies, districts } from './church'
import { level } from './admin'
import { publications } from './library'
import { lives } from './live'
import { resourceOrders } from './resources'
import { marketCheckouts } from './market'

const ts = (n: string) => timestamp(n, { withTimezone: true })

/** Giving campaigns and projects (e.g. "Church building", "Missions"), shown on Give with a progress bar. */
export const funds = pgTable('funds', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  coverUrl: text('cover_url'),
  level: level('level').notNull(),
  districtId: uuid('district_id').references(() => districts.id, { onDelete: 'cascade' }),
  assemblyId: uuid('assembly_id').references(() => assemblies.id, { onDelete: 'cascade' }),
  /** Pesewas; null = no target. */
  targetPesewas: integer('target_pesewas'),
  endsOn: timestamp('ends_on', { withTimezone: true }),
  active: boolean('active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
})

export const paymentPurpose = pgEnum('payment_purpose', ['offering', 'tithe', 'seed', 'thanksgiving', 'project', 'welfare', 'publication', 'resource', 'order'])
export const paymentStatus = pgEnum('payment_status', ['pending', 'success', 'failed', 'abandoned', 'refunded'])

/**
 * One payment: a gift to a level of the church (offering, tithe…), a gift to a fund, or buying a publication.
 * Money goes through the payment provider (Paystack: mobile money and cards); PAPA only records it.
 */
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Our reference, sent to the provider and printed on the receipt. */
  reference: text('reference').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  purpose: paymentPurpose('purpose').notNull(),
  amountPesewas: integer('amount_pesewas').notNull(),
  currency: text('currency').default('GHS').notNull(),
  status: paymentStatus('status').default('pending').notNull(),
  provider: text('provider').notNull(),
  /** mobile_money, card, bank… as reported by the provider. */
  channel: text('channel'),
  /** Who receives it (the member's own assembly by default). */
  level: level('level').notNull(),
  districtId: uuid('district_id').references(() => districts.id, { onDelete: 'set null' }),
  assemblyId: uuid('assembly_id').references(() => assemblies.id, { onDelete: 'set null' }),
  fundId: uuid('fund_id').references(() => funds.id, { onDelete: 'set null' }),
  liveId: uuid('live_id').references(() => lives.id, { onDelete: 'set null' }),
  publicationId: uuid('publication_id').references(() => publications.id, { onDelete: 'set null' }),
  /** Uniform or study guide order (Resources). */
  resourceOrderId: uuid('resource_order_id').references(() => resourceOrders.id, { onDelete: 'set null' }),
  /** Market checkout (purpose order): one payment for one order per shop. */
  marketCheckoutId: uuid('market_checkout_id').references(() => marketCheckouts.id, { onDelete: 'set null' }),
  note: text('note'),
  /** Hide the giver's name from treasurers' lists (the amount still counts). */
  anonymous: boolean('anonymous').default(false).notNull(),
  providerData: jsonb('provider_data').$type<Record<string, unknown>>(),
  paidAt: ts('paid_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('payments_reference_idx').on(t.reference),
  index('payments_user_idx').on(t.userId, t.createdAt),
  index('payments_paid_idx').on(t.status, t.paidAt),
  index('payments_purchase_idx').on(t.userId, t.publicationId).where(sql`${t.status} = 'success'`),
])
