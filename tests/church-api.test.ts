import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { apiDirectory, ChurchApiError } from '@/integrations/church-db/api'

/** A local HTTP server standing in for the church database, to test PAPA's API client against the contract. */
let server: Server, base = ''
beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.headers.authorization !== 'Bearer k123') { res.writeHead(401).end(); return }
    const id = decodeURIComponent(req.url!.split('/members/')[1] ?? '')
    if (id === 'CAC-1') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
        church_id: 'CAC-1', full_name: ' Ama Owusu ', phone: '+233 24 123 4567', status: 'active', date_of_birth: '1994-05-17',
        assembly: { id: 42, name: 'Bethel Assembly', town: 'Madina' }, district: { id: 'D7', name: 'Madina District' },
      }))
    } else if (id === 'BAD') res.writeHead(200, { 'content-type': 'application/json' }).end('{"oops":true}')
    else if (id === 'DOWN') res.writeHead(503).end()
    else res.writeHead(404).end()
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

describe('church database API client', () => {
  it('reads and normalises a member', async () => {
    const m = await apiDirectory(base, 'k123').findMember('CAC-1')
    expect(m).toEqual({
      churchId: 'CAC-1', fullName: 'Ama Owusu', phone: '233241234567', active: true, dateOfBirth: '1994-05-17',
      assembly: { externalId: '42', name: 'Bethel Assembly', town: 'Madina' }, district: { externalId: 'D7', name: 'Madina District' },
    })
  })
  it('returns null for unknown members', async () => expect(await apiDirectory(base, 'k123').findMember('NOPE')).toBeNull())
  it('fails clearly on errors, bad keys and bad data', async () => {
    await expect(apiDirectory(base, 'k123').findMember('DOWN')).rejects.toBeInstanceOf(ChurchApiError)
    await expect(apiDirectory(base, 'wrong').findMember('CAC-1')).rejects.toBeInstanceOf(ChurchApiError)
    await expect(apiDirectory(base, 'k123').findMember('BAD')).rejects.toBeInstanceOf(ChurchApiError)
    await expect(apiDirectory('http://127.0.0.1:1', 'k123', 500).findMember('X')).rejects.toBeInstanceOf(ChurchApiError)
  })
})
