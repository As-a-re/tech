'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/server/identity/session'
import { audit } from '@/server/identity/audit'
import * as pay from '@/server/payments/payments'

/** Returns where to send the member to pay. */
export async function startGiftAction(input: pay.GiftInput) {
  const me = await requireUser('/give')
  return pay.startGift(me, input)
}

export async function buyPublicationAction(id: string) {
  const me = await requireUser(`/publications/${id}`)
  return pay.buyPublication(me, id)
}

export async function saveFundAction(input: pay.FundInput, id?: string) {
  const me = await requireUser()
  const r = await pay.saveFund(me, input, id)
  if (r.ok) { revalidatePath('/give', 'layout'); await audit(id ? 'giving.fund_updated' : 'giving.fund_created', { actorId: me.id, target: r.id }) }
  return r
}
