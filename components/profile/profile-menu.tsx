'use client'

import { useState, useTransition } from 'react'
import { Ban, Flag, Link2, ListPlus, MoreHorizontal, Star, StarOff, UserMinus, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useI18n } from '@/lib/i18n/client'
import { blockAction, muteAction, removeFollowerAction, unblockAction, unmuteAction } from '@/server/actions/social'
import { favoriteAction } from '@/server/actions/posts'
import { ReportDialog } from '@/components/moderation/report-dialog'
import { AddToListDialog } from '@/components/lists/add-to-list-dialog'

export function ProfileMenu({ targetId, username, muting, blocking, followsYou, signedIn, favorite = false }: {
  targetId: string; username: string; muting: boolean; blocking: boolean; followsYou: boolean; signedIn: boolean; favorite?: boolean
}) {
  const { t } = useI18n()
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [listing, setListing] = useState(false)
  const [, start] = useTransition()
  const run = (fn: () => Promise<void>, msg?: string) => start(async () => { await fn(); if (msg) toast.success(msg) })
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('profile.more')} className="flex size-9 items-center justify-center rounded-full border hover:bg-muted"><MoreHorizontal className="size-5" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={() => { navigator.clipboard.writeText(`${location.origin}/u/${username}`); toast.success(t('profile.linkCopied')) }}>
            <Link2 /> {t('profile.copyLink')}
          </DropdownMenuItem>
          {signedIn && (
            <>
              <DropdownMenuSeparator />
              {!blocking && (favorite
                ? <DropdownMenuItem onSelect={() => run(() => favoriteAction(targetId, false), t('post.favoriteRemoved'))}><StarOff /> {t('post.favoriteRemove')}</DropdownMenuItem>
                : <DropdownMenuItem onSelect={() => run(() => favoriteAction(targetId, true), t('post.favoriteAdded'))}><Star /> {t('post.favoriteAdd')}</DropdownMenuItem>)}
              {!blocking && <DropdownMenuItem onSelect={() => setListing(true)}><ListPlus /> {t('lists.addToList')}</DropdownMenuItem>}
              {followsYou && <DropdownMenuItem onSelect={() => run(() => removeFollowerAction(targetId))}><UserMinus /> {t('profile.removeFollower')}</DropdownMenuItem>}
              {!blocking && (muting
                ? <DropdownMenuItem onSelect={() => run(() => unmuteAction(targetId))}><Volume2 /> {t('profile.unmute', { username })}</DropdownMenuItem>
                : <DropdownMenuItem onSelect={() => run(() => muteAction(targetId), t('profile.mutedNotice', { username }))}><VolumeX /> {t('profile.mute', { username })}</DropdownMenuItem>)}
              {blocking
                ? <DropdownMenuItem onSelect={() => run(() => unblockAction(targetId))}><Ban /> {t('profile.unblock', { username })}</DropdownMenuItem>
                : <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmBlock(true)}><Ban /> {t('profile.block', { username })}</DropdownMenuItem>}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setReporting(true)}><Flag /> {t('report.user', { username })}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {signedIn && <><ReportDialog target={{ userId: targetId }} title={t('report.user', { username })} open={reporting} onOpenChange={setReporting} />
        <AddToListDialog userId={targetId} open={listing} onOpenChange={setListing} /></>}
      <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.blockConfirmTitle', { username })}</AlertDialogTitle>
            <AlertDialogDescription>{t('profile.blockConfirmText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => run(() => blockAction(targetId))}>{t('profile.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
