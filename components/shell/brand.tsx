import Link from 'next/link'
import { cn } from '@/lib/utils'

/** PAPA wordmark with the church logo. */
export function Brand({ className, subtitle }: { className?: string; subtitle: string }) {
  return (
    <Link href="/" className={cn('flex shrink-0 items-center gap-2.5', className)} aria-label="PAPA home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={40} height={40} className="size-10 rounded-full bg-white" />
      <span className="leading-none">
        <span className="block text-[22px] font-extrabold tracking-tight text-primary">PAPA</span>
        <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-red min-[400px]:block">{subtitle}</span>
      </span>
    </Link>
  )
}
