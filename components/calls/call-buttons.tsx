'use client'

import { Phone, Video } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { ChatHeader } from '@/server/messages/chat'
import { useCalls } from './call-provider'

/** 📞 and 🎥 in a chat's top bar. */
export function CallButtons({ header }: { header: ChatHeader }) {
  const { t } = useI18n()
  const { start } = useCalls()
  if (header.kind === 'direct' && !header.other) return null
  const go = (media: 'voice' | 'video') => {
    if (!header.calls.on) { toast(t('calls.soon')); return }
    if (header.calls.blocked) { toast.error(t(`calls.err.${header.calls.blocked}`)); return }
    if (header.blockedReason === 'blocked') { toast.error(t('calls.err.blocked')); return }
    start(header.id, media)
  }
  return (
    <>
      <button type="button" onClick={() => go('video')} aria-label={t('calls.videoCall')} title={t('calls.videoCall')} className="rounded-full p-2 text-primary hover:bg-muted"><Video className="size-5" /></button>
      <button type="button" onClick={() => go('voice')} aria-label={t('calls.voiceCall')} title={t('calls.voiceCall')} className="rounded-full p-2 text-primary hover:bg-muted"><Phone className="size-5" /></button>
    </>
  )
}

/** Green bar in a group while a call is going on there, with Join. */
export function OngoingCallBar({ header }: { header: ChatHeader }) {
  const { t } = useI18n()
  const { join, currentId } = useCalls()
  const open = header.calls.open
  if (header.kind !== 'group' || !open || open.joined === 0 || currentId === open.id) return null
  return (
    <div className="flex items-center gap-3 border-b bg-green-600/10 px-4 py-2 text-sm" data-ongoing-call>
      {open.media === 'video' ? <Video className="size-4 text-green-600" /> : <Phone className="size-4 text-green-600" />}
      <span className="flex-1 font-medium">{t('calls.ongoing', { n: open.joined })}</span>
      <button type="button" onClick={() => join(open.id)} className="rounded-full bg-green-600 px-4 py-1 font-semibold text-white hover:bg-green-500">{t('calls.joinCall')}</button>
    </div>
  )
}
