import { getCurrentUser } from '@/server/identity/session'
import { unreadCount } from '@/server/notifications/notify'
import { unreadAnnouncements } from '@/server/community/announcements'
import { unreadChats } from '@/server/messages/chat'
import { newMissedCalls } from '@/server/calls/calls'
import { cartCount } from '@/server/market/cart'

export const dynamic = 'force-dynamic'

/** Badge numbers for the top bar: notifications, announcements, chats, missed calls and the cart. */
export async function GET() {
  const me = await getCurrentUser()
  if (!me) return Response.json({ notifications: 0, announcements: 0, chats: 0, calls: 0, cart: 0 })
  const [notifications, announcements, chats, calls, cart] = await Promise.all([unreadCount(me.id), unreadAnnouncements(me.id), unreadChats(me.id), newMissedCalls(me.id), cartCount(me.id)])
  // The Messages badge counts unread chats plus missed calls not yet seen
  return Response.json({ notifications, announcements, chats: chats + calls, calls, cart }, { headers: { 'Cache-Control': 'no-store' } })
}
