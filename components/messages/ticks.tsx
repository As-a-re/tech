import { Check, CheckCheck, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

/** One tick = sent, two grey = delivered, two blue = read. */
export function Ticks({ status, className }: { status: 'sending' | 'sent' | 'delivered' | 'read' | null; className?: string }) {
  if (!status) return null
  if (status === 'sending') return <Clock className={cn('size-3.5 opacity-70', className)} aria-label="Sending" />
  if (status === 'sent') return <Check className={cn('size-4 opacity-70', className)} aria-label="Sent" />
  return <CheckCheck className={cn('size-4', status === 'read' ? 'text-tick-read' : 'opacity-70', className)} aria-label={status === 'read' ? 'Read' : 'Delivered'} />
}
