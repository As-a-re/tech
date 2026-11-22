'use client'

import { useEffect, useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/common/user-avatar'
import { deleteListAction, setListMemberAction } from '@/server/actions/discovery'
import { searchMembersAction } from '@/server/actions/search'

export function DeleteListButton({ id }: { id: string }) {
  const { t } = useI18n(); const [p, start] = useTransition()
  return <Button variant="outline" className="text-destructive" disabled={p} onClick={() => { if (confirm(t('lists.delete') + '?')) start(() => deleteListAction(id)) }}>{t('lists.delete')}</Button>
}

export function MemberToggle({ listId, userId, initial }: { listId: string; userId: string; initial: boolean }) {
  const { t } = useI18n(); const [on, setOn] = useState(initial); const [p, start] = useTransition()
  return <Button size="sm" variant={on ? 'outline' : 'default'} disabled={p} onClick={() => start(async () => { if (await setListMemberAction(listId, userId, !on)) setOn(!on) })}>{on ? t('lists.remove') : t('lists.add')}</Button>
}

/** Search members and add them to the list. */
export function AddMembers({ listId, existing }: { listId: string; existing: string[] }) {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Awaited<ReturnType<typeof searchMembersAction>>>([])
  const [, start] = useTransition()
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const id = setTimeout(() => start(async () => setHits(await searchMembersAction(q))), 200)
    return () => clearTimeout(id)
  }, [q])
  return (
    <div className="border-b p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('lists.searchMember')} aria-label={t('lists.searchMember')} className="h-10 w-full rounded-full border bg-muted/60 pl-9 pr-3 text-sm outline-none focus:border-primary" />
      </div>
      {hits.length > 0 && (
        <ul className="mt-2 divide-y rounded-xl border">
          {hits.map((h) => (
            <li key={h.id} className="flex items-center gap-3 px-3 py-2">
              <UserAvatar name={h.full_name} src={h.avatar_url} className="size-8 text-xs" />
              <span className="min-w-0 flex-1 text-sm"><b>{h.full_name}</b> <span className="text-muted-foreground">@{h.username}</span></span>
              <MemberToggle listId={listId} userId={h.id} initial={existing.includes(h.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
