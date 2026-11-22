import path from 'node:path'
import { keyOf, MIME_BY_EXT, openStream, sizeOf } from '@/integrations/storage'
import { canOpenChatFile } from '@/server/messages/access'
import { canReadPublicationFile } from '@/server/library/publications'
import { canReadResourceFile } from '@/server/resources/resources'
import { getCurrentUser } from '@/server/identity/session'

/** Serves uploaded files from disk or S3 (supports byte ranges so audio and video can seek). Private files are checked first. */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path
  let key: string
  try { key = keyOf(parts.join('/')) } catch { return new Response('Not found', { status: 404 }) }
  const url = `/media/${key}`
  // Chat files are private: only the sender and members of a chat where the file was sent may open them
  const isChat = parts[0] === 'chat'
  if (isChat) {
    const me = await getCurrentUser()
    if (!me || !(await canOpenChatFile(me.id, url))) return new Response('Not found', { status: 404 })
  }
  // Full publication PDFs: free ones for everyone, paid ones only for readers who have them (the preview pages are public)
  const isPub = parts[0] === 'pubs'
  if (isPub && !(await canReadPublicationFile(await getCurrentUser(), url))) return new Response('Not found', { status: 404 })
  // Study guides: free ones for members, paid ones for buyers
  const isRes = parts[0] === 'res'
  if (isRes && !(await canReadResourceFile(await getCurrentUser(), url))) return new Response('Not found', { status: 404 })
  const size = await sizeOf(key)
  if (size == null) return new Response('Not found', { status: 404 })
  const ext = path.extname(key).slice(1)
  const headers: Record<string, string> = {
    'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes', 'Cache-Control': isChat || isPub || isRes ? 'private, max-age=31536000, immutable' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
    ...(MIME_BY_EXT[ext] === 'application/pdf' || isChat ? { 'Content-Disposition': `inline; filename="${path.basename(key)}"` } : {}),
  }
  const range = req.headers.get('range')?.match(/bytes=(\d*)-(\d*)/)
  if (range) {
    const start = range[1] ? Number(range[1]) : 0
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    return new Response(await openStream(key, { start, end }), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } })
  }
  return new Response(await openStream(key), { headers: { ...headers, 'Content-Length': String(size) } })
}
