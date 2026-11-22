import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/** A section that's planned but not built yet: says what it will do, and links home. */
export function ComingSoon({ icon: Icon, title, text, note, back }: { icon: LucideIcon; title: string; text: string; note: string; back: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="size-8" /></span>
      <h1 className="mt-5 text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">{text}</p>
      <p className="mt-4 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium">{note}</p>
      <Link href="/" className="mt-6 text-sm font-semibold text-primary hover:underline">{back}</Link>
    </div>
  )
}
