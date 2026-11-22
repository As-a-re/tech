import { notFound } from 'next/navigation'
import { requireUser } from '@/server/identity/session'
import { chatHeader, listMessages } from '@/server/messages/chat'
import { ChatView } from '@/components/messages/chat-view'

export const metadata = { title: 'Chat' }

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await requireUser(`/messages/${id}`)
  const header = await chatHeader(id, me.id)
  if (!header) notFound()
  const page = await listMessages(id, me.id)
  return (
    <div data-chat className="relative h-full">
      <ChatView key={id} header={header} initial={page?.items ?? []} hasMore={page?.hasMore ?? false} me={{ id: me.id, fullName: me.fullName, username: me.username, avatarUrl: me.avatarUrl }} />
    </div>
  )
}
