import 'server-only'
import { redirect } from 'next/navigation'
import { requireUser } from '@/server/identity/session'
import { myShop } from './seller'

/** For seller pages: the signed-in member and their shop (no shop yet → "Become a seller"). */
export async function requireShop(next: string) {
  const me = await requireUser(next)
  const shop = await myShop(me.id)
  if (!shop) redirect('/market/sell')
  return { me, shop }
}
