import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/server/identity/session'
import { paymentProvider } from '@/integrations/payments'
import { confirmPayment } from '@/server/payments/payments'

/** Test checkout (only when no payment provider keys are set): the member chooses "paid" or "failed". */
export async function POST(req: Request) {
  if (paymentProvider() !== 'sandbox') return Response.json({ ok: false }, { status: 404 })
  const me = await getCurrentUser()
  const b = await req.json().catch(() => ({})) as { reference?: string; result?: string }
  const { data: p, error } = b.reference ? await createSupabaseAdminClient().from('payments').select('reference,user_id').eq('reference', b.reference).maybeSingle() : { data: null, error: null }
  if (error) throw new Error(`Unable to load sandbox payment: ${error.message}`)
  if (!me || !p || p.user_id !== me.id) return Response.json({ ok: false }, { status: 404 })
  const v = await confirmPayment(p.reference, b.result === 'success' ? 'success' : 'failed')
  return Response.json({ ok: true, status: v?.status })
}
