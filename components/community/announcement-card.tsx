'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Flag, Link2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import type { AnnouncementView } from '@/server/community/announcements'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'
import { RichText } from '@/components/posts/rich-text'
import { MediaGrid } from '@/components/posts/media-grid'
import { TimeAgo } from '@/components/posts/time-ago'
import { ReportDialog } from '@/components/moderation/report-dialog'
import { LevelBadge } from './level-badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteAnnouncementAction } from '@/server/actions/community'

/** One announcement: in a list (title + preview, opens the detail page) or in full on its own page. */
export function AnnouncementCard({ a, full, signedIn, isAdmin }: { a: AnnouncementView; full?: boolean; signedIn: boolean; isAdmin: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [reporting, setReporting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [, start] = useTransition()
  const href = `/announcements/${a.id}`
  const remove = () => start(async () => {
    if (await deleteAnnouncementAction(a.id)) { toast.success(t('announcements.deleted')); full ? router.push('/announcements') : router.refresh() }
  })
  return (
    <article className={cn('relative border-b px-4 py-4', !full && 'hover:bg-muted/30')}>
      {!full && <Link href={href} className="absolute inset-0" aria-label={a.title} />}
      <div className="flex items-center gap-2">
        <div className="relative z-10 flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <LevelBadge level={a.level} label={t('levels.national')} district={a.district} assembly={a.assembly} />
          {a.important && <span className="rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">{t('announcements.important')}</span>}
          <span className="text-xs text-muted-foreground"><TimeAgo iso={a.createdAt} />{a.editedAt && ` · ${t('announcements.edited')}`}</span>
        </div>
        <div className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t('announcements.more')} className="-mr-2 rounded-full p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary"><MoreHorizontal className="size-[18px]" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={async () => { await navigator.clipboard.writeText(`${location.origin}${href}`); toast.success(t('announcements.linkCopied')) }}><Link2 />{t('announcements.copyLink')}</DropdownMenuItem>
              {a.viewer.isAuthor && <DropdownMenuItem asChild><Link href={`${href}/edit`}><Pencil />{t('announcements.edit')}</Link></DropdownMenuItem>}
              {signedIn && !a.viewer.isAuthor && <DropdownMenuItem onSelect={() => setReporting(true)}><Flag />{t('announcements.report')}</DropdownMenuItem>}
              {(a.viewer.isAuthor || isAdmin) && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}><Trash2 />{t('announcements.delete')}</DropdownMenuItem></>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <h2 className={cn('mt-2 font-bold leading-snug', full ? 'text-2xl' : 'text-[17px]')}>{a.title}</h2>
      <RichText body={a.body} className={cn('relative z-10 mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed', !full && 'line-clamp-4')} />
      {a.media.length > 0 && <div className="relative z-10"><MediaGrid media={a.media.map((m) => ({ ...m, id: m.url, kind: 'image' as const }))} /></div>}
      <div className="relative z-10 mt-3 flex items-center gap-2 text-sm">
        <Link href={`/u/${a.author.username}`} className="flex min-w-0 items-center gap-2 hover:underline">
          <UserAvatar name={a.author.fullName} src={a.author.avatarUrl} className="size-7 text-[10px]" />
          <span className="truncate"><span className="text-muted-foreground">{t('announcements.by')} </span><b>{a.author.fullName}</b></span>
          {a.author.verified && <VerifiedBadge />}
        </Link>
        {full && <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Eye className="size-3.5" />{t('announcements.views', { n: a.viewCount })}</span>}
      </div>
      {signedIn && <ReportDialog target={{ announcementId: a.id }} title={t('report.announcement')} open={reporting} onOpenChange={setReporting} />}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('announcements.delete')}</AlertDialogTitle><AlertDialogDescription>{t('announcements.deleteConfirm')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel><AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={remove}>{t('announcements.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}
