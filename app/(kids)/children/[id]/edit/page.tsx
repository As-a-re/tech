import { notFound } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { allowedLevels } from '@/server/library/permissions'
import { getKidsItem } from '@/server/library/kids'
import { PageHeader } from '@/components/common/page-header'
import { KidsForm } from '@/components/kids/kids-form'

export const metadata = { title: 'Edit kids content' }

export default async function EditKids({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [me, t] = await Promise.all([requireUser(`/children/${id}/edit`), getT()])
  const it = await getKidsItem(id, me)
  if (!it || !it.canEdit) notFound()
  const levels = await allowedLevels(me, 'childrens_ministry')
  return (
    <>
      <PageHeader title={t('kids.edit')} back={`/children/${id}`} />
      <KidsForm id={id} levels={levels.includes(it.level) ? levels : [it.level, ...levels]} initial={{
        kind: it.kind, ageGroup: it.ageGroup, title: it.title, summary: it.summary, body: it.body, bibleRef: it.bibleRef, coverUrl: it.coverUrl, audioUrl: it.audioUrl,
        videoUrl: it.videoUrl, fileUrl: it.fileUrl, weekOf: it.weekOf, level: it.level,
        questions: it.questions.length ? it.questions.map((q) => ({ ...q, explain: q.explain ?? '' })) : [{ question: '', options: ['', ''], answer: 0 }],
      }} />
    </>
  )
}
