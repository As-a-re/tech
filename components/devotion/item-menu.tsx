'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Flag, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ReportDialog } from '@/components/moderation/report-dialog'
import type { ReportTarget } from '@/server/moderation/reports'

/** ••• menu shared by prayer requests and testimonies: copy link, edit, report, delete. */
export function ItemMenu({ href, editHref, canDelete, canReport, report, labels, onDelete }: {
  href: string; editHref?: string; canDelete: boolean; canReport: boolean; report: { target: ReportTarget; title: string }
  labels: { delete: string; deleteConfirm: string; edit?: string; report: string }; onDelete: () => void
}) {
  const { t } = useI18n()
  const [reporting, setReporting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('prayer.more')} className="-mr-2 rounded-full p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"><MoreHorizontal className="size-[18px]" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={async () => { await navigator.clipboard.writeText(`${location.origin}${href}`); toast.success(t('prayer.linkCopied')) }}><Link2 />{t('prayer.copyLink')}</DropdownMenuItem>
          {editHref && <DropdownMenuItem asChild><Link href={editHref}><Pencil />{labels.edit}</Link></DropdownMenuItem>}
          {canReport && <DropdownMenuItem onSelect={() => setReporting(true)}><Flag />{labels.report}</DropdownMenuItem>}
          {canDelete && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}><Trash2 />{labels.delete}</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>
      {canReport && <ReportDialog target={report.target} title={report.title} open={reporting} onOpenChange={setReporting} />}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{labels.delete}</AlertDialogTitle><AlertDialogDescription>{labels.deleteConfirm}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={onDelete}>{labels.delete}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
