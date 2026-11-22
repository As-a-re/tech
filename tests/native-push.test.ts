import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createVerify, generateKeyPairSync } from 'node:crypto'
import { nativePushEnabled, resetFcm, sendPush } from '@/integrations/push'

/** Stand-ins for Google's token endpoint and the FCM API. */
let server: Server, sent: Record<string, unknown>[] = [], jwtOk = false
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c)).on('end', () => {
      if (req.url === '/token') {
        const jwt = new URLSearchParams(body).get('assertion')!.split('.')
        jwtOk = createVerify('RSA-SHA256').update(`${jwt[0]}.${jwt[1]}`).verify(publicKey, Buffer.from(jwt[2], 'base64url'))
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ access_token: 'at-1', expires_in: 3600 }))
        return
      }
      if (req.headers.authorization !== 'Bearer at-1') { res.writeHead(401).end(); return }
      const m = JSON.parse(body).message
      sent.push(m)
      if (m.token === 'gone-token-0000000000000') res.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }))
      else res.writeHead(200, { 'content-type': 'application/json' }).end('{"name":"projects/p/messages/1"}')
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  Object.assign(process.env, { FCM_OAUTH_URL: `${base}/token`, FCM_API_URL: base,
    FCM_SERVICE_ACCOUNT: Buffer.from(JSON.stringify({ project_id: 'papa-test', client_email: 'papa@papa-test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) })).toString('base64') })
  resetFcm()
})
afterAll(async () => { for (const k of ['FCM_OAUTH_URL', 'FCM_API_URL', 'FCM_SERVICE_ACCOUNT']) delete process.env[k]; resetFcm(); await new Promise<void>((r) => server.close(() => r())) })

describe('push to the Android and iOS apps (Firebase)', () => {
  it('signs in with the service account and sends the notification with its link', async () => {
    expect(nativePushEnabled()).toBe(true)
    expect(await sendPush({ endpoint: 'fcm:device-token-1234567890', p256dh: '', auth: '' }, { title: 'PAPA', body: 'Hello', url: 'https://papa.test/market', tag: 'x', ring: true })).toBe('ok')
    expect(jwtOk).toBe(true)
    expect(sent[0]).toMatchObject({ token: 'device-token-1234567890', notification: { title: 'PAPA', body: 'Hello' }, data: { url: 'https://papa.test/market' }, android: { priority: 'high' } })
  })
  it('reports uninstalled apps as gone (so the token is deleted)', async () => {
    expect(await sendPush({ endpoint: 'fcm:gone-token-0000000000000', p256dh: '', auth: '' }, { title: 'PAPA', body: 'x', url: '/' })).toBe('gone')
  })
  it('does nothing without Firebase keys', async () => {
    const keep = process.env.FCM_SERVICE_ACCOUNT
    delete process.env.FCM_SERVICE_ACCOUNT; resetFcm()
    expect(await sendPush({ endpoint: 'fcm:device-token-1234567890', p256dh: '', auth: '' }, { title: 'PAPA', body: 'x', url: '/' })).toBe('error')
    process.env.FCM_SERVICE_ACCOUNT = keep; resetFcm()
  })
})
