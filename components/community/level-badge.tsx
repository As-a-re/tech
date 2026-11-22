import Link from 'next/link'
import { Church, Globe2, MapPinned } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  level: 'national' | 'district' | 'local'
  label: string
  district?: { name: string; slug: string } | null
  assembly?: { name: string; slug: string } | null
  link?: 'announcements' | 'directory' | null
  className?: string
}

/** "National" (red) · district (blue) · assembly (blue) chip, linking to that level's page. */
export function LevelBadge({ level, label, district, assembly, link = 'announcements', className }: Props) {
  const Icon = level === 'national' ? Globe2 : level === 'district' ? MapPinned : Church
  const text = level === 'national' ? label : level === 'district' ? district?.name ?? label : assembly?.name ?? label
  const href = !link ? null : level === 'national' ? (link === 'announcements' ? '/announcements' : '/assemblies')
    : level === 'district' && district ? (link === 'announcements' ? `/announcements/d/${district.slug}` : `/districts/${district.slug}`)
      : assembly ? (link === 'announcements' ? `/announcements/a/${assembly.slug}` : `/assemblies/${assembly.slug}`) : null
  const cls = cn('inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
    level === 'national' ? 'bg-brand-red/10 text-brand-red' : 'bg-primary/10 text-primary', className)
  const inner = <><Icon className="size-3.5 shrink-0" /><span className="truncate">{text}</span></>
  return href ? <Link href={href} className={cn(cls, 'hover:underline')}>{inner}</Link> : <span className={cls}>{inner}</span>
}
