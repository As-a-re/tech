'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import type { CommentTarget, CommentView } from '@/server/devotion/comments'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { TimeAgo } from '@/components/posts/time-ago'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { addCommentAction, deleteCommentAction } from '@/server/actions/devotion'

/** Encouragements on a prayer request / comments on a testimony. */
export function Comments({ target, items, me, path, placeholder, empty }: {
  target: CommentTarget; items: CommentView[]; me: { fullName: string; avatarUrl: string | null } | null; path: string; placeholder: string; empty: string
}) {
  const { t } = useI18n()
  const router = useRouter()
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const send = () => start(async () => {
    setError('')
    const r = await addCommentAction(target, body)
    if (r.ok) { setBody(''); router.refresh() } else setError(t(`prayer.err.${r.error === 'body' ? 'commentBody' : r.error}` as MessageKey))
  })
  return (
    <section id="encourage" className="scroll-mt-32">
      {me ? (
        <div className="flex gap-3 border-b px-4 py-3">
          <UserAvatar name={me.fullName} src={me.avatarUrl} className="size-9" />
          <div className="min-w-0 flex-1 space-y-2">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} rows={2} placeholder={placeholder} aria-label={placeholder} />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end"><Button size="sm" disabled={!body.trim() || pending} onClick={send}>{pending && <Loader2 className="animate-spin" />}{t('prayer.send')}</Button></div>
          </div>
        </div>
      ) : null}
      {items.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p> : (
        <ul className="divide-y">
          {items.map((c) => (
            <li key={c.id} className="flex gap-3 px-4 py-3">
              <Link href={`/u/${c.author.username}`}><UserAvatar name={c.author.fullName} src={c.author.avatarUrl} className="size-9" /></Link>
              <div className="min-w-0 flex-1">
                <p className="text-sm"><Link href={`/u/${c.author.username}`} className="font-semibold hover:underline">{c.author.fullName}</Link>{c.author.verified && <VerifiedBadge />}
                  <span className="text-muted-foreground"> · <TimeAgo iso={c.createdAt} /></span></p>
                <p className="mt-0.5 whitespace-pre-wrap text-[15px]">{c.body}</p>
              </div>
              {c.canDelete && <button type="button" aria-label={t('prayer.deleteComment')} onClick={() => start(async () => { if (await deleteCommentAction(c.id, path)) router.refresh() })}
                className="self-start rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="size-4" /></button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
