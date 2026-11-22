import 'server-only'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { Readable } from 'node:stream'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from '@/lib/env'

/**
 * Every upload goes through here (photos, video, voice notes, documents, PDFs).
 * STORAGE_DRIVER=local (default): files on disk under UPLOAD_DIR.
 * STORAGE_DRIVER=s3: an S3 bucket (AWS S3, or Cloudflare R2 / any S3-compatible store with S3_ENDPOINT).
 * Either way files are served at /media/<key> by app/media, which checks permissions for private files
 * (chats, paid publications, study guides), so the bucket itself stays private.
 */
export const uploadRoot = () => path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.uploadDir)

const TYPES: Record<string, { ext: string; kind: Kind }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image' }, 'image/png': { ext: 'png', kind: 'image' },
  'image/webp': { ext: 'webp', kind: 'image' }, 'image/gif': { ext: 'gif', kind: 'image' },
  'video/mp4': { ext: 'mp4', kind: 'video' }, 'video/webm': { ext: 'webm', kind: 'video' }, 'video/quicktime': { ext: 'mov', kind: 'video' },
  'audio/webm': { ext: 'weba', kind: 'audio' }, 'audio/ogg': { ext: 'ogg', kind: 'audio' }, 'audio/mpeg': { ext: 'mp3', kind: 'audio' }, 'audio/mp4': { ext: 'm4a', kind: 'audio' },
  'application/pdf': { ext: 'pdf', kind: 'document' },
}
export type Kind = 'image' | 'video' | 'audio' | 'document'
const MAX_MB: Record<Kind, number> = { image: 10, video: 200, audio: 30, document: 50 }
export const MIME_BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(TYPES).map(([m, t]) => [t.ext, m]))

export class UploadError extends Error {}
export type Saved = { url: string; kind: Kind; size: number; mime: string }

/* ───── Drivers ───── */
export const storageDriver = (): 'local' | 's3' => (process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local')

let client: S3Client | null = null
function s3() {
  // Keys are optional on AWS (an IAM role on the server is better); required for R2 and other stores
  client ??= new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === '1' } : {}),
    ...(process.env.S3_ACCESS_KEY_ID ? { credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '' } } : {}),
  })
  return client
}
const bucket = () => process.env.S3_BUCKET ?? ''
/** For tests: use a new client after changing the environment. */
export function resetStorageClient() { client = null }

/** "/media/posts/u/x.jpg" or "posts/u/x.jpg" → "posts/u/x.jpg" (refuses anything that climbs out). */
export function keyOf(urlOrKey: string) {
  const k = urlOrKey.replace(/^\/media\//, '').replace(/^\/+/, '')
  if (!k || k.split('/').some((p) => p === '..' || p === '.' || p === '')) throw new UploadError('bad_path')
  return k
}

/** Stores bytes under a key (e.g. "pubs-preview/abc.pdf") and returns its /media URL. */
export async function putBytes(key: string, bytes: Uint8Array, mime: string) {
  const k = keyOf(key)
  if (storageDriver() === 's3') {
    await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: k, Body: bytes, ContentType: mime, CacheControl: 'max-age=31536000, immutable' }))
  } else {
    const file = path.join(/*turbopackIgnore: true*/ uploadRoot(), k)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, bytes)
  }
  return `/media/${k}`
}

/** Reads a stored file whole (PDF processing). */
export async function readBytes(urlOrKey: string): Promise<Uint8Array> {
  const k = keyOf(urlOrKey)
  if (storageDriver() === 's3') {
    const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: k }))
    return r.Body!.transformToByteArray()
  }
  return readFile(path.join(/*turbopackIgnore: true*/ uploadRoot(), k))
}

/** Size of a stored file, or null if it doesn't exist. */
export async function sizeOf(urlOrKey: string): Promise<number | null> {
  let k: string
  try { k = keyOf(urlOrKey) } catch { return null }
  if (storageDriver() === 's3') {
    try { return (await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: k }))).ContentLength ?? null } catch { return null }
  }
  const info = await stat(path.join(/*turbopackIgnore: true*/ uploadRoot(), k)).catch(() => null)
  return info?.isFile() ? info.size : null
}

/** A stream of the file (or a byte range of it, for audio/video seeking). */
export async function openStream(urlOrKey: string, range?: { start: number; end: number }): Promise<ReadableStream> {
  const k = keyOf(urlOrKey)
  if (storageDriver() === 's3') {
    const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: k, ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}) }))
    return r.Body!.transformToWebStream()
  }
  return Readable.toWeb(createReadStream(path.join(/*turbopackIgnore: true*/ uploadRoot(), k), range ?? {})) as ReadableStream
}

/** Checks type and size, then stores an upload under folder/<random>.<ext>. */
export async function saveFile(file: File, folder: string, allow: Kind[]): Promise<Saved> {
  const mime = file.type.split(';')[0]
  const t = TYPES[mime]
  if (!t || !allow.includes(t.kind)) throw new UploadError('unsupported')
  if (file.size > MAX_MB[t.kind] * 1024 * 1024) throw new UploadError('too_large')
  const safe = folder.replace(/[^a-z0-9/_-]/gi, '').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
  const url = await putBytes(`${safe}/${randomUUID()}.${t.ext}`, Buffer.from(await file.arrayBuffer()), mime)
  return { url, kind: t.kind, size: file.size, mime }
}
