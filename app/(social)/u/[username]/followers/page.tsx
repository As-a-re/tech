import { PeoplePage } from '@/components/people/people-page'

export const metadata = { title: 'Followers' }
export default async function Followers({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ before?: string }> }) {
  return <PeoplePage username={(await params).username} kind="followers" before={(await searchParams).before} />
}
