import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { allowedLevels } from '@/server/library/permissions'
import { publicationForEdit, seriesOptions } from '@/server/library/publications'
import { PageHeader } from '@/components/common/page-header'
import { PublicationForm } from '@/components/library/publication-form'

export const metadata = { title: 'Edit publication' }

export default async function EditPublication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [me, t] = await Promise.all([requireUser(`/publications/${id}/edit`), getT()])
  const p = await publicationForEdit(me, id)
  if (!p) notFound()
  const [levels, series] = await Promise.all([allowedLevels(me, 'publications_editor'), seriesOptions()])
  const pad = (n: number) => String(n).padStart(2, '0')
  const local = p.publishAt ? `${p.publishAt.getFullYear()}-${pad(p.publishAt.getMonth() + 1)}-${pad(p.publishAt.getDate())}T${pad(p.publishAt.getHours())}:${pad(p.publishAt.getMinutes())}` : null
  return (
    <>
      <PageHeader title={t('pubs.edit')} back={`/publications/${id}`} />
      <PublicationForm id={id} levels={levels.includes(p.level) ? levels : [p.level, ...levels]} series={series} initial={{
        kind: p.kind, format: p.format, title: p.title, subtitle: p.subtitle, description: p.description, author: p.author, seriesId: p.seriesId, newSeries: null,
        edition: p.edition, language: p.language, level: p.level, coverUrl: p.coverUrl, fileUrl: p.fileUrl, chapters: p.chapters.length ? p.chapters : [{ title: '', body: '' }],
        pricePesewas: p.pricePesewas, previewPages: p.previewPages, status: p.status, publishAt: local, scopeName: p.scopeName,
      }} />
    </>
  )
}
