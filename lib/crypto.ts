import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url')
/** 6-digit numeric code, uniformly random. */
export const randomCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Tamper-proof small payloads (e.g. "this phone was verified") for short-lived cookies. */
export function signPayload(data: object, secret: string, ttlSeconds: number) {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyPayload<T>(token: string | undefined, secret: string): T | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  if (!safeEqual(sig, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as T & { exp: number }
    return data.exp * 1000 > Date.now() ? data : null
  } catch { return null }
}
