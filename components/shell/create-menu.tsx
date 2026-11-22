'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { CREATE, isBuilt } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { useCompose } from '@/components/posts/compose-provider'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/** Everything a member can add. Built items go straight to their form; later ones show "Coming soon". */
function CreateList({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const { openCompose } = useCompose()
  return (
    <ul className="grid gap-1 sm:grid-cols-2">
      {CREATE.map(({ key, label, hint, icon: Icon, batch, href, compose, accent }) => {
        const ready = isBuilt(batch)
        const inner = (
          <>
            <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', ready ? (accent === 'red' ? 'bg-brand-red/10 text-brand-red' : 'bg-primary/10 text-primary') : 'bg-muted text-muted-foreground')}><Icon className="size-5" /></span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[15px] font-semibold">{t(label)}</span>
              <span className="block truncate text-xs text-muted-foreground">{ready ? t(hint) : t('create.soon')}</span>
            </span>
          </>
        )
        const cls = 'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5'
        return (
          <li key={key}>
            {!ready ? <div aria-disabled className={cn(cls, 'opacity-55')}>{inner}</div>
              : compose ? <button type="button" className={cn(cls, 'hover:bg-muted')} onClick={() => { onDone(); openCompose({ mode: 'post' }) }}>{inner}</button>
                : <Link href={href!} onClick={onDone} className={cn(cls, 'hover:bg-muted')}>{inner}</Link>}
          </li>
        )
      })}
    </ul>
  )
}

/** Phone: the "Add" tab in the bottom bar opens a sheet from the bottom. */
export function AddTab({ signedIn, className }: { signedIn: boolean; className?: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => (signedIn ? setOpen(true) : router.push('/login'))} aria-label={t('nav.add')} className={className}>
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"><Plus className="size-5" strokeWidth={2.6} /></span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="px-2"><SheetTitle>{t('create.title')}</SheetTitle></SheetHeader>
          <CreateList onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}

/** Tablet and computer: the big "Add" button in the left column. */
export function AddButton({ compact }: { compact?: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t('nav.add')}
        className={cn('mt-3 flex items-center justify-center gap-2 rounded-full bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90', compact ? 'size-12' : 'size-12 lg:h-auto lg:w-full lg:py-3 lg:text-[15px]')}>
        <Plus className="size-5" strokeWidth={2.6} /><span className={compact ? 'sr-only' : 'hidden lg:inline'}>{t('nav.add')}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{t('create.title')}</DialogTitle><DialogDescription className="sr-only">{t('create.title')}</DialogDescription></DialogHeader>
          <CreateList onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
