'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Field({ label, name, id, error, hint, className, ...props }: React.ComponentProps<'input'> & { label: string; name: string; error?: string; hint?: string }) {
  const fid = id ?? name
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={fid}>{label}</Label>
      <Input id={fid} name={name} aria-invalid={!!error} aria-describedby={error ? `${fid}-error` : hint ? `${fid}-hint` : undefined} className="h-11 text-[15px]" {...props} />
      {error ? <p id={`${fid}-error`} className="text-xs font-medium text-destructive">{error}</p>
        : hint ? <p id={`${fid}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function FormAlert({ message, tone = 'error' }: { message?: string; tone?: 'error' | 'info' }) {
  if (!message) return null
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-lg border px-3 py-2.5 text-sm',
      tone === 'error' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-primary/25 bg-primary/5 text-primary')}>{message}</p>
  )
}

export function SubmitButton({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: 'default' | 'outline' }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} disabled={pending} className={cn('h-11 w-full text-[15px]', className)}>
      {pending && <Loader2 className="animate-spin" />}{children}
    </Button>
  )
}
