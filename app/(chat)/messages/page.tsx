import { MessageCircle } from 'lucide-react'
import { getT } from '@/lib/i18n/server'

export const metadata = { title: 'Messages' }

/** Shown beside the chat list on larger screens until a chat is chosen. */
export default async function MessagesHome() {
  const t = await getT()
  return (
    <div className="flex h-full flex-col items-center max-md:hidden justify-center gap-3 px-8 text-center text-muted-foreground">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary"><MessageCircle className="size-8" /></span>
      <p className="text-lg font-bold text-foreground">{t('messages.pickTitle')}</p>
      <p className="max-w-sm text-sm">{t('messages.pickText')}</p>
    </div>
  )
}
