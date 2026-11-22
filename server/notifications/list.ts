import 'server-only'
import type { NotificationType } from './notify'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'


export type NotificationGroup = {
  key: string; type: NotificationType; postId: string | null; postBody: string | null; at: string; unread: boolean; total: number
  actors: { username: string; fullName: string; avatarUrl: string | null; verified: boolean }[]
  /** Announcement or event the notification is about (title shown under it). */
  target: { kind: 'announcement' | 'event' | 'prayer' | 'testimony' | 'publication' | 'live' | 'payment' | 'resource_order' | 'market_order' | 'product'; id: string; title: string; startsAt: string | null; status?: string | null } | null
}

/** Groups likes/reposts/follows ("Ama and 3 others liked your post"); everything else is one row each. Newest first. */
export async function listNotifications(userId: string, filter: 'all' | 'mentions', limit = 60): Promise<NotificationGroup[]> {
  type Row = {
    type: NotificationType; post_id: string | null; post_body: string | null; at: Date; unread: boolean; total: number; grp: string
    announcement_id: string | null; announcement_title: string | null; event_id: string | null; event_title: string | null; event_starts: Date | null
    prayer_id: string | null; prayer_body: string | null; testimony_id: string | null; testimony_title: string | null
    publication_id: string | null; publication_title: string | null
    live_id: string | null; live_title: string | null; payment_ref: string | null; payment_title: string | null; order_id: string | null; order_title: string | null
    market_order_id: string | null; market_order_title: string | null; market_order_status: string | null; product_id: string | null; product_title: string | null
    actors: { username: string; fullName: string; avatarUrl: string | null; verified: boolean }[] | null
  }
  const { data, error } = await createSupabaseAdminClient().rpc('papa_list_notifications', { p_user_id: userId, p_filter: filter, p_limit: limit })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Row[]
  return rows
    // an announcement or event that was removed takes its notification with it
    .filter((r) => (!r.announcement_id || r.announcement_title) && (!r.event_id || r.event_title) && (!r.prayer_id || r.prayer_body) && (!r.testimony_id || r.testimony_title) && (!r.publication_id || r.publication_title) && (!r.live_id || r.live_title) && (!r.market_order_id || r.market_order_title) && (!r.product_id || r.product_title))
    .map((r) => ({
      key: r.grp, type: r.type, postId: r.post_id, postBody: r.post_body, at: new Date(r.at).toISOString(), unread: r.unread, total: r.total, actors: r.actors ?? [],
      target: r.announcement_id ? { kind: 'announcement' as const, id: r.announcement_id, title: r.announcement_title!, startsAt: null }
        : r.event_id ? { kind: 'event' as const, id: r.event_id, title: r.event_title!, startsAt: r.event_starts ? new Date(r.event_starts).toISOString() : null }
          : r.prayer_id ? { kind: 'prayer' as const, id: r.prayer_id, title: r.prayer_body!, startsAt: null }
            : r.testimony_id ? { kind: 'testimony' as const, id: r.testimony_id, title: r.testimony_title!, startsAt: null }
              : r.publication_id ? { kind: 'publication' as const, id: r.publication_id, title: r.publication_title!, startsAt: null }
                : r.live_id ? { kind: 'live' as const, id: r.live_id, title: r.live_title!, startsAt: null }
                  : r.payment_ref ? { kind: 'payment' as const, id: r.payment_ref, title: r.payment_title ?? '', startsAt: null }
                    : r.order_id ? { kind: 'resource_order' as const, id: r.order_id, title: r.order_title ?? '', startsAt: null }
                      : r.market_order_id ? { kind: 'market_order' as const, id: r.market_order_id, title: r.market_order_title!, startsAt: null, status: r.market_order_status }
                        : r.product_id ? { kind: 'product' as const, id: r.product_id, title: r.product_title!, startsAt: null } : null,
    }))
}

export async function markAllRead(userId: string) {
  const { error } = await createSupabaseAdminClient().rpc('papa_mark_notifications_read', { p_user_id: userId })
  if (error) throw new Error(error.message)
}
