import { getCurrentUser } from '@/server/identity/session'
import { reportRows } from '@/server/payments/payments'
import { audit } from '@/server/identity/audit'
import { PERIODS, periodRange, type Period } from '@/components/give/giving-report'

/** CSV of received payments for the period (opens in Excel). */
export async function GET(req: Request) {
  const me = await getCurrentUser()
  if (!me) return new Response('Sign in', { status: 401 })
  const p = new URL(req.url).searchParams.get('p') ?? 'month'
  const period = (PERIODS as readonly string[]).includes(p) ? p as Period : 'month'
  const { from, to } = periodRange(period)
  const rows = await reportRows(me, from, to)
  if (!rows) return new Response('Not allowed', { status: 403 })
  await audit('giving.exported', { actorId: me.id, meta: { period, rows: rows.length } })
  const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const lines = [['Date', 'Reference', 'Giver', 'Username', 'Purpose', 'Project', 'To', 'Amount (GHS)', 'Method', 'Note'],
    ...rows.map((r) => [r.paidAt, r.reference, r.giver ?? 'Anonymous', r.giverUsername ?? '', r.purpose, r.fundName ?? '', r.recipient, (r.amountPesewas / 100).toFixed(2), r.channel ?? '', r.note ?? ''])]
  const csv = '﻿' + lines.map((l) => l.map(esc).join(',')).join('\r\n')
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="papa-giving-${period}-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } })
}
