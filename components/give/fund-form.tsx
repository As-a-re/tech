'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { ImagePicker, toPicked, type PickedImage } from '@/components/common/image-picker'
import { saveFundAction } from '@/server/actions/payments'
import type { FundInput } from '@/server/payments/payments'

const input = 'h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary'

export function FundForm({ id, initial }: { id?: string; initial?: FundInput }) {
  const { t } = useI18n()
  const router = useRouter()
  const [v, setV] = useState<FundInput>(initial ?? { name: '', description: '', level: 'local', targetGhs: null, endsOn: null, active: true })
  const set = <K extends keyof FundInput>(k: K, val: FundInput[K]) => setV((x) => ({ ...x, [k]: val }))
  const [cover, setCover] = useState<PickedImage[]>(initial?.coverUrl ? toPicked([{ url: initial.coverUrl }]) : [])
  const [pending, start] = useTransition()
  const submit = () => start(async () => {
    const r = await saveFundAction({ ...v, coverUrl: cover[0]?.url ?? null }, id)
    if (!r.ok) { toast.error(t(`give.err.${r.error}` as MessageKey)); return }
    toast.success(t('give.fund.saved')); router.push(`/give/funds/${r.id}`)
  })
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-4 px-4 py-5" data-fund-form>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t('give.fund.name')}</span><input name="name" required maxLength={100} value={v.name} onChange={(e) => set('name', e.target.value)} className={input} /></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t('give.fund.description')}</span><textarea name="description" rows={4} maxLength={2000} value={v.description ?? ''} onChange={(e) => set('description', e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" /></label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('give.fund.level')}</span>
          <select value={v.level} onChange={(e) => set('level', e.target.value as FundInput['level'])} className={input}>{(['local', 'district', 'national'] as const).map((l) => <option key={l} value={l}>{t(`admin.roles.${l}` as MessageKey)}</option>)}</select></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('give.fund.target')}</span><input name="target" inputMode="decimal" value={v.targetGhs ?? ''} onChange={(e) => set('targetGhs', e.target.value ? Number(e.target.value.replace(/[^\d.]/g, '')) : null)} className={input} /></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('give.fund.endsOn')}</span><input type="date" value={v.endsOn ?? ''} onChange={(e) => set('endsOn', e.target.value || null)} className={input} /></label>
      </div>
      <ImagePicker value={cover} onChange={setCover} max={1} wide label={t('give.fund.cover')} onError={() => toast.error(t('give.err.cover'))} />
      <label className="flex items-center gap-3"><input type="checkbox" checked={v.active ?? true} onChange={(e) => set('active', e.target.checked)} className="size-5" /><span className="text-sm font-medium">{t('give.fund.active')}</span></label>
      <Button type="submit" size="lg" className="w-full rounded-full" disabled={pending || !v.name.trim()}>{t('give.fund.save')}</Button>
    </form>
  )
}
