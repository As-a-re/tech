import { PeoplePage } from '@/components/people/people-page'

export const metadata = { title: 'Following' }
export default async function Following({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ before?: string }> }) {
  return <PeoplePage username={(await params).username} kind="following" before={(await searchParams).before} />
}
