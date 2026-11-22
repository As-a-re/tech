import 'server-only'
import { cookies } from 'next/headers'
import { DISPLAY_COOKIES } from './display'

/** True when the member turned on Data saver (skip large images, no video autoplay). */
export async function isDataSaver() {
  return (await cookies()).get(DISPLAY_COOKIES.dataSaver)?.value === '1'
}
