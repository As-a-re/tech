import { webhookSignatureOk } from '@/integrations/payments'
import { confirmPayment } from '@/server/payments/payments'
import { payoutResult } from '@/server/market/payouts'

/**
 * Paystack webhook (set it in the Paystack dashboard: https://YOUR-DOMAIN/api/payments/paystack).
 * Confirms payments even if the member closed the page before coming back to PAPA, and the result of payouts.
 */
export async function POST(req: Request) {
  const raw = await req.text()
  if (!webhookSignatureOk(raw, req.headers.get('x-paystack-signature'))) return new Response('bad signature', { status: 401 })
  const e = JSON.parse(raw) as { event?: string; data?: { reference?: string } }
  if ((e.event === 'charge.success' || e.event === 'charge.failed') && e.data?.reference) await confirmPayment(e.data.reference)
  // Seller and rider payouts (Paystack Transfers)
  if (e.event?.startsWith('transfer.') && e.data?.reference) await payoutResult(e.data.reference, e.event === 'transfer.success' ? 'paid' : 'failed', e.event)
  return new Response('ok')
}
