'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Compass, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/common/user-avatar'
import { searchMembersAction } from '@/server/actions/search'
import { startChatAction } from '@/server/actions/messages'

/** Find a member and open the chat with them. */
export function NewChatDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Awaited<ReturnType<typeof searchMembersAction>>>([])
  const [pending, start] = useTransition()
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const id = setTimeout(() => start(async () => setHits(await searchMembersAction(q))), 200)
    return () => clearTimeout(id)
  }, [q])
  const open1 = (id: string) => start(async () => {
    const r = await startChatAction(id)
    if (r.ok) { onOpenChange(false); router.push(`/messages/${r.id}`) } else toast.error(t(`messages.err.${r.error}` as MessageKey))
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t('messages.newChat')}</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('messages.findPerson')} aria-label={t('messages.findPerson')}
            className="h-11 w-full rounded-full border bg-muted/60 pl-9 pr-3 text-sm outline-none focus:border-primary" />
        </div>
        {q.trim().length < 2 && (
          <div className="-mx-1 grid gap-1">
            <Link href="/groups/new" onClick={() => onOpenChange(false)} className="flex items-center gap-3 rounded-lg px-1 py-2 font-semibold hover:bg-muted">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Users className="size-5" /></span>{t('messages.newGroup')}
            </Link>
            <Link href="/groups?tab=discover" onClick={() => onOpenChange(false)} className="flex items-center gap-3 rounded-lg px-1 py-2 font-semibold hover:bg-muted">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Compass className="size-5" /></span>{t('groups.discover')}
            </Link>
          </div>
        )}
        <ul className="max-h-80 divide-y overflow-y-auto">
          {hits.map((h) => (
            <li key={h.id}><button type="button" disabled={pending} onClick={() => open1(h.id)} className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-muted">
              <UserAvatar name={h.full_name} src={h.avatar_url} />
              <span className="min-w-0"><b className="block truncate">{h.full_name}</b><span className="block truncate text-sm text-muted-foreground">@{h.username} · {h.assembly_name}</span></span>
            </button></li>
          ))}
          {q.trim().length >= 2 && !hits.length && !pending && <li className="py-6 text-center text-sm text-muted-foreground">{t('messages.noPeople')}</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
