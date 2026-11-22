'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, CalendarPlus, Check, Flag, Link2, MoreHorizontal, Pencil, Star, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ReportDialog } from '@/components/moderation/report-dialog'
import { cancelEventAction, deleteEventAction, rsvpAction } from '@/server/actions/community'

type Rsvp = 'going' | 'interested' | null

/** Going / Interested / Can't go. Guests are sent to sign in. */
export function RsvpButtons({ id, initial, signedIn, disabled }: { id: string; initial: Rsvp; signedIn: boolean; disabled?: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [rsvp, setRsvp] = useState<Rsvp>(initial)
  const [pending, start] = useTransition()
  const choose = (s: Rsvp) => {
    if (!signedIn) return router.push(`/login?next=/events/${id}`)
    const next = rsvp === s ? null : s
    start(async () => {
      const r = await rsvpAction(id, next)
      if (r.ok) { setRsvp(next); router.refresh() } else toast.error(t(`events.err.${r.error}` as MessageKey))
    })
  }
  const btn = (s: 'going' | 'interested', Icon: typeof Check) => (
    <button type="button" disabled={pending || disabled} aria-pressed={rsvp === s} onClick={() => choose(s)}
      className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50 sm:flex-none',
        rsvp === s ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted')}>
      <Icon className="size-4" />{t(`events.rsvp.${s}`)}
    </button>
  )
  return (
    <div className="flex flex-wrap gap-2">
      {btn('going', Check)}{btn('interested', Star)}
      {rsvp && <button type="button" disabled={pending} onClick={() => choose(rsvp)} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted"><X className="size-4" />{t('events.rsvp.notGoing')}</button>}
    </div>
  )
}

export function EventMenu({ id, isAuthor, isAdmin, signedIn, cancelled }: { id: string; isAuthor: boolean; isAdmin: boolean; signedIn: boolean; cancelled: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [confirm, setConfirm] = useState<null | 'cancel' | 'delete'>(null)
  const [reporting, setReporting] = useState(false)
  const [, start] = useTransition()
  const run = () => start(async () => {
    if (confirm === 'cancel') { const r = await cancelEventAction(id); if (r.ok) toast.success(t('events.cancelledNote')); router.refresh() }
    if (confirm === 'delete' && await deleteEventAction(id)) router.push('/events')
    setConfirm(null)
  })
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('announcements.more')} className="flex size-9 items-center justify-center rounded-full border hover:bg-muted"><MoreHorizontal className="size-5" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={async () => { await navigator.clipboard.writeText(`${location.origin}/events/${id}`); toast.success(t('events.linkCopied')) }}><Link2 />{t('events.share')}</DropdownMenuItem>
          <DropdownMenuItem asChild><a href={`/events/${id}/ics`} download><CalendarPlus />{t('events.addCalendar')}</a></DropdownMenuItem>
          {isAuthor && !cancelled && <DropdownMenuItem asChild><Link href={`/events/${id}/edit`}><Pencil />{t('events.edit')}</Link></DropdownMenuItem>}
          {signedIn && !isAuthor && <DropdownMenuItem onSelect={() => setReporting(true)}><Flag />{t('events.report')}</DropdownMenuItem>}
          {(isAuthor || isAdmin) && <DropdownMenuSeparator />}
          {isAuthor && !cancelled && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm('cancel')}><Ban />{t('events.cancel')}</DropdownMenuItem>}
          {(isAuthor || isAdmin) && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm('delete')}><Trash2 />{t('events.delete')}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      {signedIn && <ReportDialog target={{ eventId: id }} title={t('report.event')} open={reporting} onOpenChange={setReporting} />}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'cancel' ? t('events.cancel') : t('events.delete')}</AlertDialogTitle>
            <AlertDialogDescription>{confirm === 'cancel' ? t('events.cancelConfirm') : t('events.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={run}>{t('profile.confirm')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
