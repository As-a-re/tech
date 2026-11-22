'use client'

import { useEffect, useRef } from 'react'

export type LiveEvent = { kind: 'hello' | 'notification' | 'message' | 'refresh' | 'typing' | 'read' | 'call'; conversationId?: string; by?: string; callId?: string }
type Listener = (e: LiveEvent) => void

/**
 * One live connection per browser tab, shared by every part of the screen that listens
 * (browsers allow only a few open connections per site, so each listener must not open its own).
 * EventSource reconnects by itself if the network drops.
 */
const listeners = new Set<Listener>()
let source: EventSource | null = null

function connect() {
  if (source || typeof EventSource === 'undefined') return
  source = new EventSource('/api/realtime')
  source.onmessage = (m) => {
    let e: LiveEvent
    try { e = JSON.parse(m.data) } catch { return }
    for (const l of [...listeners]) l(e)
  }
}

function disconnectIfIdle() {
  if (listeners.size === 0 && source) { source.close(); source = null }
}

export function useLive(onEvent: Listener, enabled = true) {
  const cb = useRef(onEvent)
  cb.current = onEvent
  useEffect(() => {
    if (!enabled) return
    const l: Listener = (e) => cb.current(e)
    listeners.add(l)
    connect()
    // A listener added after the connection opened still gets a "hello" so it can load fresh data
    if (source?.readyState === EventSource.OPEN) queueMicrotask(() => l({ kind: 'hello' }))
    return () => { listeners.delete(l); setTimeout(disconnectIfIdle, 1000) }
  }, [enabled])
}
