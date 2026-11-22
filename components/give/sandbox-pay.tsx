'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/client'

/** Test checkout buttons (only when no payment provider is set up). */
export function SandboxPay({ reference }: { reference: string }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const go = async (result: 'success' | 'failed') => {
    setBusy(true)
    await fetch('/api/payments/sandbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference, result }) })
    window.location.href = `/give/done?reference=${encodeURIComponent(reference)}`
  }
  return (
    <div className="flex flex-col gap-2">
      <button type="button" disabled={busy} onClick={() => go('success')} data-sandbox-pay className="rounded-full bg-green-600 py-3 text-lg font-black text-white hover:bg-green-500">{t('give.sandbox.pay')}</button>
      <button type="button" disabled={busy} onClick={() => go('failed')} data-sandbox-fail className="rounded-full border py-3 font-semibold hover:bg-muted">{t('give.sandbox.fail')}</button>
    </div>
  )
}
