import Link from 'next/link'
import { Compass } from 'lucide-react'

/**
 * The top-bar search box. Tapping anywhere on it (the box or the Explore icon) opens Explore
 * with the search ready to type, so members discover Explore whichever part they tap.
 */
export function SearchPill({ placeholder, exploreLabel, className }: { placeholder: string; exploreLabel: string; className?: string }) {
  return (
    <Link href="/explore?focus=1" role="search" aria-label={`${exploreLabel} · ${placeholder}`}
      className={`flex h-10 items-center gap-2 rounded-full border bg-muted/60 pl-2.5 pr-3 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted ${className ?? ''}`}>
      <Compass className="size-[18px] shrink-0 text-primary" />
      <span className="truncate">{placeholder}</span>
    </Link>
  )
}
