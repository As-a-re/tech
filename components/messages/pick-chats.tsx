'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/common/user-avatar'
import type { ChatListItem } from '@/server/messages/chat'
import { chatsAction, forwardAction, shareToChatsAction } from '@/server/actions/messages'

/** Choose up to 5 chats, then forward a message or share a link into them. */
export function PickChatsDialog({ open, onOpenChange, forwardId, shareText }: { open: boolean; onOpenChange: (o: boolean) => void; forwardId?: string; shareText?: string }) {
  const { t } = useI18n()
  const [chats, setChats] = useState<ChatListItem[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [pending, start] = useTransition()
  useEffect(() => { if (open) { setPicked([]); start(async () => setChats(await chatsAction('all'))) } }, [open])
  const send = () => start(async () => {
    const n = forwardId ? await forwardAction(forwardId, picked) : await shareToChatsAction(picked, shareText ?? '')
    if (n > 0) { toast.success(t('messages.sentTo', { n })); onOpenChange(false) } else toast.error(t('messages.err.not_allowed'))
  })
  const shown = (chats ?? []).filter((c) => !q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>{forwardId ? t('messages.forwardTo') : t('messages.sendTo')}</DialogTitle></DialogHeader>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('messages.searchPh')} aria-label={t('messages.searchPh')} className="h-10 w-full rounded-full border bg-muted/60 px-4 text-sm outline-none focus:border-primary" />
        {chats === null ? <p className="py-6 text-center"><Loader2 className="inline size-5 animate-spin" /></p> : shown.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t('messages.none')}</p> : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {shown.map((c) => (
              <li key={c.id}><label className="flex cursor-pointer items-center gap-3 px-1 py-2">
                <input type="checkbox" checked={picked.includes(c.id)} disabled={!picked.includes(c.id) && picked.length >= 5}
                  onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))} className="size-4 accent-[var(--primary)]" />
                {c.kind === 'group' && !c.avatarUrl ? <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Users className="size-4" /></span> : <UserAvatar name={c.title} src={c.avatarUrl} className="size-9" />}
                <span className="truncate font-medium">{c.title}</span>
              </label></li>
            ))}
          </ul>
        )}
        <DialogFooter><Button disabled={!picked.length || pending} onClick={send}>{pending && <Loader2 className="animate-spin" />}{t('messages.send')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
