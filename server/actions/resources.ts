'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/server/identity/session'
import { audit } from '@/server/identity/audit'
import * as res from '@/server/resources/resources'

export async function saveResourceAction(input: res.ResourceInput, id?: string) {
  const me = await requireUser()
  const r = await res.saveResource(me, input, id)
  if (r.ok) revalidatePath('/resources', 'layout')
  return r
}

export async function deleteResourceAction(id: string) {
  const me = await requireUser()
  const ok = await res.deleteResource(me, id)
  if (ok) { revalidatePath('/resources', 'layout'); await audit('resource.deleted', { actorId: me.id, target: id }) }
  return ok
}

/** Returns where to pay. */
export async function orderResourceAction(id: string, size: string | null, qty: number) {
  const me = await requireUser(`/resources/${id}`)
  return res.orderResource(me, id, size, qty)
}

export async function updateOrderAction(orderId: string, action: 'ready' | 'collected' | 'cancel', code?: string) {
  const me = await requireUser()
  const r = await res.updateOrder(me, orderId, action, code)
  if (r.ok) { revalidatePath('/resources/manage'); await audit(`resource.order_${action}`, { actorId: me.id, target: orderId }) }
  return r
}
