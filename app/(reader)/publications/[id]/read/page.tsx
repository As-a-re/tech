import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/server/identity/session'
import { getChapter, getPublication } from '@/server/library/publications'
import { PdfReader } from '@/components/library/pdf-reader'
import { ArticleReader } from '@/components/library/article-reader'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = await getPublication((await params).id, await getCurrentUser())
  return { title: p?.title ?? 'Read' }
}

export default async function Read({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ch?: string }> }) {
  const [{ id }, sp, me] = await Promise.all([params, searchParams, getCurrentUser()])
  const p = await getPublication(id, me)
  if (!p) notFound()
  if (p.format === 'pdf') {
    const url = p.access ? p.fileUrl : p.previewUrl
    if (!url) notFound()
    return <PdfReader id={p.id} url={url} title={p.title} startPage={p.access ? p.progress?.position ?? 1 : 1} preview={!p.access} totalPages={p.pageCount} />
  }
  const n = Math.min(Math.max(1, Number(sp.ch) || 1), Math.max(1, p.chapters.length))
  const r = await getChapter(id, n, me)
  const meta = p.chapters.find((c) => c.position === n)
  if (!r || !meta) notFound()
  return <ArticleReader id={p.id} title={p.title} chapter={n} total={p.chapters.length} heading={meta.title} body={r.chapter?.body ?? null} locked={meta.locked} preview={!p.access} />
}
