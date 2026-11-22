import 'server-only'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { LinkPreview } from '@/lib/posts/types'

/** Blocks requests to private/internal addresses (server-side request forgery protection). */
export function isPrivateAddress(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase()
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.')
  }
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()

function meta(html: string, keys: string[]) {
  for (const k of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*>`, 'i')
    const tag = html.match(re)?.[0]
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1]
    if (content) return decode(content)
  }
  return undefined
}

/** Fetches title, description and image for a link. Best effort: returns null on any problem (4 s, 512 KB limit). */
export async function fetchLinkPreview(url: string, { allowPrivate = false } = {}): Promise<LinkPreview | null> {
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol)) return null
    if (!allowPrivate) {
      const addrs = await lookup(u.hostname, { all: true })
      if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) return null
    }
    const res = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'PAPA-LinkPreview/1.0', Accept: 'text/html' } })
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html') || !res.body) return null
    const reader = res.body.getReader()
    let html = ''
    const decoder = new TextDecoder()
    while (html.length < 512_000) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
      if (html.includes('</head>')) break
    }
    reader.cancel().catch(() => {})
    const title = meta(html, ['og:title', 'twitter:title']) ?? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '')
    if (!title) return null
    let image = meta(html, ['og:image', 'twitter:image'])
    if (image) { try { image = new URL(image, u).toString() } catch { image = undefined } }
    if (image && !image.startsWith('https://') && !allowPrivate) image = undefined
    return {
      url: u.toString(), title: title.slice(0, 200), description: meta(html, ['og:description', 'description', 'twitter:description'])?.slice(0, 300),
      image, site: meta(html, ['og:site_name']) ?? u.hostname.replace(/^www\./, ''),
    }
  } catch { return null }
}
