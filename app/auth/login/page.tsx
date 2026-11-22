import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { AuthForm } from '@/components/auth-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() }); if (session?.user) redirect('/dashboard')
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12"><Card className="w-full max-w-md"><CardHeader><CardTitle>Welcome back</CardTitle><CardDescription>Sign in to your ministry workspace.</CardDescription></CardHeader><CardContent className="flex flex-col gap-5"><AuthForm mode="sign-in" /><p className="text-center text-sm text-muted-foreground">New here? <Link className="font-medium text-primary" href="/auth/register">Create an account</Link></p></CardContent></Card></main>
}
