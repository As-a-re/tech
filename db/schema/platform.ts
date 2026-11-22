import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Platform-wide settings managed by the Tech Department (market fee, banned words, feature switches…). */
export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
