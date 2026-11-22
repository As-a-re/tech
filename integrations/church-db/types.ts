/** What PAPA needs from the church's standard database. Both adapters return exactly this. */
export type ChurchMember = {
  churchId: string
  fullName: string
  phone: string // normalised 233XXXXXXXXX
  active: boolean
  dateOfBirth: string | null // YYYY-MM-DD
  assembly: { externalId: string; name: string; town: string | null }
  district: { externalId: string; name: string }
}

/** One page of members whose details changed since a point in time (for the background sync). */
export type ChurchChanges = { members: ChurchMember[]; nextCursor: string | null; until: string }

export interface ChurchDirectory {
  /** Look up one member by Church ID. null when not found. */
  findMember(churchId: string): Promise<ChurchMember | null>
  /** Members changed since `since` (ISO time), page by page. Only the API adapter supports it. */
  changes?(since: string, cursor?: string | null): Promise<ChurchChanges>
}
