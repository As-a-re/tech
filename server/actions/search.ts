'use server'

import { getCurrentUser } from '@/server/identity/session'
import { searchPeople } from '@/server/discovery/search'

export async function searchMembersAction(q: string) {
  const me = await getCurrentUser()
  return searchPeople(q, me?.id ?? null, 8)
}
