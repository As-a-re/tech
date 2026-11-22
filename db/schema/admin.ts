import { sql } from 'drizzle-orm'
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { assemblies, districts } from './church'
import { users } from './identity'

const ts = (n: string) => timestamp(n, { withTimezone: true })

/** National / District / Local — used by roles now, and by announcements, live, giving and resources later. */
export const level = pgEnum('level', ['national', 'district', 'local'])
/** resource_manager (uniforms, study guides), publications_editor (Publications), childrens_ministry (Kids content and Sunday school lessons), media_team (Live services), treasurer (giving reports for their level). */
export const levelRoleKind = pgEnum('level_role', ['resource_manager', 'publications_editor', 'childrens_ministry', 'media_team', 'treasurer'])

/** Roles held at one level of the church, e.g. "Resource manager for Madina District". */
export const levelRoles = pgTable('level_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: levelRoleKind('role').notNull(),
  level: level('level').notNull(),
  districtId: uuid('district_id').references(() => districts.id, { onDelete: 'cascade' }),
  assemblyId: uuid('assembly_id').references(() => assemblies.id, { onDelete: 'cascade' }),
  grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('level_roles_unique_idx').on(t.userId, t.role, t.level, sql`coalesce(${t.districtId}, '00000000-0000-0000-0000-000000000000')`, sql`coalesce(${t.assemblyId}, '00000000-0000-0000-0000-000000000000')`),
  index('level_roles_user_idx').on(t.userId),
])
