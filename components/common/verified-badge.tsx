import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Blue tick for accounts verified by the Tech Department. */
export function VerifiedBadge({ label, className }: { label?: string | null; className?: string }) {
  const text = label || 'Verified account'
  return <BadgeCheck aria-label={text} className={cn('inline size-[1.1em] shrink-0 fill-primary text-white', className)}><title>{text}</title></BadgeCheck>
}
