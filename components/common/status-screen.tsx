import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Full-page message (not found, error, offline, maintenance) in the PAPA style. */
export function StatusScreen({ icon, title, text, action, className }: {
  icon: React.ReactNode; title: string; text: string; action?: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-20 text-center', className)}>
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <h1 className="mt-5 text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function HomeButton({ label }: { label: string }) {
  return <Link href="/" className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">{label}</Link>
}
