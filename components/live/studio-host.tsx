'use client'

import Link from 'next/link'
import { useEffect, useReducer, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mic, MicOff, MonitorUp, Radio, RefreshCcw, Users, Video, VideoOff } from 'lucide-react'
import type { LocalVideoTrack, Room } from 'livekit-client'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { endLiveAction, goLiveAction } from '@/server/actions/live'

/** The host's studio: camera or screen, microphone, then Go live. Keep it open while live. */
export function StudioHost({ id, title, status: initial }: { id: string; title: string; status: 'scheduled' | 'live' | 'ended' }) {
  const { t } = useI18n()
  const router = useRouter()
  const video = useRef<HTMLVideoElement>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [status, setStatus] = useState(initial)
  const [viewers, setViewers] = useState(0)
  const [ready, setReady] = useState(false)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [pending, start] = useTransition()

  useEffect(() => {
    let r: Room | null = null, gone = false
    void (async () => {
      const res = await fetch(`/api/live/${id}/studio`, { method: 'POST' })
      const pass = res.ok ? await res.json() as { url: string; token: string } | null : null
      if (!pass || gone) { toast.error(t('live.host.studioOff')); return }
      if (pass.url.startsWith('fake:')) { setReady(true); return } // automated tests only
      const { Room, RoomEvent, Track } = await import('livekit-client')
      r = new Room({ adaptiveStream: true, dynacast: true })
      r.on(RoomEvent.LocalTrackPublished, (pub) => { if (pub.track?.kind === Track.Kind.Video && video.current) pub.track.attach(video.current); bump() })
      r.on(RoomEvent.LocalTrackUnpublished, () => bump())
      try {
        await r.connect(pass.url, pass.token)
        if (gone) { void r.disconnect(); return }
        setRoom(r)
        await r.localParticipant.setMicrophoneEnabled(true)
        await r.localParticipant.setCameraEnabled(true)
      } catch { toast.error(t('live.host.needsMedia')) }
      setReady(true)
    })()
    return () => { gone = true; void r?.disconnect() }
  }, [id, t])

  // Check in so viewers keep the live going (it ends by itself if this page is closed for 3 minutes)
  useEffect(() => {
    const ping = () => fetch(`/api/live/${id}/ping`, { method: 'POST' }).then((r) => r.json()).then((r) => setViewers(r.viewers ?? 0)).catch(() => {})
    void ping()
    const tm = setInterval(ping, 15_000)
    return () => clearInterval(tm)
  }, [id])

  const lp = room?.localParticipant
  const camOn = lp?.isCameraEnabled ?? false, micOn = lp?.isMicrophoneEnabled ?? false, sharing = lp?.isScreenShareEnabled ?? false
  const toggle = async (what: 'cam' | 'mic' | 'screen') => {
    try {
      if (what === 'cam') await lp?.setCameraEnabled(!camOn)
      if (what === 'mic') await lp?.setMicrophoneEnabled(!micOn)
      if (what === 'screen') await lp?.setScreenShareEnabled(!sharing, { audio: true })
    } catch { toast.error(t('live.host.needsMedia')) }
    bump()
  }
  const flip = async () => {
    const track = lp ? [...lp.videoTrackPublications.values()].find((p) => p.source === 'camera')?.track as LocalVideoTrack | undefined : undefined
    if (!track) return
    const { facingModeFromLocalTrack } = await import('livekit-client')
    await track.restartTrack({ facingMode: facingModeFromLocalTrack(track).facingMode === 'environment' ? 'user' : 'environment' }).catch(() => {})
  }
  const btn = 'flex flex-col items-center gap-1 text-xs text-white/85'
  const round = (on: boolean) => cn('flex size-14 items-center justify-center rounded-full', on ? 'bg-white text-black' : 'bg-white/15 hover:bg-white/25')

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" data-studio={status}>
      <header className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)]">
        <Link href={`/live/${id}`} aria-label={t('soon.back')} className="rounded-full p-2 hover:bg-white/10"><ArrowLeft className="size-5" /></Link>
        <p className="min-w-0 flex-1 truncate font-semibold">{title}</p>
        {status === 'live' ? <span className="flex items-center gap-1 rounded-md bg-[#FF3333] px-2 py-0.5 text-xs font-black tracking-wider" data-on-air><span className="size-1.5 animate-pulse rounded-full bg-white" />{t('live.host.onAir')}</span>
          : <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold">{t('live.host.preview')}</span>}
        <span className="flex items-center gap-1 text-sm" data-host-viewers><Users className="size-4" />{viewers}</span>
      </header>
      <div className="relative min-h-0 flex-1">
        <video ref={video} autoPlay playsInline muted className={cn('size-full object-contain', !sharing && '-scale-x-100')} />
        {!ready && <p className="absolute inset-0 flex items-center justify-center text-white/70">{t('live.host.connecting')}</p>}
      </div>
      <p className="px-4 pb-2 text-center text-xs text-white/60">{t('live.host.studioTip')}</p>
      <div className="flex flex-wrap items-end justify-center gap-4 px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        <button type="button" className={btn} onClick={() => toggle('cam')} aria-label={t('live.host.camera')}><span className={round(camOn)}>{camOn ? <Video /> : <VideoOff />}</span>{t('live.host.camera')}</button>
        {camOn && <button type="button" className={btn} onClick={flip} aria-label={t('live.host.flip')}><span className={round(false)}><RefreshCcw /></span>{t('live.host.flip')}</button>}
        <button type="button" className={btn} onClick={() => toggle('mic')} aria-label={t('live.host.mic')}><span className={round(micOn)}>{micOn ? <Mic /> : <MicOff />}</span>{t('live.host.mic')}</button>
        <button type="button" className={btn} onClick={() => toggle('screen')} aria-label={t('live.host.screen')}><span className={round(sharing)}><MonitorUp /></span>{t('live.host.screen')}</button>
        {status === 'scheduled' && <button type="button" disabled={pending || !ready} onClick={() => start(async () => { if (await goLiveAction(id)) setStatus('live') })} data-go-live
          className="flex h-14 items-center gap-2 rounded-full bg-[#FF3333] px-6 text-lg font-black disabled:opacity-50"><Radio />{t('live.host.goLive')}</button>}
        {status === 'live' && <button type="button" disabled={pending} onClick={() => start(async () => { if (await endLiveAction(id)) { setStatus('ended'); router.push(`/live/${id}`) } })} data-end-live
          className="flex h-14 items-center gap-2 rounded-full border-2 border-white px-6 text-lg font-black">{t('live.host.end')}</button>}
      </div>
    </div>
  )
}
