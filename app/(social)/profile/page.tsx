import { redirect } from 'next/navigation'
import { requireUser } from '@/server/identity/session'

export default async function MyProfile() {
  const me = await requireUser('/profile')
  redirect(`/u/${me.username}`)
}
