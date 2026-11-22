import 'server-only'
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'

/**
 * Voice and video calls run on LiveKit (open source; LiveKit Cloud or our own server).
 * Off until LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are set in .env.local.
 * For testing on your own PC: bash scripts/livekit-dev.sh
 */
export function livekitEnabled() {
  return !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET)
}

/** The address browsers connect to (wss:// in production). */
export const livekitUrl = () => process.env.LIVEKIT_URL ?? ''

/** A short-lived pass for one member to join one call's room. */
export async function callToken(room: string, user: { id: string; name: string }) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: user.id, name: user.name, ttl: '2h' })
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true })
  return at.toJwt()
}

/** Live services: the host may publish; viewers only watch (and never appear on screen). */
export async function liveToken(room: string, user: { id: string; name: string }, host: boolean) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: user.id, name: user.name, ttl: '6h' })
  at.addGrant({ room, roomJoin: true, canPublish: host, canSubscribe: true, canPublishData: false, hidden: !host })
  return at.toJwt()
}

/** Closes the room when a call ends (everyone still connected is disconnected). Never fails the caller. */
export async function closeRoom(room: string) {
  if (!livekitEnabled()) return
  try {
    const http = livekitUrl().replace(/^ws/, 'http')
    await new RoomServiceClient(http, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET).deleteRoom(room)
  } catch { /* the room may already be gone */ }
}
