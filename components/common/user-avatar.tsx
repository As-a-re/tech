import { cn } from '@/lib/utils'

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
}

/** Member photo with initials fallback. */
export function UserAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={cn('size-10 shrink-0 rounded-full bg-muted object-cover', className)} />
  ) : (
    <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary', className)}>{initials(name)}</span>
  )
}
