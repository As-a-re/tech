'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Room } from 'livekit-client'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { useLive } from '@/hooks/use-live'
import { getJson, postJson } from '@/lib/live-fetch'
import type { CallView } from '@/server/calls/calls'
import { endBeep, playRing, stopRing } from './sounds'
import { CallScreen, MiniCallBar } from './call-screen'

export type Phase = 'incoming' | 'outgoing' | 'live' | 'ended'
type Pass = { ok: true; id: string; token: string; url: string; error?: never } | { ok: false; error: string }

type Ctx = {
  enabled: boolean
  /** Start a call in a chat (or join the group call already going on there). */
  start: (conversationId: string, media: 'voice' | 'video') => void
  join: (callId: string) => void
  currentId: string | null
}
const CallContext = createContext<Ctx>({ enabled: false, start: () => {}, join: () => {}, currentId: null })
export const useCalls = () => useContext(CallContext)

/**
 * Calls live at the top of the app, so a call keeps going while the member moves between screens.
 * Signals (ringing, answered, ended) arrive over the live connection; voice and video go through LiveKit.
 */
export function CallProvider({ me, enabled, children }: { me: { id: string; fullName: string } | null; enabled: boolean; children: React.ReactNode }) {
  const { t } = useI18n()
  const [view, setView] = useState<CallView | null>(null)
  const [phase, setPhase] = useState<Phase | null>(null)
  const [endText, setEndText] = useState('')
  const [minimized, setMinimized] = useState(false)
  const [room, setRoom] = useState<Room | null>(null)
  const [connecting, setConnecting] = useState(false)
  const current = useRef<{ id: string; phase: Phase } | null>(null)
  const roomRef = useRef<Room | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioBox = useRef<HTMLDivElement>(null)

  const setBoth = (v: CallView | null, p: Phase | null) => {
    setView(v); setPhase(p)
    current.current = v && p ? { id: v.id, phase: p } : null
  }

  const disconnect = useCallback(() => {
    const r = roomRef.current
    roomRef.current = null
    setRoom(null)
    if (r) void r.disconnect()
  }, [])

  const close = useCallback(() => {
    stopRing(); disconnect()
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setBoth(null, null); setMinimized(false); setEndText('')
  }, [disconnect])

  /** Show why the call ended for two seconds, then close the screen. */
  const finish = useCallback((v: CallView | null, text: string) => {
    stopRing(); disconnect(); endBeep()
    setEndText(text)
    if (v) { setView(v); setPhase('ended'); current.current = { id: v.id, phase: 'ended' } }
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(close, 2000)
  }, [close, disconnect])

  const endedText = useCallback((v: CallView) => {
    const name = v.kind === 'direct' ? v.title.split(' ')[0] : v.title
    if (me && v.startedBy === me.id && v.answeredAt === null) {
      if (v.result === 'busy') return t('calls.onAnotherCall', { name })
      if (v.result === 'declined') return t('calls.declinedBy', { name })
      if (v.result === 'missed') return t('calls.noAnswerFrom', { name })
    }
    return t('calls.ended')
  }, [me, t])

  const connect = useCallback(async (pass: { url: string; token: string }, media: 'voice' | 'video') => {
    // Automated screen tests run without a LiveKit server (LIVEKIT_URL=fake://); real calls never use this
    if (pass.url.startsWith('fake:')) return true
    setConnecting(true)
    try {
      const { Room, RoomEvent, Track, VideoPresets } = await import('livekit-client')
      const r = new Room({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: VideoPresets.h540.resolution, facingMode: 'user' } })
      // Everyone's voice plays here, so it keeps going while the call screen is minimized
      r.on(RoomEvent.TrackSubscribed, (track) => { if (track.kind === Track.Kind.Audio && audioBox.current) audioBox.current.appendChild(track.attach()) })
      r.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach().forEach((el) => el.remove()) })
      roomRef.current = r
      setRoom(r)
      await r.connect(pass.url, pass.token)
      try {
        await r.localParticipant.setMicrophoneEnabled(true)
        if (media === 'video') await r.localParticipant.setCameraEnabled(true)
      } catch { toast.error(t('calls.err.media')) }
      return true
    } catch {
      return false
    } finally { setConnecting(false) }
  }, [t])

  const apply = useCallback((v: CallView | null, callId: string) => {
    const cur = current.current
    if (!v) { if (cur?.id === callId) close(); return }
    if (!cur) {
      // A new call ringing for me (ignored while I'm already on one)
      if (v.status !== 'ended' && v.myState === 'ringing') { setBoth(v, 'incoming'); setMinimized(false); playRing('incoming') }
      return
    }
    if (cur.id !== v.id || cur.phase === 'ended') return
    setView(v)
    if (v.status === 'ended') { finish(v, endedText(v)); return }
    if (cur.phase === 'incoming' && v.myState !== 'ringing') { close(); return } // answered or declined on another device
    if (cur.phase === 'outgoing' && v.status === 'active') { stopRing(); setPhase('live'); current.current = { id: v.id, phase: 'live' } }
  }, [close, endedText, finish])

  const refresh = useCallback(async (callId: string) => {
    apply(await getJson<CallView>(`/api/calls/${callId}`), callId)
  }, [apply])

  // On opening the app (e.g. from a "Kwame is calling…" notification), pick up a ringing call
  const checkCurrent = useCallback(async () => {
    if (!me || !enabled || current.current) return
    const v = await getJson<CallView>('/api/calls/current')
    if (v && v.myState === 'ringing') apply(v, v.id)
  }, [apply, enabled, me])
  useEffect(() => { void checkCurrent() }, [checkCurrent])

  useLive((e) => {
    if (e.kind === 'call' && e.callId) void refresh(e.callId)
    if (e.kind === 'hello') { if (current.current) void refresh(current.current.id); else void checkCurrent() }
  }, !!me)

  // While on a call, check in so a closed tab or lost phone drops out after a while
  const live = phase === 'outgoing' || phase === 'live'
  useEffect(() => {
    if (!live || !view) return
    const id = view.id
    const tm = setInterval(() => { void postJson(`/api/calls/${id}/ping`) }, 10_000)
    const bye = () => { navigator.sendBeacon?.(`/api/calls/${id}/leave`) }
    window.addEventListener('pagehide', bye)
    return () => { clearInterval(tm); window.removeEventListener('pagehide', bye) }
  }, [live, view?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const begin = useCallback(async (pass: Pass | null, media?: 'voice' | 'video') => {
    if (!pass || !pass.ok) { toast.error(t(`calls.err.${pass && !pass.ok ? pass.error : 'connect'}` as MessageKey)); return }
    const v = await getJson<CallView>(`/api/calls/${pass.id}`)
    if (!v) { toast.error(t('calls.err.not_found')); return }
    const p: Phase = v.status === 'ringing' ? 'outgoing' : 'live'
    setBoth(v, p); setMinimized(false)
    if (p === 'outgoing') playRing('outgoing')
    if (!(await connect(pass, media ?? v.media))) {
      await postJson(`/api/calls/${pass.id}/leave`)
      toast.error(t('calls.err.connect'))
      close()
    }
  }, [close, connect, t])

  const start = useCallback((conversationId: string, media: 'voice' | 'video') => {
    if (!enabled) { toast(t('calls.soon')); return }
    if (current.current && current.current.phase !== 'ended') { toast.error(t('calls.err.in_call')); return }
    void (async () => begin(await postJson<Pass>('/api/calls', { conversationId, media }), media))()
  }, [begin, enabled, t])

  const join = useCallback((callId: string) => {
    if (!enabled) { toast(t('calls.soon')); return }
    if (current.current && current.current.phase !== 'ended') { toast.error(t('calls.err.in_call')); return }
    void (async () => begin(await postJson<Pass>(`/api/calls/${callId}/join`)))()
  }, [begin, enabled, t])

  const accept = useCallback(async () => {
    const v = view
    if (!v) return
    stopRing()
    const pass = await postJson<Pass>(`/api/calls/${v.id}/join`)
    if (!pass || !pass.ok) { toast.error(t(`calls.err.${pass && !pass.ok ? pass.error : 'connect'}` as MessageKey)); close(); return }
    setPhase('live'); current.current = { id: v.id, phase: 'live' }
    if (!(await connect(pass, v.media))) { await postJson(`/api/calls/${v.id}/leave`); toast.error(t('calls.err.connect')); close() }
  }, [close, connect, t, view])

  const decline = useCallback(async () => {
    const v = view
    close()
    if (v) await postJson(`/api/calls/${v.id}/decline`)
  }, [close, view])

  const hangUp = useCallback(async () => {
    const v = view
    if (!v) return
    finish(v, t('calls.ended'))
    await postJson(`/api/calls/${v.id}/leave`)
  }, [finish, t, view])

  useEffect(() => () => { stopRing(); roomRef.current?.disconnect() }, [])

  return (
    <CallContext.Provider value={{ enabled, start, join, currentId: view?.id ?? null }}>
      {children}
      <div ref={audioBox} hidden data-call-audio />
      {view && phase && me && (minimized && phase !== 'incoming' && phase !== 'ended'
        ? <MiniCallBar view={view} phase={phase} onOpen={() => setMinimized(false)} />
        : <CallScreen view={view} phase={phase} me={me} room={room} connecting={connecting} endText={endText}
            onAccept={accept} onDecline={decline} onHangUp={hangUp} onMinimize={() => setMinimized(true)} />)}
    </CallContext.Provider>
  )
}
