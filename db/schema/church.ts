import { boolean, date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Church structure and member register.
 * - CHURCH_DB_MODE=local: these tables ARE the register (filled by import / Admin).
 * - CHURCH_DB_MODE=api:   they are a cache of the church's standard database, refreshed through its API.
 */
const ts = (n: string) => timestamp(n, { withTimezone: true })

export const districts = pgTable('districts', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: text('external_id').unique(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: ts('created_at').defaultNow().notNull(),
})

export const assemblies = pgTable('assemblies', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: text('external_id').unique(),
  districtId: uuid('district_id').notNull().references(() => districts.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  town: text('town'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [index('assemblies_district_idx').on(t.districtId)])

export const churchMembers = pgTable('church_members', {
  churchId: text('church_id').primaryKey(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  assemblyId: uuid('assembly_id').notNull().references(() => assemblies.id, { onDelete: 'restrict' }),
  active: boolean('active').default(true).notNull(),
  dateOfBirth: date('date_of_birth'),
  /** Set for the first Tech Admin during setup; applied when they register. */
  grantTechAdmin: boolean('grant_tech_admin').default(false).notNull(),
  syncedAt: ts('synced_at').defaultNow().notNull(),
}, (t) => [index('church_members_assembly_idx').on(t.assemblyId), index('church_members_phone_idx').on(t.phone)])
