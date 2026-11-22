import { redirect } from 'next/navigation'
import { requireUser } from '@/server/identity/session'
import { kidsMode } from '@/lib/library/kids-server'
import { ExitKidsMode } from '@/components/kids/kids-mode-forms'

export const metadata = { title: 'Exit Kids mode' }

export default async function ExitPage() {
  await requireUser('/children/exit')
  if (!(await kidsMode())) redirect('/children')
  return <ExitKidsMode />
}
