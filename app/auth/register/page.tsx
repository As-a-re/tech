import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseUserServer } from '@/lib/supabase/server'
import { AuthForm } from '@/components/auth-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function RegisterPage() {
  const supabase = await supabaseUserServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12"><Card className="w-full max-w-md"><CardHeader><CardTitle>Create your workspace</CardTitle><CardDescription>Start building a connected ministry community.</CardDescription></CardHeader><CardContent className="flex flex-col gap-5"><AuthForm mode="sign-up" /><p className="text-center text-sm text-muted-foreground">Already have an account? <Link className="font-medium text-primary" href="/auth/login">Sign in</Link></p></CardContent></Card></main>
}
