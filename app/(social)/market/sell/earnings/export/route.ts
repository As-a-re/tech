import { getCurrentUser } from '@/server/identity/session'
import { earningsCsvRows } from '@/server/market/seller'

/** CSV of every paid order to the member's shop (opens in Excel). */
export async function GET() {
  const me = await getCurrentUser()
  if (!me) return new Response('Sign in', { status: 401 })
  const rows = await earningsCsvRows(me)
  if (!rows) return new Response('No shop', { status: 404 })
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const g = (p: number) => (p / 100).toFixed(2)
  const lines = [['Date', 'Order', 'Status', 'Buyer', 'Items (GHS)', 'Delivery (GHS)', 'Discount (GHS)', 'Paid (GHS)', 'Fee (GHS)', 'Refunded (GHS)', 'You get (GHS)', 'Money'],
    ...rows.map((r) => [new Date(r.paid_at).toISOString(), r.number, r.status, r.buyer ?? '', g(r.subtotal_pesewas), g(r.delivery_fee_pesewas), g(r.discount_pesewas), g(r.total_pesewas), g(r.fee_pesewas), g(r.refunded_pesewas), g(r.seller_net_pesewas), r.escrow ?? ''])]
  const csv = '﻿' + lines.map((l) => l.map(esc).join(',')).join('\r\n')
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="papa-shop-earnings-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } })
}
