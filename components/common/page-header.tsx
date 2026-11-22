import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: string; action?: React.ReactNode }) {
  return (
    <div className="sticky top-16 z-30 flex min-h-14 items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
      {back && <Link href={back} aria-label="Back" className="-ml-1 rounded-full p-1.5 hover:bg-muted"><ArrowLeft className="size-5" /></Link>}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold leading-tight">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
