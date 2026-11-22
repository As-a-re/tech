'use client'

import { useEffect, useState, useTransition } from 'react'
import { Folder } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { foldersAction, moveBookmarkAction } from '@/server/actions/discovery'

export function MoveDialog({ postId, open, onOpenChange }: { postId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n()
  const router = useRouter()
  const [rows, setRows] = useState<{ id: string; name: string }[] | null>(null)
  const [, start] = useTransition()
  useEffect(() => { if (open) start(async () => setRows(await foldersAction())) }, [open])
  const move = (id: string | null) => start(async () => {
    if (await moveBookmarkAction(postId, id)) { toast.success(t('saved.moved')); onOpenChange(false); router.refresh() }
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>{t('saved.moveTo')}</DialogTitle></DialogHeader>
        <ul className="max-h-80 divide-y overflow-y-auto">
          <li><button type="button" onClick={() => move(null)} className="flex w-full items-center gap-3 px-1 py-2.5 text-left text-[15px] hover:bg-muted">{t('saved.unfiled')}</button></li>
          {rows?.map((r) => <li key={r.id}><button type="button" onClick={() => move(r.id)} className="flex w-full items-center gap-3 px-1 py-2.5 text-left text-[15px] font-medium hover:bg-muted"><Folder className="size-4 text-primary" />{r.name}</button></li>)}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
