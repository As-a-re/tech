'use client'

import { useState } from 'react'
import { ChevronDown, Copy, CornerUpLeft, FileText, Forward, Pencil, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { clockTime, duration, fileSize } from '@/lib/messages/format'
import type { MessageView } from '@/server/messages/chat'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MediaGrid } from '@/components/posts/media-grid'
import { RichText } from '@/components/posts/rich-text'
import { systemText } from '@/lib/messages/system'
import { CallLine } from '@/components/calls/call-line'
import { Ticks } from './ticks'

export type UiMessage = MessageView & { pending?: boolean; failed?: boolean }
export const QUICK = ['❤️', '🙏🏾', '🙌', '😂', '😮', '👍'] as const
const EDIT_MS = 15 * 60_000, UNSEND_MS = 24 * 3600_000

export function MessageBubble({ m, meId, group = false, showName, onReply, onEdit, onUnsend, onHide, onReact, onForward, onRetry }: {
  m: UiMessage; meId?: string; group?: boolean; showName: boolean
  onReply: () => void; onEdit: () => void; onUnsend: () => void; onHide: () => void; onReact: (e: string | null) => void; onForward: () => void; onRetry: () => void
}) {
  const { t } = useI18n()
  const [menu, setMenu] = useState(false)
  const age = Date.now() - new Date(m.createdAt).getTime()
  const images = m.attachments.filter((a) => a.kind === 'image')
  const others = m.attachments.filter((a) => a.kind !== 'image')
  const myReaction = m.reactions.find((r) => r.mine)?.emoji ?? null
  if (m.kind === 'call') return <CallLine body={m.body} mine={m.mine} group={group} conversationId={m.conversationId} at={m.createdAt} />
  if (m.kind === 'system') return <p className="mx-auto my-2 w-fit max-w-[85%] rounded-lg bg-muted/70 px-3 py-1 text-center text-xs text-muted-foreground" data-system>{systemText(m.body, t, meId)}</p>
  return (
    <div className={cn('group flex px-3 py-0.5', m.mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('relative max-w-[82%] sm:max-w-[70%]', m.reactions.length > 0 && 'mb-3')}>
        <div onClick={(e) => {
          // On phones, tapping the bubble opens its options (links, players and buttons keep working)
          if (!m.deleted && !m.pending && window.matchMedia('(pointer: coarse)').matches && !(e.target as HTMLElement).closest('a,button,audio,video,img')) setMenu(true)
        }} className={cn('rounded-2xl px-3 py-2 shadow-sm', m.mine ? 'rounded-br-md bg-bubble-mine text-bubble-mine-fg' : 'rounded-bl-md bg-muted', m.failed && 'opacity-60')}>
          {showName && m.sender && <p className="mb-0.5 text-xs font-semibold text-brand-red">{m.sender.fullName}</p>}
          {m.forwarded && !m.deleted && <p className={cn('mb-1 flex items-center gap-1 text-xs italic', m.mine ? 'text-bubble-mine-fg/75' : 'text-muted-foreground')}><Forward className="size-3" />{t('messages.forwarded')}</p>}
          {m.replyTo && !m.deleted && (
            <div className={cn('mb-1.5 rounded-lg border-l-4 px-2 py-1 text-xs', m.mine ? 'border-white/60 bg-white/15' : 'border-primary bg-background/70')}>
              <b className="block">{m.replyTo.senderName}</b>
              <span className="line-clamp-2 opacity-90">{m.replyTo.deleted ? t('messages.deleted') : m.replyTo.body || t(`messages.kinds.${m.replyTo.kind}` as 'messages.kinds.image')}</span>
            </div>
          )}
          {m.deleted ? <p className="text-[15px] italic opacity-80">{m.mine ? t('messages.youDeleted') : t('messages.deleted')}</p> : (
            <>
              {images.length > 0 && <div className="-mx-1 mb-1 [&>*]:mt-0"><MediaGrid media={images.slice(0, 4).map((a) => ({ id: a.url, kind: 'image', url: a.url, alt: a.name, width: a.width, height: a.height }))} /></div>}
              {others.map((a) => a.kind === 'video' ? (
                <video key={a.url} src={a.url} controls playsInline preload="metadata" className="mb-1 max-h-80 w-full rounded-xl bg-black" />
              ) : a.kind === 'audio' ? (
                <div key={a.url} className="mb-1 flex items-center gap-2">
                  <audio src={a.url} controls preload="metadata" className="h-10 w-60 max-w-full" />
                  {a.duration != null && <span className="text-xs opacity-80">{duration(a.duration)}</span>}
                </div>
              ) : (
                <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className={cn('mb-1 flex items-center gap-2 rounded-xl px-2 py-2', m.mine ? 'bg-white/15' : 'bg-background/70')}>
                  <FileText className="size-8 shrink-0" />
                  <span className="min-w-0"><b className="block truncate text-sm">{a.name ?? t('messages.kinds.file')}</b><span className="text-xs opacity-80">{fileSize(a.size)}</span></span>
                </a>
              ))}
              {m.body && <RichText body={m.body} className={cn('whitespace-pre-wrap break-words text-[15px] leading-snug', m.mine && '[&_a]:text-primary-foreground [&_a]:underline')} />}
            </>
          )}
          <p className={cn('mt-0.5 flex items-center justify-end gap-1 text-[11px]', m.mine ? 'text-bubble-mine-fg/75' : 'text-muted-foreground')}>
            {m.editedAt && !m.deleted && <span>{t('messages.edited')}</span>}
            {m.failed ? <button type="button" onClick={onRetry} className="font-semibold underline">{t('messages.retry')}</button> : <span>{clockTime(m.createdAt)}</span>}
            {m.mine && !m.deleted && <Ticks status={m.pending ? 'sending' : m.status} className={m.status === 'read' ? 'text-sky-300 dark:text-tick-read' : ''} />}
          </p>
        </div>
        {m.reactions.length > 0 && (
          <button type="button" onClick={() => onReact(myReaction ? null : m.reactions[0].emoji)} className={cn('absolute -bottom-3 flex items-center gap-0.5 rounded-full border bg-background px-1.5 py-0.5 text-xs shadow-sm', m.mine ? 'right-2' : 'left-2')}>
            {m.reactions.map((r) => <span key={r.emoji}>{r.emoji}</span>)}{m.reactions.reduce((n, r) => n + r.count, 0) > 1 && <span className="ml-0.5 text-muted-foreground">{m.reactions.reduce((n, r) => n + r.count, 0)}</span>}
          </button>
        )}
        {!m.deleted && !m.pending && !m.failed && (
          <DropdownMenu open={menu} onOpenChange={setMenu}>
            <DropdownMenuTrigger aria-label={t('messages.options')} className={cn('absolute top-1 rounded-full bg-background/90 p-0.5 text-muted-foreground opacity-0 shadow-sm hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:pointer-events-none', m.mine ? '-left-6' : '-right-6')}>
              <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align={m.mine ? 'end' : 'start'} className="w-52">
              <div className="flex justify-between px-1 py-1">
                {QUICK.map((e) => (
                  <button key={e} type="button" onClick={() => onReact(myReaction === e ? null : e)} aria-label={e} aria-pressed={myReaction === e}
                    className={cn('rounded-full p-1 text-lg hover:bg-muted', myReaction === e && 'bg-primary/15')}>{e}</button>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onReply}><CornerUpLeft />{t('messages.reply')}</DropdownMenuItem>
              {m.body && <DropdownMenuItem onSelect={async () => { await navigator.clipboard.writeText(m.body); toast.success(t('messages.copied')) }}><Copy />{t('messages.copy')}</DropdownMenuItem>}
              <DropdownMenuItem onSelect={onForward}><Forward />{t('messages.forward')}</DropdownMenuItem>
              {m.mine && m.body && age < EDIT_MS && <DropdownMenuItem onSelect={onEdit}><Pencil />{t('messages.edit')}</DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onHide}><Trash2 />{t('messages.deleteForMe')}</DropdownMenuItem>
              {m.mine && age < UNSEND_MS && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onUnsend}><Undo2 />{t('messages.deleteForEveryone')}</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
