'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { deleteResourceAction } from '@/server/actions/resources'

export function DeleteResource({ id }: { id: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [sure, setSure] = useState(false)
  const [pending, start] = useTransition()
  return sure
    ? <button type="button" disabled={pending} onClick={() => start(async () => { if (await deleteResourceAction(id)) router.push('/resources/manage?tab=items') })} className="rounded-full bg-destructive px-3 py-1.5 text-sm font-semibold text-white">{t('res.deleteConfirm')}</button>
    : <button type="button" onClick={() => setSure(true)} aria-label={t('res.delete')} className="rounded-full border p-2 text-destructive hover:bg-muted"><Trash2 className="size-4" /></button>
}
