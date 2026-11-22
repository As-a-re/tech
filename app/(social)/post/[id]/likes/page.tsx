import { EngagersPage } from '@/components/posts/engagers-page'
export const metadata = { title: 'Liked by' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <EngagersPage id={(await params).id} kind="likes" /> }
