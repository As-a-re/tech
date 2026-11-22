import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import S3rver from 's3rver'
import { keyOf, openStream, putBytes, readBytes, resetStorageClient, saveFile, sizeOf, UploadError } from '@/integrations/storage'

const text = async (s: ReadableStream) => new TextDecoder().decode(new Uint8Array(await new Response(s).arrayBuffer()))
const saved = { driver: process.env.STORAGE_DRIVER, dir: process.env.UPLOAD_DIR }

async function exercise() {
  const url = await putBytes('zztest/a/hello.txt', new TextEncoder().encode('Hello PAPA'), 'text/plain')
  expect(url).toBe('/media/zztest/a/hello.txt')
  expect(new TextDecoder().decode(await readBytes(url))).toBe('Hello PAPA')
  expect(await sizeOf(url)).toBe(10)
  expect(await sizeOf('/media/zztest/missing.txt')).toBeNull()
  expect(await text(await openStream(url))).toBe('Hello PAPA')
  expect(await text(await openStream(url, { start: 6, end: 9 }))).toBe('PAPA')
  const f = await saveFile(new File([new Uint8Array([0xff, 0xd8, 0xff])], 'x.jpg', { type: 'image/jpeg' }), 'zztest/u1', ['image'])
  expect(f.url).toMatch(/^\/media\/zztest\/u1\/[0-9a-f-]{36}\.jpg$/)
  expect(await sizeOf(f.url)).toBe(3)
  await expect(saveFile(new File(['x'], 'x.exe', { type: 'application/x-msdownload' }), 'zztest', ['image'])).rejects.toBeInstanceOf(UploadError)
}

describe('storage paths', () => {
  it('never lets a path climb out of storage', () => {
    expect(keyOf('/media/posts/a.jpg')).toBe('posts/a.jpg')
    for (const bad of ['/media/../etc/passwd', 'a/../../b', '/media/', 'a//b']) expect(() => keyOf(bad)).toThrow(UploadError)
  })
})

describe('local disk', () => {
  let dir = ''
  beforeAll(async () => { dir = await mkdtemp(path.join(tmpdir(), 'papa-store-')); process.env.STORAGE_DRIVER = 'local'; process.env.UPLOAD_DIR = dir })
  afterAll(async () => { await rm(dir, { recursive: true, force: true }); process.env.STORAGE_DRIVER = saved.driver; process.env.UPLOAD_DIR = saved.dir })
  it('stores, reads, sizes and streams (with ranges)', exercise)
})

describe('S3 (any S3-compatible store)', () => {
  let server: S3rver, dir = ''
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'papa-s3-'))
    server = new S3rver({ port: 0, address: '127.0.0.1', silent: true, directory: dir, configureBuckets: [{ name: 'papa-test', configs: [] }] })
    const { port } = await server.run()
    Object.assign(process.env, { STORAGE_DRIVER: 's3', S3_BUCKET: 'papa-test', S3_REGION: 'us-east-1', S3_ENDPOINT: `http://127.0.0.1:${port}`, S3_FORCE_PATH_STYLE: '1',
      S3_ACCESS_KEY_ID: 'S3RVER', S3_SECRET_ACCESS_KEY: 'S3RVER' })
    resetStorageClient()
  })
  afterAll(async () => {
    await server.close(); await rm(dir, { recursive: true, force: true })
    for (const k of ['S3_BUCKET', 'S3_REGION', 'S3_ENDPOINT', 'S3_FORCE_PATH_STYLE', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) delete process.env[k]
    process.env.STORAGE_DRIVER = saved.driver; resetStorageClient()
  })
  it('stores, reads, sizes and streams (with ranges)', exercise)
})
