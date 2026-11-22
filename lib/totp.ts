import { createHmac, randomBytes } from 'node:crypto'

/** RFC 6238 time-based one-time codes (Google Authenticator, Microsoft Authenticator, Authy…). */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer) {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(s: string) {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = 0, value = 0
  const out: number[] = []
  for (const c of clean) {
    const i = ALPHABET.indexOf(c)
    if (i < 0) throw new Error('Invalid base32')
    value = (value << 5) | i; bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}

export const newTotpSecret = () => base32Encode(randomBytes(20))

export function totpAt(secret: string, counter: number) {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', base32Decode(secret)).update(msg).digest()
  const o = h[h.length - 1] & 15
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]
  return String(n % 1_000_000).padStart(6, '0')
}

/** Accepts the current code and one step either side (clock drift). */
export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const c = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return false
  const step = Math.floor(now / 30_000)
  return [-1, 0, 1].some((d) => totpAt(secret, step + d) === c)
}

export const otpauthUrl = (secret: string, account: string) =>
  `otpauth://totp/${encodeURIComponent(`PAPA:${account}`)}?secret=${secret}&issuer=PAPA&algorithm=SHA1&digits=6&period=30`
