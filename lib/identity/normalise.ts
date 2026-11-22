/** Church IDs are compared upper-case without spaces: "cac 0012" → "CAC0012". */
export const normaliseChurchId = (v: string) => v.trim().toUpperCase().replace(/\s+/g, '')

/**
 * Ghana numbers in international form without "+":
 * 024 123 4567 · +233 24 123 4567 · 00233241234567 · 241234567 → 233241234567
 */
export function normalisePhone(v: string) {
  let d = v.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0') && d.length === 10) d = '233' + d.slice(1)
  if (d.length === 9) d = '233' + d
  return d
}
export const isGhanaMobile = (normalised: string) => /^233[2-5]\d{8}$/.test(normalised)

/** "233241234567" → "+233 24 123 4567" */
export const formatPhone = (n: string) => (n.length === 12 ? `+${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8)}` : `+${n}`)
/** "233241234567" → "+233 24 *** **67" (for "code sent to …") */
export const maskPhone = (n: string) => (n.length === 12 ? `+${n.slice(0, 3)} ${n.slice(3, 5)} *** **${n.slice(10)}` : '***')

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-')
