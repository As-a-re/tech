import { requireUser } from '@/server/identity/session'
import { listChats } from '@/server/messages/chat'
import { ChatList } from '@/components/messages/chat-list'

/** Chat list on the left (hidden on phones while a chat is open), the chat on the right. */
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser('/messages')
  const chats = await listChats(me.id)
  return (
    <div className="flex h-[calc(100dvh-4rem)]">
      <ChatList initial={chats} meId={me.id} />
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  )
}
