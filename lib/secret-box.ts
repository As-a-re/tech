import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/** AES-256-GCM encryption for small secrets at rest (e.g. 2-step verification keys). */
const key = (secret: string) => createHash('sha256').update(`papa-secret-box:${secret}`).digest()

export function seal(plain: string, secret: string) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(secret), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.')
}

export function open(sealed: string, secret: string) {
  const [iv, tag, enc] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'))
  const d = createDecipheriv('aes-256-gcm', key(secret), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}
