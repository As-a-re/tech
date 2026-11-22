'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import type { RemoteTrack, Room } from 'livekit-client'
import { useI18n } from '@/lib/i18n/client'

/** Watches a live broadcast from PAPA's studio (LiveKit): the host's camera or shared screen, and their sound. */
export function StudioViewer({ liveId, viewerKey }: { liveId: string; viewerKey: string }) {
  const { t } = useI18n()
  const video = useRef<HTMLVideoElement>(null)
  const audioBox = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [needsTap, setNeedsTap] = useState(false)
  const [waiting, setWaiting] = useState(true)
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    let r: Room | null = null
    let gone = false
    void (async () => {
      const res = await fetch(`/api/live/${liveId}/watch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: viewerKey }) })
      const pass = res.ok ? await res.json() as { url: string; token: string } | null : null
      if (!pass || gone || pass.url.startsWith('fake:')) return
      const { Room, RoomEvent, Track } = await import('livekit-client')
      r = new Room({ adaptiveStream: true })
      const show = () => {
        if (!r) return
        const pubs = [...r.remoteParticipants.values()].flatMap((p) => [...p.trackPublications.values()])
        const v = pubs.find((x) => x.track && x.source === Track.Source.ScreenShare) ?? pubs.find((x) => x.track && x.kind === Track.Kind.Video)
        if (v?.track && video.current) { v.track.attach(video.current); setWaiting(false) } else setWaiting(true)
        bump()
      }
      r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => { if (track.kind === Track.Kind.Audio && audioBox.current) audioBox.current.appendChild(track.attach()); show() })
      r.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => { track.detach().forEach((el) => { if (el !== video.current) el.remove() }); show() })
      r.on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsTap(!r!.canPlaybackAudio))
      await r.connect(pass.url, pass.token).catch(() => {})
      if (gone) { void r.disconnect(); return }
      setRoom(r); show(); setNeedsTap(!r.canPlaybackAudio)
    })()
    return () => { gone = true; void r?.disconnect() }
  }, [liveId, viewerKey])
  return (
    <div className="relative size-full bg-black">
      <video ref={video} autoPlay playsInline muted className="size-full object-contain" data-studio-video />
      <div ref={audioBox} hidden />
      {waiting && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">{t('live.host.connecting')}</p>}
      {needsTap && room && <button type="button" onClick={() => { void room.startAudio(); setNeedsTap(false) }}
        className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 font-bold text-black shadow"><Volume2 className="size-5" />{t('live.tapSound')}</button>}
    </div>
  )
}
