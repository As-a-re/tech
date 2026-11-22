'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const client = supabaseBrowser()
    const result = mode === 'sign-up'
      ? await client.auth.signUp({ email, password, options: { data: { name: String(data.get('name') ?? '').trim() }, emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback` } })
      : await client.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (result.error) { setError('Unable to authenticate with those details. Please try again.'); return }
    if (mode === 'sign-up' && !result.data.session) { router.push('/auth/register?confirmed=check-email'); return }
    router.push('/dashboard')
    router.refresh()
  }

  return <form onSubmit={submit} className="flex flex-col gap-4"><div className="flex flex-col gap-2">{mode === 'sign-up' && <><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></>}<Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div><div className="flex flex-col gap-2"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" minLength={8} required /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={loading}>{loading ? 'Working…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}</Button></form>
}
