/** Kids mode is a setting on this device (a cookie), so a parent can hand over the phone. */
export const KIDS_COOKIE = 'papa_kids'
export const KIDS_AGES = ['all', '0_4', '5_8', '9_12'] as const
export type KidsAge = (typeof KIDS_AGES)[number]
export const isKidsAge = (v: unknown): v is KidsAge => typeof v === 'string' && (KIDS_AGES as readonly string[]).includes(v)

/** Paths a child can open in Kids mode; everything else goes back to the Kids home. */
export function kidsAllowed(path: string) {
  return path === '/children' || path.startsWith('/children/') || path.startsWith('/media/') || path.startsWith('/api/') || path.startsWith('/_next/')
    || path.startsWith('/demo/') || path === '/offline' || path === '/login' || path.startsWith('/pdf.worker') || path === '/sw.js' || path === '/manifest.webmanifest'
}
