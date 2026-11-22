import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Payments: Paystack (mobile money MTN/Telecel/AirtelTigo and cards, in GHS) when PAYSTACK_SECRET_KEY is set;
 * otherwise a sandbox that imitates the checkout so giving can be tested without real money.
 * PAPA never sees card or MoMo PINs: members pay on the provider's page and we confirm with the provider.
 */
export type ProviderName = 'paystack' | 'sandbox'
export const paymentProvider = (): ProviderName => (process.env.PAYSTACK_SECRET_KEY ? 'paystack' : 'sandbox')
export const paymentsLive = () => paymentProvider() === 'paystack' && !process.env.PAYSTACK_SECRET_KEY!.startsWith('sk_test')

export type Checkout = { url: string }
export type Verified = { status: 'success' | 'failed' | 'abandoned' | 'pending'; amount: number; currency: string; channel: string | null; paidAt: string | null; raw: Record<string, unknown> }

const API = 'https://api.paystack.co'
async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    ...init, headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(15_000),
  })
  const json = await res.json().catch(() => ({})) as { status?: boolean; message?: string; data?: T }
  if (!res.ok || !json.status) throw new Error(`Paystack: ${json.message ?? res.status}`)
  return json.data as T
}

/** Starts a payment and returns the page where the member pays. */
export async function startCheckout(p: { reference: string; amountPesewas: number; email: string; callbackUrl: string; metadata: Record<string, unknown> }): Promise<Checkout> {
  if (paymentProvider() === 'sandbox') return { url: `/give/sandbox?reference=${encodeURIComponent(p.reference)}` }
  const d = await paystack<{ authorization_url: string }>('/transaction/initialize', { method: 'POST', body: JSON.stringify({
    reference: p.reference, amount: p.amountPesewas, currency: 'GHS', email: p.email, callback_url: p.callbackUrl,
    channels: ['mobile_money', 'card', 'bank'], metadata: p.metadata,
  }) })
  return { url: d.authorization_url }
}

/** Asks the provider what happened to a payment (never trust the browser's word). */
export async function verifyPayment(reference: string, sandboxResult?: 'success' | 'failed'): Promise<Verified | null> {
  if (paymentProvider() === 'sandbox') {
    if (!sandboxResult) return null
    return { status: sandboxResult, amount: -1, currency: 'GHS', channel: 'sandbox', paidAt: new Date().toISOString(), raw: { sandbox: true } }
  }
  const d = await paystack<{ status: string; amount: number; currency: string; channel: string | null; paid_at: string | null }>(`/transaction/verify/${encodeURIComponent(reference)}`)
  const status = d.status === 'success' ? 'success' : d.status === 'failed' ? 'failed' : d.status === 'abandoned' ? 'abandoned' : 'pending'
  return { status, amount: d.amount, currency: d.currency, channel: d.channel, paidAt: d.paid_at, raw: d as unknown as Record<string, unknown> }
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export function webhookSignatureOk(rawBody: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret || !signature) return false
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected), b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Gives money back to the payer (all or part of a payment). Paystack sends it back to the same card or mobile money wallet.
 * The sandbox only records it. Returns false if the provider refused (the refund can then be made by hand and recorded).
 */
export async function refundPayment(reference: string, amountPesewas: number, reason: string): Promise<{ ok: boolean; raw?: Record<string, unknown> }> {
  if (paymentProvider() === 'sandbox') return { ok: true, raw: { sandbox: true, amount: amountPesewas } }
  try {
    const d = await paystack<Record<string, unknown>>('/refund', { method: 'POST', body: JSON.stringify({ transaction: reference, amount: amountPesewas, currency: 'GHS', merchant_note: reason.slice(0, 200) }) })
    return { ok: true, raw: d }
  } catch (e) {
    console.error('[payments] refund failed', e)
    return { ok: false }
  }
}

/* ───── Sending money out (seller and rider payouts) ───── */
export type TransferInput = { reference: string; amountPesewas: number; method: 'momo' | 'bank'; provider: string | null; number: string | null; name: string | null; reason: string }
export type TransferResult = { status: 'paid' | 'processing' | 'failed' | 'manual'; providerRef?: string | null; reason?: string | null }

/** Paystack's codes for Ghana mobile money networks. */
const MOMO_CODES: Record<string, string> = { mtn: 'MTN', telecel: 'VOD', airteltigo: 'ATL' }

/**
 * Sends a payout. Mobile money goes through Paystack Transfers (the result arrives by webhook);
 * bank accounts are paid by hand by a Tech Admin ("manual"). The sandbox pays at once.
 */
export async function transferMoney(t: TransferInput): Promise<TransferResult> {
  if (paymentProvider() === 'sandbox') return { status: t.method === 'bank' ? 'manual' : 'paid', providerRef: `SANDBOX-${t.reference}` }
  if (t.method !== 'momo') return { status: 'manual' }
  const bank = MOMO_CODES[t.provider ?? '']
  if (!bank || !t.number) return { status: 'failed', reason: 'payout details incomplete' }
  try {
    const r = await paystack<{ recipient_code: string }>('/transferrecipient', { method: 'POST', body: JSON.stringify({
      type: 'mobile_money', name: t.name ?? 'PAPA member', account_number: t.number.startsWith('233') ? `0${t.number.slice(3)}` : t.number, bank_code: bank, currency: 'GHS',
    }) })
    const x = await paystack<{ status: string; transfer_code: string }>('/transfer', { method: 'POST', body: JSON.stringify({
      source: 'balance', amount: t.amountPesewas, recipient: r.recipient_code, reference: t.reference, reason: t.reason.slice(0, 100), currency: 'GHS',
    }) })
    return { status: x.status === 'success' ? 'paid' : x.status === 'failed' ? 'failed' : 'processing', providerRef: x.transfer_code }
  } catch (e) {
    return { status: 'failed', reason: (e as Error).message.slice(0, 200) }
  }
}
