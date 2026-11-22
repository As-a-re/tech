import { notFound } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { ghs } from '@/lib/give/money'
import { requireUser } from '@/server/identity/session'
import { paymentProvider } from '@/integrations/payments'
import { PageHeader } from '@/components/common/page-header'
import { SandboxPay } from '@/components/give/sandbox-pay'

export const metadata = { title: 'Test payment' }

export default async function Sandbox({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const [sp, t] = await Promise.all([searchParams, getT()])
  const me = await requireUser(`/give/sandbox?reference=${sp.reference ?? ''}`)
  if (paymentProvider() !== 'sandbox' || !sp.reference) notFound()
  const { data: p, error } = await createSupabaseAdminClient().from('payments').select('*').eq('reference', sp.reference).maybeSingle()
  if (error) throw new Error(`Unable to load payment: ${error.message}`)
  if (!p || p.user_id !== me.id) notFound()
  return (
    <>
      <PageHeader title={t('give.sandbox.title')} />
      <div className="mx-auto max-w-sm space-y-5 px-4 py-8 text-center">
        <FlaskConical className="mx-auto size-12 text-amber-500" />
        <p className="text-muted-foreground">{t('give.sandbox.lead')}</p>
        <p className="text-4xl font-black" data-sandbox-amount>{ghs(p.amount_pesewas)}</p>
        <p className="font-semibold">{t(`give.purposes.${p.purpose}` as MessageKey)} · {p.reference}</p>
        {p.status === 'pending' ? <SandboxPay reference={p.reference} /> : <p>{t(`give.status.${p.status}` as MessageKey)}</p>}
        <p className="text-xs text-muted-foreground">{t('give.sandbox.note')}</p>
      </div>
    </>
  )
}
