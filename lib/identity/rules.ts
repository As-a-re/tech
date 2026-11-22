/** Rules shared by forms (client) and server checks, so messages always agree. */
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/
const RESERVED = new Set([
  'admin', 'administrator', 'papa', 'support', 'help', 'settings', 'about', 'terms', 'privacy', 'login', 'register',
  'signin', 'signup', 'logout', 'api', 'media', 'market', 'live', 'give', 'groups', 'messages', 'search', 'explore',
  'notifications', 'official', 'christanointed', 'church', 'tech', 'system', 'root', 'null', 'undefined',
])

export type UsernameProblem = 'length' | 'chars' | 'reserved' | null
export function usernameProblem(u: string): UsernameProblem {
  if (u.length < 3 || u.length > 20) return 'length'
  if (!USERNAME_RE.test(u)) return 'chars'
  if (RESERVED.has(u.toLowerCase())) return 'reserved'
  return null
}

export type PasswordProblem = 'short' | 'long' | 'weak' | null
/** At least 8 characters with at least one letter and one number. */
export function passwordProblem(p: string): PasswordProblem {
  if (p.length < 8) return 'short'
  if (p.length > 128) return 'long'
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'weak'
  return null
}
