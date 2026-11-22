/** Shared, dependency-free church directory types used by both client UI and server schema. */
export type ServiceTime = { day: number; start: string; end?: string | null; label: string }
export type Leader = { name: string; role: string; username?: string | null }
