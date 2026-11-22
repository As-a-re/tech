import 'server-only'
import { env } from '@/lib/env'
import { sendPush } from '@/integrations/push'
import { publish } from './realtime'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type StoredPrefs = Partial<Record<string, { inApp?: boolean; push?: boolean }>>

export type NotificationType = 'like'|'repost'|'reply'|'quote'|'mention'|'follow'|'follow_request'|'follow_accept'|'poll_ended'|'announcement'|'event'|'event_reminder'|'event_cancelled'|'prayed'|'prayer_comment'|'prayer_answered'|'testimony_praise'|'testimony_comment'|'birthday'|'message'|'call'|'publication'|'live'|'payment'|'resource_order'|'market_order'|'market_sale'|'market_question'|'market_review'|'market_alert'|'market_new'|'market_delivery'|'market_payout'|'market_rider'
export const NOTIFICATION_TYPES: NotificationType[] = ['like','repost','reply','quote','mention','follow','follow_request','follow_accept','poll_ended','announcement','event','event_reminder','event_cancelled','prayed','prayer_comment','prayer_answered','testimony_praise','testimony_comment','birthday','message','call','publication','live','payment','resource_order','market_order','market_sale','market_question','market_review','market_alert','market_new','market_delivery','market_payout','market_rider']

export async function getPrefs(userId: string) {
  const { data, error } = await createSupabaseAdminClient().from('notification_settings').select('prefs').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  const p = (data?.prefs as StoredPrefs | null) ?? {}
  return Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, { inApp: p[t]?.inApp ?? true, push: p[t]?.push ?? true }])) as Record<NotificationType, { inApp: boolean; push: boolean }>
}

export async function setPref(userId: string, type: NotificationType, channel: 'inApp' | 'push', on: boolean) {
  const prefs = await getPrefs(userId)
  prefs[type] = { ...prefs[type], [channel]: on }
  const { error } = await createSupabaseAdminClient().rpc('papa_set_notification_pref', { p_user_id: userId, p_prefs: prefs })
  if (error) throw new Error(error.message)
}

const TEXT: Record<NotificationType, (name: string) => string> = {
  like: (n) => `${n} liked your post`, repost: (n) => `${n} reposted your post`, reply: (n) => `${n} replied to you`,
  quote: (n) => `${n} quoted your post`, mention: (n) => `${n} mentioned you`, follow: (n) => `${n} followed you`,
  follow_request: (n) => `${n} asked to follow you`, follow_accept: (n) => `${n} accepted your follow request`, poll_ended: () => 'A poll you voted in has ended',
  announcement: (n) => `New announcement from ${n}`, event: (n) => `${n} added an event`, event_reminder: () => 'An event you are attending starts soon',
  event_cancelled: (n) => `${n} cancelled an event`,
  prayed: (n) => `${n} prayed for your request`, prayer_comment: (n) => `${n} encouraged you on your prayer request`,
  prayer_answered: (n) => `${n}: a prayer you prayed for has been answered`, testimony_praise: (n) => `${n} praised God for your testimony`,
  testimony_comment: (n) => `${n} commented on your testimony`, birthday: (n) => `It's ${n}'s birthday today 🎉`, message: (n) => `New message from ${n}`, call: (n) => `Call from ${n}`, publication: () => 'A new issue is out in a series you follow', live: (n) => `🔴 ${n} is live now`, payment: () => 'Thank you! Your gift was received 🙏🏾', resource_order: () => 'Your order is ready to collect',
  market_order: () => 'Your Market order has an update', market_sale: () => 'An order to your shop needs your attention', market_question: (n) => `New question or answer from ${n} on the Market`,
  market_review: (n) => `${n} reviewed your product`, market_alert: () => 'An item you are watching has changed', market_new: (n) => `New on the Market from ${n}`, market_delivery: () => 'A Market delivery needs you', market_payout: () => 'An update on your Market payout', market_rider: () => 'An update on your rider application',
}
export const pushText = (type: NotificationType, name: string) => TEXT[type](name)

export type NotifyRef = { announcementId?: string | null; eventId?: string | null; prayerId?: string | null; testimonyId?: string | null; publicationId?: string | null; liveId?: string | null; paymentId?: string | null; resourceOrderId?: string | null; marketOrderId?: string | null; productId?: string | null }

function targetUrl(postId: string | null, ref: NotifyRef) {
  return postId ? `${env.appUrl}/post/${postId}` : ref.eventId ? `${env.appUrl}/events/${ref.eventId}` : ref.announcementId ? `${env.appUrl}/announcements/${ref.announcementId}` : ref.prayerId ? `${env.appUrl}/prayer/${ref.prayerId}` : ref.testimonyId ? `${env.appUrl}/testimonies/${ref.testimonyId}` : ref.publicationId ? `${env.appUrl}/publications/${ref.publicationId}` : ref.liveId ? `${env.appUrl}/live/${ref.liveId}` : ref.paymentId ? `${env.appUrl}/give/history` : ref.resourceOrderId ? `${env.appUrl}/resources/orders` : ref.marketOrderId ? `${env.appUrl}/market/orders/${ref.marketOrderId}` : ref.productId ? `${env.appUrl}/market/p/${ref.productId}` : `${env.appUrl}/notifications`
}

type NotifyContext = { blocked: boolean; muted: boolean; prefs: StoredPrefs; actorName: string | null; subs: { id: string; endpoint: string; p256dh: string; auth: string }[] }

/** Supabase path: one RPC decides block/mute/prefs, a second persists (dedupe-aware), then realtime + push. */
async function notifySupabase(userId: string, type: NotificationType, actorId: string | null, postId: string | null, ref: NotifyRef) {
  const sb = createSupabaseAdminClient()
  const { data, error } = await sb.rpc('papa_notify_context', { p_user_id: userId, p_actor_id: actorId })
  if (error) throw new Error(error.message)
  const ctx = data as NotifyContext
  if (ctx.blocked || ctx.muted) return
  const prefs = { inApp: ctx.prefs[type]?.inApp ?? true, push: ctx.prefs[type]?.push ?? true }
  if (!prefs.inApp && !prefs.push) return
  if (prefs.inApp) {
    const { error: e } = await sb.rpc('papa_persist_notification', {
      p_user_id: userId, p_type: type, p_actor_id: actorId, p_post_id: postId,
      p_announcement_id: ref.announcementId ?? null, p_event_id: ref.eventId ?? null, p_prayer_id: ref.prayerId ?? null, p_testimony_id: ref.testimonyId ?? null,
      p_publication_id: ref.publicationId ?? null, p_live_id: ref.liveId ?? null, p_payment_id: ref.paymentId ?? null, p_resource_order_id: ref.resourceOrderId ?? null,
      p_market_order_id: ref.marketOrderId ?? null, p_product_id: ref.productId ?? null,
    })
    if (e) throw new Error(e.message)
    await publish({ userId, kind: 'notification' }).catch(() => {})
  }
  if (prefs.push && ctx.subs.length) {
    const url = targetUrl(postId, ref)
    const tag = `${type}:${postId ?? ref.eventId ?? ref.announcementId ?? ref.prayerId ?? ref.testimonyId ?? ref.publicationId ?? ref.liveId ?? ref.paymentId ?? ref.resourceOrderId ?? ref.marketOrderId ?? ref.productId ?? actorId}`
    for (const s of ctx.subs) {
      const r = await sendPush(s, { title: 'PAPA', body: TEXT[type](ctx.actorName ?? 'Someone'), url, tag })
      if (r === 'gone') await sb.from('push_subscriptions').delete().eq('id', s.id)
    }
  }
}

/**
 * Creates a notification (unless it's about yourself, the people are blocked, or the member turned it off),
 * updates their open screens live, and sends a phone push if they allowed it.
 */
export async function notify(userId: string, type: NotificationType, actorId: string | null, postId: string | null = null, ref: NotifyRef = {}) {
  if (actorId && actorId === userId) return
  return notifySupabase(userId, type, actorId, postId, ref)
}

/** Removes a notification when the action is undone (unlike, unfollow…). */
export async function unnotify(userId: string, type: NotificationType, actorId: string, postId: string | null = null, ref: NotifyRef = {}) {
  const { error } = await createSupabaseAdminClient().rpc('papa_unnotify', { p_user_id: userId, p_type: type, p_actor_id: actorId, p_post_id: postId, p_prayer_id: ref.prayerId ?? null, p_testimony_id: ref.testimonyId ?? null })
  if (error) throw new Error(error.message)
}

export async function unreadCount(userId: string) {
  const { data, error } = await createSupabaseAdminClient().rpc('papa_unread_notification_count', { p_user_id: userId })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}
