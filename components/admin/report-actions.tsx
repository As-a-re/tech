'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { resolveReportAction } from '@/server/actions/admin'
import { useAdminError } from './use-admin-error'

export function ReportActions({ id, canRemove, canSuspend, removeLabel }: { id: string; canRemove: boolean; canSuspend: boolean; removeLabel?: string }) {
  const { t } = useI18n()
  const err = useAdminError()
  const [p, start] = useTransition()
  const run = (a: 'remove_post' | 'suspend' | 'dismiss') => start(async () => {
    const r = await resolveReportAction(id, a)
    if (r.error) toast.error(err(r.error)); else toast.success(t('admin.reports.done'))
  })
  return (
    <>
      {canRemove && <Button size="sm" variant="destructive" disabled={p} onClick={() => run('remove_post')}>{removeLabel ?? t('admin.reports.removePost')}</Button>}
      {canSuspend && <Button size="sm" variant="outline" className="text-destructive" disabled={p} onClick={() => run('suspend')}>{t('admin.reports.suspend')}</Button>}
      <Button size="sm" variant="outline" disabled={p} onClick={() => run('dismiss')}>{t('admin.reports.dismiss')}</Button>
    </>
  )
}
