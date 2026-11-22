'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/lib/i18n/client'
import type { PostView } from '@/lib/posts/types'
import { Composer } from './composer'
import { PostCard } from './post-card'

/** `text` pre-fills a new post (e.g. a birthday wish or a verse to share). */
type Open = { mode: 'post' | 'reply' | 'quote'; target?: PostView; text?: string }
type Me = { id: string; fullName: string; avatarUrl: string | null; role: string } | null
const Ctx = createContext<{ me: Me; openCompose: (o: Open) => void }>({ me: null, openCompose: () => {} })

/** Lets any button (sidebar Post, reply, quote) open the composer in a window. Guests are sent to sign in. */
export function ComposeProvider({ me, children }: { me: Me; children: React.ReactNode }) {
  const [state, setState] = useState<Open | null>(null)
  const router = useRouter()
  const { t } = useI18n()
  const openCompose = useCallback((o: Open) => { if (!me) router.push(`/login?next=${encodeURIComponent(location.pathname)}`); else setState(o) }, [me, router])
  return (
    <Ctx.Provider value={{ me, openCompose }}>
      {children}
      <Dialog open={!!state} onOpenChange={(o) => !o && setState(null)}>
        <DialogContent aria-describedby={undefined} className="top-[8%] max-h-[88dvh] translate-y-0 overflow-y-auto sm:max-w-xl">
          <DialogTitle className="sr-only">{state?.mode === 'reply' ? t('compose.reply') : t('compose.newPost')}</DialogTitle>
          {state?.mode === 'reply' && state.target && <div className="-mx-2 opacity-90"><PostCard post={state.target} variant="ancestor" /></div>}
          {me && state && <Composer me={me} mode={state.mode} target={state.target} initialText={state.text} autoFocus onDone={() => setState(null)} />}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}

export const useCompose = () => useContext(Ctx)
