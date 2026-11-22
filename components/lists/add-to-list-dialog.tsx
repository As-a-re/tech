'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { Lock } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { myListsForAction, setListMemberAction } from '@/server/actions/discovery'

type Row = { id: string; name: string; isPrivate: boolean; has: boolean }

export function AddToListDialog({ userId, open, onOpenChange }: { userId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [, start] = useTransition()
  useEffect(() => { if (open) start(async () => setRows(await myListsForAction(userId))) }, [open, userId])
  const flip = (r: Row) => start(async () => {
    if (await setListMemberAction(r.id, userId, !r.has)) setRows((all) => all?.map((x) => (x.id === r.id ? { ...x, has: !r.has } : x)) ?? null)
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('lists.addToList')}</DialogTitle></DialogHeader>
        {rows === null ? <p className="py-6 text-center text-sm text-muted-foreground">…</p> : rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('lists.noLists')} <Link href="/lists/new" className="font-semibold text-primary">{t('lists.new')}</Link></p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id}><label className="flex cursor-pointer items-center gap-3 px-1 py-2.5">
                <input type="checkbox" checked={r.has} onChange={() => flip(r)} className="size-4 accent-[var(--primary)]" />
                <span className="flex flex-1 items-center gap-1.5 text-[15px] font-medium">{r.name}{r.isPrivate && <Lock className="size-3.5 text-muted-foreground" />}</span>
              </label></li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
