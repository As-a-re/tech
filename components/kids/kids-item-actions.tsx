'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteKidsAction } from '@/server/actions/library'

export function KidsItemActions({ id }: { id: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  return (
    <div className="flex gap-2">
      <Link href={`/children/${id}/edit`} className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><Pencil className="size-4" />{t('kids.edit')}</Link>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-muted"><Trash2 className="size-4" />{t('kids.delete')}</button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('kids.deleteConfirm')}</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={pending} className="bg-destructive text-white hover:bg-destructive/90" onClick={() => start(async () => { if (await deleteKidsAction(id)) { toast.success(t('kids.deleted')); router.push('/children') } })}>{t('kids.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
