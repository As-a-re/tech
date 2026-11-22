'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { closeShopAction, pauseShopAction } from '@/server/actions/market'

/** Take a break / open again, and close the shop for good. */
export function ShopStatusControls({ status }: { status: 'active' | 'paused' | 'suspended' }) {
  const { t } = useI18n()
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()
  const fail = (e: string) => toast.error(t(`market.sell.err.${e}` as MessageKey))
  return (
    <section className="space-y-4 rounded-2xl border p-4" data-shop-status={status}>
      {status !== 'suspended' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t('market.sell.pauseLead')}</p>
          <Button variant="outline" disabled={pending} data-pause onClick={() => start(async () => {
            const r = await pauseShopAction(status === 'active'); if (!r.ok) fail(r.error); else { toast.success(t('market.sell.form.saved')); router.refresh() }
          })}>{status === 'active' ? t('market.sell.pause') : t('market.sell.resume')}</Button>
        </div>
      )}
      <div className="space-y-2 border-t pt-4">
        <p className="text-sm text-muted-foreground">{t('market.sell.closeLead')}</p>
        <Button variant="outline" className="text-destructive" onClick={() => setConfirm(true)} data-close-shop>{t('market.sell.close')}</Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('market.sell.close')}</AlertDialogTitle><AlertDialogDescription>{t('market.sell.closeLead')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => start(async () => {
              const r = await closeShopAction(); if (!r.ok) fail(r.error); else { toast.success(t('market.sell.closed')); router.push('/market') }
            })}>{t('market.sell.closeConfirm')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
