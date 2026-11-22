'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellRing, Bookmark, BookmarkCheck, CloudDownload, Pencil, Share2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deletePublicationAction, followSeriesAction, savePublicationToLibraryAction } from '@/server/actions/library'

const pill = 'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold hover:bg-muted'

export function FollowSeriesButton({ seriesId, initial }: { seriesId: string; initial: boolean }) {
  const { t } = useI18n()
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()
  return (
    <button type="button" disabled={pending} aria-pressed={on} onClick={() => start(async () => { setOn(!on); await followSeriesAction(seriesId, !on); if (!on) toast.success(t('pubs.followHint')) })}
      className={cn(pill, on && 'border-primary text-primary')}>{on ? <BellRing className="size-4" /> : <Bell className="size-4" />}{on ? t('pubs.following') : t('pubs.follow')}</button>
  )
}

/** Save to my library, follow the series, keep for offline reading, share, and (for its editor) edit/delete. */
export function PublicationActions({ id, title, saved: initialSaved, seriesId, following, signedIn, canEdit, offlineUrls }: {
  id: string; title: string; saved: boolean; seriesId: string | null; following: boolean; signedIn: boolean; canEdit: boolean; offlineUrls: string[]
}) {
  const { t } = useI18n()
  const router = useRouter()
  const [saved, setSaved] = useState(initialSaved)
  const [confirm, setConfirm] = useState(false)
  const [pending, start] = useTransition()
  const offline = async () => {
    try {
      const cache = await caches.open('papa-offline')
      await cache.addAll([...offlineUrls, '/pdf.worker.min.mjs', `/publications/${id}/read`])
      toast.success(t('pubs.offlineSaved'))
    } catch { toast.error(t('pubs.offlineFail')) }
  }
  const share = async () => {
    const url = `${location.origin}/publications/${id}`
    if (navigator.share) await navigator.share({ title, url }).catch(() => {})
    else { await navigator.clipboard.writeText(url).catch(() => {}); toast.success(url) }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {signedIn && (
        <button type="button" disabled={pending} aria-pressed={saved} onClick={() => start(async () => { setSaved(!saved); await savePublicationToLibraryAction(id, !saved) })}
          className={cn(pill, saved && 'border-primary text-primary')}>{saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}{saved ? t('pubs.unsave') : t('pubs.save')}</button>
      )}
      {signedIn && seriesId && <FollowSeriesButton seriesId={seriesId} initial={following} />}
      {offlineUrls.length > 0 && <button type="button" onClick={offline} className={pill}><CloudDownload className="size-4" />{t('pubs.offline')}</button>}
      <button type="button" onClick={share} className={pill}><Share2 className="size-4" />{t('pubs.share')}</button>
      {canEdit && <>
        <Link href={`/publications/${id}/edit`} className={pill}><Pencil className="size-4" />{t('pubs.edit')}</Link>
        <button type="button" onClick={() => setConfirm(true)} className={cn(pill, 'text-destructive')}><Trash2 className="size-4" />{t('pubs.delete')}</button>
      </>}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('pubs.delete')}</AlertDialogTitle><AlertDialogDescription>{t('pubs.deleteConfirm')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => start(async () => { if (await deletePublicationAction(id)) { toast.success(t('pubs.deleted')); router.push('/publications') } })}>{t('pubs.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
