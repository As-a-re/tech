/** Splits post text into plain text, @mentions, #hashtags and links. Shared by server (indexing) and client (rendering). */
export type Segment =
  | { type: 'text'; text: string }
  | { type: 'mention'; text: string; username: string }
  | { type: 'hashtag'; text: string; tag: string }
  | { type: 'url'; text: string; href: string }

const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]|www\.[^\s<]+[^\s<.,;:!?)\]'"])|(^|[^\w@])@([a-zA-Z0-9_]{3,20})\b|(^|[^\w#&])#([\p{L}\p{N}_]{2,50})/gu

export function segments(body: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of body.matchAll(TOKEN)) {
    const start = m.index!
    if (m[1]) {
      if (start > last) out.push({ type: 'text', text: body.slice(last, start) })
      out.push({ type: 'url', text: m[1], href: m[1].startsWith('www.') ? `https://${m[1]}` : m[1] })
      last = start + m[0].length
    } else if (m[3]) {
      const at = start + m[2].length
      if (at > last) out.push({ type: 'text', text: body.slice(last, at) })
      out.push({ type: 'mention', text: `@${m[3]}`, username: m[3] })
      last = at + 1 + m[3].length
    } else if (m[5]) {
      const at = start + m[4].length
      if (at > last) out.push({ type: 'text', text: body.slice(last, at) })
      out.push({ type: 'hashtag', text: `#${m[5]}`, tag: m[5].toLowerCase() })
      last = at + 1 + m[5].length
    }
  }
  if (last < body.length) out.push({ type: 'text', text: body.slice(last) })
  return out
}

export const extractHashtags = (body: string) => [...new Set(segments(body).flatMap((s) => (s.type === 'hashtag' ? [s.tag] : [])))].slice(0, 20)
export const extractMentions = (body: string) => [...new Set(segments(body).flatMap((s) => (s.type === 'mention' ? [s.username.toLowerCase()] : [])))].slice(0, 20)
export const firstUrl = (body: string) => segments(body).find((s): s is Extract<Segment, { type: 'url' }> => s.type === 'url')?.href ?? null

export const MAX_POST_LENGTH = 1000
