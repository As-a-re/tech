import 'server-only'
import { z } from 'zod'
import { normalisePhone } from '@/lib/identity/normalise'
import type { ChurchDirectory } from './types'

/**
 * Client for the church's standard database API. Contract: docs/CHURCH_DB_API.md
 *   GET {CHURCH_DB_API_URL}/members/{churchId}   Authorization: Bearer {CHURCH_DB_API_KEY}
 *   GET {CHURCH_DB_API_URL}/members/changes?since=&cursor=   (background sync)
 */
const memberSchema = z.object({
  church_id: z.string(),
  full_name: z.string(),
  phone: z.string(),
  status: z.enum(['active', 'inactive']),
  date_of_birth: z.string().nullable().optional(),
  assembly: z.object({ id: z.union([z.string(), z.number()]), name: z.string(), town: z.string().nullable().optional() }),
  district: z.object({ id: z.union([z.string(), z.number()]), name: z.string() }),
})

export class ChurchApiError extends Error {}

const changesSchema = z.object({ members: z.array(memberSchema), next_cursor: z.string().nullable().optional(), until: z.string() })
const toMember = (m: z.infer<typeof memberSchema>) => ({
  churchId: m.church_id.trim().toUpperCase().replace(/\s+/g, ''), fullName: m.full_name.trim(), phone: normalisePhone(m.phone), active: m.status === 'active',
  dateOfBirth: m.date_of_birth ?? null,
  assembly: { externalId: String(m.assembly.id), name: m.assembly.name, town: m.assembly.town ?? null },
  district: { externalId: String(m.district.id), name: m.district.name },
})

export function apiDirectory(baseUrl: string, apiKey: string, timeoutMs = 8000): ChurchDirectory {
  return {
    async findMember(churchId) {
      let res: Response
      try {
        res = await fetch(`${baseUrl}/members/${encodeURIComponent(churchId)}`, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs), cache: 'no-store',
        })
      } catch (e) {
        throw new ChurchApiError(`Church database unreachable: ${(e as Error).message}`)
      }
      if (res.status === 404) return null
      if (!res.ok) throw new ChurchApiError(`Church database returned ${res.status}`)
      const parsed = memberSchema.safeParse(await res.json().catch(() => null))
      if (!parsed.success) throw new ChurchApiError('Church database sent an unexpected member format')
      return toMember(parsed.data)
    },
    async changes(since, cursor) {
      const q = new URLSearchParams({ since, ...(cursor ? { cursor } : {}) })
      let res: Response
      try {
        res = await fetch(`${baseUrl}/members/changes?${q}`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs * 2), cache: 'no-store' })
      } catch (e) { throw new ChurchApiError(`Church database unreachable: ${(e as Error).message}`) }
      if (!res.ok) throw new ChurchApiError(`Church database returned ${res.status}`)
      const parsed = changesSchema.safeParse(await res.json().catch(() => null))
      if (!parsed.success) throw new ChurchApiError('Church database sent an unexpected changes format')
      return { members: parsed.data.members.map(toMember), nextCursor: parsed.data.next_cursor ?? null, until: parsed.data.until }
    },
  }
}
