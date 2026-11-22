'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { FullDate } from '@/components/posts/time-ago'
import { deletePostAction, editPostAction, publishDraftAction } from '@/server/actions/posts'

export function DraftRow({ id, body, isDraft, publishedAt }: { id: string; body: string; isDraft: boolean; publishedAt: string | null }) {
  const { t } = useI18n(); const router = useRouter()
  const [text, setText] = useState(body)
  const [editing, setEditing] = useState(false)
  const [p, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: string } | boolean>) => start(async () => {
    const r = await fn()
    if (typeof r === 'object' && !r.ok && r.error) toast.error(t(`compose.err.${r.error}` as MessageKey))
    router.refresh()
  })
  return (
    <li className="px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{isDraft ? t('drafts.draft') : <>{t('drafts.scheduledFor')}<FullDate iso={publishedAt!} /></>}</p>
      {editing ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border bg-transparent p-3 text-[15px] outline-none focus:border-primary" aria-label={t('drafts.edit')} />
      ) : <p className="mt-1 whitespace-pre-wrap text-[15px]">{text || <span className="text-muted-foreground">{t('drafts.empty')}</span>}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {editing
          ? <Button size="sm" disabled={p} onClick={() => run(async () => { const r = await editPostAction(id, text); if (r.ok) setEditing(false); return r })}>{t('post.save')}</Button>
          : <Button size="sm" variant="outline" onClick={() => setEditing(true)}>{t('drafts.edit')}</Button>}
        <Button size="sm" disabled={p} onClick={() => run(() => publishDraftAction(id))}>{t('drafts.publish')}</Button>
        <Button size="sm" variant="ghost" className="text-destructive" disabled={p} onClick={() => run(() => deletePostAction(id))}>{t('drafts.delete')}</Button>
      </div>
    </li>
  )
}
