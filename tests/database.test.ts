import { afterAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { db, pool } from '@/db'

describe('database', () => {
  afterAll(() => pool.end())
  it('is reachable', async () => {
    const r = await db.execute(sql`select 1 as ok`)
    expect(r.rows[0]).toEqual({ ok: 1 })
  })
  it.each(['platform_settings', 'districts', 'assemblies', 'church_members', 'users', 'sessions', 'verification_codes', 'rate_limits', 'audit_log', 'user_preferences', 'backup_codes', 'follows', 'follow_requests', 'blocks', 'mutes', 'level_roles', 'posts', 'post_media', 'post_edits', 'polls', 'poll_options', 'poll_votes', 'likes', 'reposts', 'bookmarks', 'post_hashtags', 'post_mentions', 'favorites', 'pinned_posts', 'notifications', 'lists', 'reports', 'announcements', 'announcement_media', 'level_subscriptions', 'events', 'event_rsvps', 'assembly_profiles', 'prayer_requests', 'prayer_prayed', 'testimonies', 'testimony_media', 'testimony_praises', 'devotion_comments', 'daily_verses', 'job_runs'])(
    'has table %s', async (t) => {
      const r = await db.execute(sql`select to_regclass(${'public.' + t}) as t`)
      expect(r.rows[0].t).toBe(t)
    })
})
