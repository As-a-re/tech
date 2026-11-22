import { relations } from 'drizzle-orm'
import { assemblies, churchMembers, districts } from './church'
import { userPreferences, users } from './identity'

export const districtsRelations = relations(districts, ({ many }) => ({ assemblies: many(assemblies) }))
export const assembliesRelations = relations(assemblies, ({ one, many }) => ({
  district: one(districts, { fields: [assemblies.districtId], references: [districts.id] }),
  members: many(churchMembers),
}))
export const churchMembersRelations = relations(churchMembers, ({ one }) => ({
  assembly: one(assemblies, { fields: [churchMembers.assemblyId], references: [assemblies.id] }),
}))
export const usersRelations = relations(users, ({ one }) => ({
  assembly: one(assemblies, { fields: [users.assemblyId], references: [assemblies.id] }),
  preferences: one(userPreferences, { fields: [users.id], references: [userPreferences.userId] }),
}))
