'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { removeContentAction } from '@/server/actions/admin'

export function RemoveContent({ kind, id }: { kind: 'announcement' | 'event' | 'prayer' | 'testimony' | 'publication' | 'kids' | 'live' | 'resource'; id: string }) {
  const { t } = useI18n()
  const [p, start] = useTransition()
  return <Button size="sm" variant="outline" className="text-destructive" disabled={p}
    onClick={() => { if (confirm(t('admin.content.removeConfirm'))) start(async () => { const r = await removeContentAction(kind, id); if (r.ok) toast.success(t('admin.content.removed')) }) }}>{t('admin.content.remove')}</Button>
}
