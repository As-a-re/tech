'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { ChevronDown, Mic, MicOff, Phone, PhoneOff, RefreshCcw, Users, Video, VideoOff, Volume2 } from 'lucide-react'
import type { LocalVideoTrack, Participant, Room } from 'livekit-client'
import { useI18n } from '@/lib/i18n/client'
import { cn } from '@/lib/utils'
import { callDuration } from '@/lib/calls/text'
import type { CallView } from '@/server/calls/calls'
import { UserAvatar } from '@/components/common/user-avatar'
import type { Phase } from './call-provider'

function useTicker(on: boolean) {
  const [, tick] = useReducer((x: number) => x + 1, 0)
  useEffect(() => { if (!on) return; const id = setInterval(tick, 1000); return () => clearInterval(id) }, [on])
}

/** Re-renders whenever people join, leave, mute or turn cameras on/off (sound is played by the call provider). */
function useRoom(room: Room | null) {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [net, setNet] = useState<'ok' | 'reconnecting'>('ok')
  useEffect(() => {
    if (!room) return
    let off = () => {}
    let cancelled = false
    void import('livekit-client').then(({ RoomEvent }) => {
      if (cancelled) return
      const events = [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected,
        RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ActiveSpeakersChanged, RoomEvent.Connected] as const
      const down = () => setNet('reconnecting'), up = () => setNet('ok')
      for (const e of events) room.on(e, bump)
      room.on(RoomEvent.Reconnecting, down).on(RoomEvent.Reconnected, up)
      off = () => { for (const e of events) room.off(e, bump); room.off(RoomEvent.Reconnecting, down).off(RoomEvent.Reconnected, up) }
      bump()
    })
    return () => { cancelled = true; off() }
  }, [room])
  return { net }
}

function VideoTile({ p, mirror, small }: { p: Participant; mirror?: boolean; small?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const pub = [...p.trackPublications.values()].find((x) => x.kind === 'video' && x.source === 'camera')
  const track = pub && !pub.isMuted ? pub.track : undefined
  useEffect(() => {
    const el = ref.current
    if (!track || !el) return
    track.attach(el)
    return () => { track.detach(el) }
  }, [track])
  return (
    <div className={cn('relative overflow-hidden bg-neutral-900', small ? 'rounded-xl' : 'size-full', p.isSpeaking && 'ring-2 ring-[#00F0FF]')}>
      {track ? <video ref={ref} autoPlay playsInline muted className={cn('size-full object-cover', mirror && '-scale-x-100')} />
        : <div className="flex size-full items-center justify-center"><UserAvatar name={p.name || '?'} src={null} className={cn('bg-white/10 text-white', small ? 'size-12' : 'size-24 text-3xl')} /></div>}
      {!small && <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs">{p.name}{!p.isMicrophoneEnabled && ' 🔇'}</span>}
    </div>
  )
}

function Control({ label, onClick, active, danger, children, big }: { label: string; onClick: () => void; active?: boolean; danger?: boolean; big?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={cn('flex flex-col items-center gap-1.5 text-xs text-white/85')}>
      <span className={cn('flex items-center justify-center rounded-full transition', big ? 'size-16' : 'size-14',
        danger ? 'bg-[#FF3333] hover:bg-[#ff4d4d]' : active ? 'bg-white text-black' : 'bg-white/15 hover:bg-white/25')}>{children}</span>
      <span className="max-w-20 truncate">{label}</span>
    </button>
  )
}

/** Full-screen call: incoming (accept/decline), calling/ringing, and the call itself with its controls. */
export function CallScreen({ view, phase, me, room, connecting, endText, onAccept, onDecline, onHangUp, onMinimize }: {
  view: CallView; phase: Phase; me: { id: string; fullName: string }; room: Room | null; connecting: boolean; endText: string
  onAccept: () => void; onDecline: () => void; onHangUp: () => void; onMinimize: () => void
}) {
  const { t } = useI18n()
  const { net } = useRoom(room)
  useTicker(phase === 'live')
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  const [outIdx, setOutIdx] = useState(0)
  const [, rerender] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!room) return
    void import('livekit-client').then(({ Room }) => Room.getLocalDevices('audiooutput', false)).then(setOutputs).catch(() => {})
  }, [room])
  const local = room?.localParticipant
  const remotes = room ? [...room.remoteParticipants.values()] : []
  const micOn = local?.isMicrophoneEnabled ?? false
  const camOn = local?.isCameraEnabled ?? false
  const anyVideo = camOn || remotes.some((p) => p.isCameraEnabled)
  const caller = view.people.find((p) => p.id === view.startedBy)
  const incomingTitle = view.kind === 'group' ? t('calls.groupIncoming', { name: caller?.fullName.split(' ')[0] ?? '' })
    : view.media === 'video' ? t('calls.incomingVideo') : t('calls.incomingVoice')
  const status = phase === 'ended' ? endText : phase === 'incoming' ? incomingTitle
    : net === 'reconnecting' ? t('calls.reconnecting') : connecting ? t('calls.connecting')
      : phase === 'outgoing' ? (view.people.some((p) => p.id !== me.id && p.state === 'ringing') ? t('calls.ringing') : t('calls.calling'))
        : view.answeredAt ? callDuration(Math.max(0, Math.round((Date.now() - Date.parse(view.answeredAt)) / 1000))) : ''

  const toggleMic = async () => { await local?.setMicrophoneEnabled(!micOn); rerender() }
  const toggleCam = async () => { try { await local?.setCameraEnabled(!camOn) } catch { /* no camera */ } rerender() }
  const flip = async () => {
    const pub = local ? [...local.videoTrackPublications.values()].find((p) => p.source === 'camera') : undefined
    const track = pub?.track as LocalVideoTrack | undefined
    if (!track) return
    const { facingModeFromLocalTrack } = await import('livekit-client')
    const now = facingModeFromLocalTrack(track).facingMode
    await track.restartTrack({ facingMode: now === 'environment' ? 'user' : 'environment' }).catch(() => {})
  }
  const speaker = async () => {
    if (!room || outputs.length < 2) return
    const next = (outIdx + 1) % outputs.length
    setOutIdx(next)
    await room.switchActiveDevice('audiooutput', outputs[next].deviceId).catch(() => {})
  }

  return (
    <div role="dialog" aria-modal aria-label={view.title} data-call-screen={phase}
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      {/* Video area (or the photo when nobody's camera is on) */}
      <div className="absolute inset-0">
        {phase === 'live' && anyVideo && local ? (
          remotes.length <= 1 ? (
            <>
              {remotes[0] ? <VideoTile p={remotes[0]} /> : <VideoTile p={local} mirror />}
              {remotes[0] && <div className="absolute bottom-36 right-4 h-44 w-28 sm:h-56 sm:w-40"><VideoTile p={local} mirror small /></div>}
            </>
          ) : (
            <div className={cn('grid size-full gap-1 p-1 pb-32 pt-20', remotes.length + 1 <= 4 ? 'grid-cols-2' : 'grid-cols-3')}>
              {[local, ...remotes].map((p) => <div key={p.identity} className="min-h-0 overflow-hidden rounded-xl"><VideoTile p={p} mirror={p === local} /></div>)}
            </div>
          )
        ) : null}
      </div>

      <div className="relative flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),12px)]">
        {phase !== 'incoming' && phase !== 'ended' && (
          <button type="button" aria-label={t('calls.minimize')} onClick={onMinimize} className="rounded-full p-2 hover:bg-white/10"><ChevronDown className="size-6" /></button>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-white/70">{view.media === 'video' ? <Video className="size-4" /> : <Phone className="size-4" />}PAPA</span>
      </div>

      {(!anyVideo || phase !== 'live') && (
        <div className="relative mt-[8vh] flex flex-col items-center gap-3 px-6 text-center">
          {view.kind === 'group' && !view.avatarUrl ? <span className="flex size-28 items-center justify-center rounded-full bg-white/10"><Users className="size-14" /></span>
            : <UserAvatar name={view.title} src={view.avatarUrl} className={cn('size-28 bg-white/10 text-4xl text-white', (phase === 'incoming' || phase === 'outgoing') && 'animate-pulse')} />}
          <h2 className="text-2xl font-bold" data-call-title>{view.title}</h2>
          <p className="text-white/75" data-call-status>{status}</p>
          {phase === 'live' && view.kind === 'group' && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {[...(local ? [local] : []), ...remotes].map((p) => (
                <span key={p.identity} className={cn('flex flex-col items-center gap-1 text-xs', p.isSpeaking && 'text-[#00F0FF]')}>
                  <UserAvatar name={p.name || '?'} src={view.people.find((x) => x.id === p.identity)?.avatarUrl ?? null} className={cn('size-14 bg-white/10 text-white', p.isSpeaking && 'ring-2 ring-[#00F0FF]')} />
                  {p === local ? t('calls.you') : (p.name ?? '').split(' ')[0]}{!p.isMicrophoneEnabled && ' 🔇'}
                </span>
              ))}
            </div>
          )}
          {phase === 'live' && view.kind === 'group' && remotes.length === 0 && <p className="text-sm text-white/60">{t('calls.waiting')}</p>}
        </div>
      )}
      {anyVideo && phase === 'live' && (
        <div className="relative px-4 pt-2 text-center"><p className="font-semibold drop-shadow">{view.title}</p><p className="text-sm text-white/80 drop-shadow" data-call-status>{status}</p></div>
      )}

      <div className="relative mt-auto flex flex-wrap items-end justify-center gap-5 bg-gradient-to-t from-black/90 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),24px)] pt-10">
        {phase === 'incoming' ? (
          <div className="flex w-full max-w-xs justify-between">
            <Control label={t('calls.decline')} onClick={onDecline} danger big><PhoneOff className="size-7" /></Control>
            <button type="button" aria-label={t('calls.accept')} onClick={onAccept} className="flex flex-col items-center gap-1.5 text-xs text-white/85">
              <span className="flex size-16 animate-bounce items-center justify-center rounded-full bg-green-500 hover:bg-green-400">{view.media === 'video' ? <Video className="size-7" /> : <Phone className="size-7" />}</span>{t('calls.accept')}
            </button>
          </div>
        ) : phase === 'ended' ? null : (
          <>
            <Control label={camOn ? t('calls.cameraOff') : t('calls.cameraOn')} onClick={toggleCam} active={camOn}>{camOn ? <Video className="size-6" /> : <VideoOff className="size-6" />}</Control>
            {camOn && <Control label={t('calls.flip')} onClick={flip}><RefreshCcw className="size-6" /></Control>}
            <Control label={micOn ? t('calls.mute') : t('calls.unmute')} onClick={toggleMic} active={!micOn}>{micOn ? <Mic className="size-6" /> : <MicOff className="size-6" />}</Control>
            {outputs.length > 1 && <Control label={t('calls.speaker')} onClick={speaker} active={outIdx > 0}><Volume2 className="size-6" /></Control>}
            <Control label={t('calls.end')} onClick={onHangUp} danger><PhoneOff className="size-6" /></Control>
          </>
        )}
      </div>
    </div>
  )
}

/** The thin bar shown while the call screen is minimized. */
export function MiniCallBar({ view, phase, onOpen }: { view: CallView; phase: Phase; onOpen: () => void }) {
  const { t } = useI18n()
  useTicker(true)
  const time = phase === 'live' && view.answeredAt ? callDuration(Math.max(0, Math.round((Date.now() - Date.parse(view.answeredAt)) / 1000))) : t('calls.calling')
  return (
    <button type="button" onClick={onOpen} data-mini-call
      className="fixed bottom-20 left-1/2 z-[90] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-green-500 md:bottom-6">
      {view.media === 'video' ? <Video className="size-4" /> : <Phone className="size-4" />}
      <span className="truncate">{view.title} · {time}</span><span className="font-normal opacity-90">— {t('calls.returnToCall')}</span>
    </button>
  )
}
