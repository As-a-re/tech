import 'server-only'
import { cookies } from 'next/headers'
import { KIDS_COOKIE, isKidsAge, type KidsAge } from './kids-mode'

/** The age group when this device is in Kids mode, or null. */
export async function kidsMode(): Promise<KidsAge | null> {
  const v = (await cookies()).get(KIDS_COOKIE)?.value
  return v ? (isKidsAge(v) ? v : 'all') : null
}
