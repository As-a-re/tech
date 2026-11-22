import 'server-only'
import { createSign } from 'node:crypto'
import webpush from 'web-push'

/** Web Push (works on Android, desktop and installed iPhone apps). Off until VAPID keys are set (setup.sh creates them). */
let configured: boolean | null = null
function ready() {
  if (configured !== null) return configured
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  configured = !!(pub && priv)
  if (configured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:tech@papa.local', pub!, priv!)
  return configured
}

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || ''
export const pushEnabled = () => ready()

export type PushTarget = { endpoint: string; p256dh: string; auth: string }

export type PushPayload = { title: string; body: string; url: string; tag?: string; ring?: boolean }

/**
 * Returns 'gone' when the device unsubscribed (caller should delete it).
 * Browsers use Web Push; the Android and iOS apps are stored as endpoint "fcm:<token>" and go through Firebase Cloud Messaging.
 */
export async function sendPush(sub: PushTarget, payload: PushPayload): Promise<'ok' | 'gone' | 'error'> {
  if (sub.endpoint.startsWith('fcm:')) return sendFcm(sub.endpoint.slice(4), payload)
  if (!ready()) return 'error'
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: payload.ring ? 45 : 3600, urgency: payload.ring ? 'high' : 'normal' })
    return 'ok'
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    return code === 404 || code === 410 ? 'gone' : 'error'
  }
}

/* ───── Native apps: Firebase Cloud Messaging (HTTP v1) ───── */
type ServiceAccount = { project_id: string; client_email: string; private_key: string }
let account: ServiceAccount | null | undefined
let token: { value: string; expires: number } | null = null

/** FCM_SERVICE_ACCOUNT: the Firebase service account JSON (or the same JSON base64-encoded). */
function fcmAccount(): ServiceAccount | null {
  if (account !== undefined) return account
  const raw = process.env.FCM_SERVICE_ACCOUNT?.trim()
  try { account = raw ? JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')) : null } catch { account = null }
  return account ?? null
}
export const nativePushEnabled = () => !!fcmAccount()
/** For tests. */
export function resetFcm() { account = undefined; token = null }

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')
async function accessToken(a: ServiceAccount) {
  if (token && token.expires > Date.now() + 60_000) return token.value
  const now = Math.floor(Date.now() / 1000)
  const aud = process.env.FCM_OAUTH_URL || 'https://oauth2.googleapis.com/token'
  const body = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: a.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud, iat: now, exp: now + 3600 }))}`
  const jwt = `${body}.${b64url(createSign('RSA-SHA256').update(body).sign(a.private_key))}`
  const r = await fetch(aud, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })
  if (!r.ok) throw new Error(`FCM auth ${r.status}`)
  const j = await r.json() as { access_token: string; expires_in: number }
  token = { value: j.access_token, expires: Date.now() + j.expires_in * 1000 }
  return token.value
}

async function sendFcm(deviceToken: string, p: PushPayload): Promise<'ok' | 'gone' | 'error'> {
  const a = fcmAccount()
  if (!a) return 'error'
  try {
    const base = process.env.FCM_API_URL || 'https://fcm.googleapis.com'
    const r = await fetch(`${base}/v1/projects/${a.project_id}/messages:send`, {
      method: 'POST', headers: { Authorization: `Bearer ${await accessToken(a)}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ message: {
        token: deviceToken, notification: { title: p.title, body: p.body }, data: { url: p.url, tag: p.tag ?? '' },
        android: { priority: p.ring ? 'high' : 'normal', ttl: p.ring ? '45s' : '3600s', notification: { tag: p.tag, channel_id: p.ring ? 'calls' : 'default' } },
        apns: { headers: { 'apns-priority': p.ring ? '10' : '5' }, payload: { aps: { sound: 'default', 'thread-id': p.tag ?? 'papa' } } },
      } }),
    })
    if (r.ok) return 'ok'
    const e = await r.json().catch(() => ({})) as { error?: { status?: string; details?: { errorCode?: string }[] } }
    const code = e.error?.details?.find((d) => d.errorCode)?.errorCode ?? e.error?.status
    return r.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT' ? 'gone' : 'error'
  } catch { return 'error' }
}
