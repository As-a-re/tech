'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createFolderAction, deleteFolderAction, renameFolderAction } from '@/server/actions/discovery'

export function FolderBar({ folders, active }: { folders: { id: string; name: string; items: number }[]; active: string | null }) {
  const { t } = useI18n()
  const router = useRouter()
  const [dialog, setDialog] = useState<null | 'new' | 'rename'>(null)
  const [name, setName] = useState('')
  const [pending, start] = useTransition()
  const current = folders.find((f) => f.id === active)
  const chip = (key: string | null, label: string, href: string) => (
    <Link key={key ?? 'all'} href={href} aria-current={active === key ? 'page' : undefined}
      className={cn('whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium', active === key ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>{label}</Link>
  )
  const submit = () => start(async () => {
    if (dialog === 'new') { const id = await createFolderAction(name); setDialog(null); if (id) router.push(`/saved?folder=${id}`) }
    else if (current) { await renameFolderAction(current.id, name); setDialog(null); router.refresh() }
  })
  return (
    <div className="border-b px-4 py-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {chip(null, t('saved.all'), '/saved')}
        {chip('none', t('saved.unfiled'), '/saved?folder=none')}
        {folders.map((f) => chip(f.id, `${f.name} · ${f.items}`, `/saved?folder=${f.id}`))}
        <button type="button" onClick={() => { setName(''); setDialog('new') }} className="flex shrink-0 items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm font-medium text-primary hover:bg-muted"><FolderPlus className="size-4" />{t('saved.newFolder')}</button>
      </div>
      {current && (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setName(current.name); setDialog('rename') }}><Pencil />{t('saved.renameFolder')}</Button>
          <Button size="sm" variant="outline" className="text-destructive" disabled={pending} onClick={() => { if (confirm(t('saved.deleteFolder') + '?')) start(() => deleteFolderAction(current.id)) }}><Trash2 />{t('saved.deleteFolder')}</Button>
        </div>
      )}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog === 'new' ? t('saved.newFolder') : t('saved.renameFolder')}</DialogTitle></DialogHeader>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t('saved.folderName')} aria-label={t('saved.folderName')} autoFocus />
          <DialogFooter><Button disabled={!name.trim() || pending} onClick={submit}>{dialog === 'new' ? t('saved.create') : t('lists.save')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
