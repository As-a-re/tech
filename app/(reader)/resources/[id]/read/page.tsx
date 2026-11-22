import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/server/identity/session'
import { getResource } from '@/server/resources/resources'
import { PdfReader } from '@/components/library/pdf-reader'

export const metadata = { title: 'Study guide' }

export default async function ReadGuide({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await getResource(id, await getCurrentUser())
  if (!r || r.kind !== 'study_guide' || !r.access || !r.fileUrl) notFound()
  return <PdfReader id={r.id} url={r.fileUrl} title={r.title} startPage={1} preview={false} totalPages={r.pageCount} backHref={`/resources/${r.id}`} track={false} />
}
