import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { PDFDocument } from 'pdf-lib'
import { db, pool, schema } from '@/db'
import * as pubs from '@/server/library/publications'
import * as kids from '@/server/library/kids'
import { allowedLevels, hasMinistryRole } from '@/server/library/permissions'
import { grantLevelRole } from '@/server/admin/roles'
import { kidsAllowed } from '@/lib/library/kids-mode'
import { cleanup, makeUser } from './helpers'

type U = { id: string; username: string; role: 'member' | 'tech_admin' }
let editor: U, reader: U, teacher: U, admin: U
const ok = <T extends { ok: boolean }>(r: T) => { if (!r.ok) throw new Error(JSON.stringify(r)); return r as Extract<T, { ok: true }> }

async function pdf(owner: string, pages: number) {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage([200, 300]).drawText(`Page ${i + 1}`, { x: 20, y: 150 })
  const dir = path.resolve(process.env.UPLOAD_DIR || './uploads', 'pubs', owner)
  await mkdir(dir, { recursive: true })
  const name = `${randomUUID()}.pdf`
  await writeFile(path.join(dir, name), await doc.save())
  return `/media/pubs/${owner}/${name}`
}

beforeAll(async () => {
  await cleanup()
  const mk = async (n: number, u: string, role: U['role'] = 'member') => ({ ...(await makeUser(n, u)), role })
  editor = await mk(931, 'zz_ledit'); reader = await mk(932, 'zz_lread'); teacher = await mk(933, 'zz_lteach'); admin = await mk(934, 'zz_ladmin', 'tech_admin')
  await db.update(schema.users).set({ role: 'tech_admin' }).where(eq(schema.users.id, admin.id))
})
afterAll(async () => { await db.delete(schema.publicationSeries).where(sql`name like 'ZZ %'`); await cleanup(); await pool.end() })

describe('roles', () => {
  it('only editors (or Tech Admins) can publish, at their levels', async () => {
    expect(await hasMinistryRole(editor, 'publications_editor')).toBe(false)
    expect(await allowedLevels(editor, 'publications_editor')).toEqual([])
    const [m] = await db.select({ a: schema.users.assemblyId }).from(schema.users).where(eq(schema.users.id, editor.id))
    ok(await grantLevelRole(admin.id, editor.id, 'publications_editor', { level: 'local', assemblyId: m.a }))
    expect(await allowedLevels(editor, 'publications_editor')).toEqual(['local'])
    expect(await allowedLevels(admin, 'publications_editor')).toEqual(['national', 'district', 'local'])
    ok(await grantLevelRole(admin.id, teacher.id, 'childrens_ministry', { level: 'national' }))
    expect(await hasMinistryRole(teacher, 'childrens_ministry')).toBe(true)
  })
})

describe('publications', () => {
  let freeId: string, paidId: string, articleId: string
  it('checks input and the level', async () => {
    expect(await pubs.savePublication(reader, { kind: 'magazine', format: 'pdf', title: 'X', level: 'local', status: 'published' })).toEqual({ ok: false, error: 'not_allowed' })
    expect(await pubs.savePublication(editor, { kind: 'magazine', format: 'pdf', title: 'X', level: 'national', status: 'published' })).toEqual({ ok: false, error: 'not_allowed' })
    expect(await pubs.savePublication(editor, { kind: 'magazine', format: 'pdf', title: '', level: 'local', status: 'published' })).toEqual({ ok: false, error: 'title' })
    expect(await pubs.savePublication(editor, { kind: 'magazine', format: 'pdf', title: 'X', level: 'local', status: 'published' })).toEqual({ ok: false, error: 'file' })
  })

  it('publishes a free PDF with its page count; series followers are told', async () => {
    const first = ok(await pubs.savePublication(editor, { kind: 'magazine', format: 'pdf', title: 'ZZ Mag', newSeries: 'ZZ Mag Series', fileUrl: await pdf(editor.id, 5), level: 'local', status: 'published' }))
    const p1 = (await pubs.getPublication(first.id, reader))!
    expect(p1).toMatchObject({ pageCount: 5, access: true, status: 'published', pricePesewas: 0 })
    await pubs.setFollowSeries(reader.id, p1.seriesId!, true)
    const second = ok(await pubs.savePublication(editor, { kind: 'magazine', format: 'pdf', title: 'ZZ Mag', seriesId: p1.seriesId, edition: 'Issue 2', fileUrl: await pdf(editor.id, 3), level: 'local', status: 'published' }))
    freeId = second.id
    const n = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, reader.id))
    expect(n.some((x) => x.type === 'publication' && x.publicationId === second.id)).toBe(true)
    expect(await pubs.canReadPublicationFile(null, (await pubs.getPublication(freeId, reader))!.fileUrl!)).toBe(true)
    expect((await pubs.listSeries()).find((x) => x.name === 'ZZ Mag Series')).toMatchObject({ issues: 2 })
  })

  it('paid PDFs: preview pages for everyone, the full file only for those with access', async () => {
    const file = await pdf(editor.id, 10)
    paidId = ok(await pubs.savePublication(editor, { kind: 'book', format: 'pdf', title: 'ZZ Book', fileUrl: file, pricePesewas: 2500, previewPages: 2, level: 'local', status: 'published' })).id
    const asReader = (await pubs.getPublication(paidId, reader))!
    expect(asReader).toMatchObject({ access: false, fileUrl: null, pageCount: 10 })
    expect(asReader.previewUrl).toMatch(/^\/media\/pubs-preview\//)
    const preview = await PDFDocument.load(await (await import('node:fs/promises')).readFile(path.resolve(process.env.UPLOAD_DIR || './uploads', asReader.previewUrl!.replace('/media/', ''))))
    expect(preview.getPageCount()).toBe(2)
    expect(await pubs.canReadPublicationFile(reader, file)).toBe(false)
    expect(await pubs.canReadPublicationFile(editor, file)).toBe(true)
    expect(await pubs.canReadPublicationFile(admin, file)).toBe(true)
  })

  it('article publications lock chapters past the preview when paid', async () => {
    articleId = ok(await pubs.savePublication(editor, { kind: 'devotional', format: 'article', title: 'ZZ Devotional', level: 'local', status: 'published', pricePesewas: 500, previewPages: 1,
      chapters: [{ title: 'Day 1', body: 'Read Psalm 23.' }, { title: 'Day 2', body: 'Read Psalm 1.' }] })).id
    const p = (await pubs.getPublication(articleId, reader))!
    expect(p.chapters.map((c) => c.locked)).toEqual([false, true])
    expect((await pubs.getChapter(articleId, 1, reader))!.chapter!.body).toBe('Read Psalm 23.')
    expect((await pubs.getChapter(articleId, 2, reader))!.chapter).toBeNull()
    expect((await pubs.getChapter(articleId, 2, editor))!.chapter!.body).toBe('Read Psalm 1.')
  })

  it('drafts and scheduled items stay hidden until released', async () => {
    const draft = ok(await pubs.savePublication(editor, { kind: 'bulletin', format: 'article', title: 'ZZ Draft', level: 'local', status: 'draft', chapters: [{ title: 'A', body: 'B' }] })).id
    expect(await pubs.getPublication(draft, reader)).toBeNull()
    expect((await pubs.getPublication(draft, editor))!.status).toBe('draft')
    const soon = new Date(Date.now() + 3600_000).toISOString()
    const sched = ok(await pubs.savePublication(editor, { kind: 'bulletin', format: 'article', title: 'ZZ Later', level: 'local', status: 'scheduled', publishAt: soon, chapters: [{ title: 'A', body: 'B' }] })).id
    expect(await pubs.getPublication(sched, reader)).toBeNull()
    await db.update(schema.publications).set({ publishAt: sql`now() - interval '1 minute'` }).where(eq(schema.publications.id, sched))
    expect(await pubs.releaseScheduledPublications()).toBeGreaterThanOrEqual(1)
    expect((await pubs.getPublication(sched, reader))!.status).toBe('published')
  })

  it('library: progress, saved, search; others can’t edit; delete', async () => {
    await pubs.saveProgress(reader.id, freeId, 2, 66)
    await pubs.setSaved(reader.id, paidId, true)
    const lib = await pubs.myLibrary(reader.id)
    expect(lib.reading[0]).toMatchObject({ id: freeId, percent: 66 })
    expect(lib.saved.map((x) => x.id)).toContain(paidId)
    expect((await pubs.getPublication(freeId, reader))!.progress).toEqual({ position: 2, percent: 66 })
    expect((await pubs.listPublications({ q: 'ZZ Book' })).items.map((x) => x.id)).toContain(paidId)
    expect(await pubs.savePublication(reader, { kind: 'book', format: 'pdf', title: 'Mine', level: 'local', status: 'published' }, paidId)).toEqual({ ok: false, error: 'not_allowed' })
    expect(await pubs.deletePublication(reader, paidId)).toBe(false)
    expect(await pubs.deletePublication(editor, paidId)).toBe(true)
    expect(await pubs.getPublication(paidId, editor)).toBeNull()
  })
})

describe('kids', () => {
  let quizId: string
  it('only the Children’s ministry adds content; quizzes are checked', async () => {
    expect(await kids.saveKidsItem(reader, { kind: 'story', ageGroup: 'all', title: 'X', body: 'Y', level: 'national' })).toEqual({ ok: false, error: 'not_allowed' })
    expect(await kids.saveKidsItem(teacher, { kind: 'story', ageGroup: 'all', title: 'X', body: '', level: 'national' })).toEqual({ ok: false, error: 'body' })
    expect(await kids.saveKidsItem(teacher, { kind: 'quiz', ageGroup: 'all', title: 'Q', level: 'national', questions: [{ question: 'A?', options: ['x'], answer: 0 }] })).toEqual({ ok: false, error: 'questions' })
    expect(await kids.saveKidsItem(teacher, { kind: 'video', ageGroup: 'all', title: 'V', level: 'national', videoUrl: 'https://evil.example/v' })).toEqual({ ok: false, error: 'video' })
    ok(await kids.saveKidsItem(teacher, { kind: 'video', ageGroup: '5_8', title: 'ZZ Song', level: 'national', videoUrl: 'https://youtu.be/abcdefghijk' }))
    quizId = ok(await kids.saveKidsItem(teacher, { kind: 'quiz', ageGroup: 'all', title: 'ZZ Quiz', level: 'national', questions: [
      { question: 'Who built the ark?', options: ['Moses', 'Noah'], answer: 1 }, { question: 'Jonah was swallowed by?', options: ['A fish', 'A lion', 'A bear'], answer: 0 }, { question: '2+2?', options: ['4', '5'], answer: 0 }] })).id
    ok(await kids.saveKidsItem(teacher, { kind: 'lesson', ageGroup: '5_8', title: 'ZZ Lesson', body: 'Notes', level: 'national' }))
    expect(kids.youtubeId('https://www.youtube.com/watch?v=abcdefghijk&t=3')).toBe('abcdefghijk')
  })

  it('marks quizzes on the server and keeps the best stars', async () => {
    expect(await kids.submitQuiz(reader.id, quizId, [1, 1, 0])).toEqual({ score: 2, total: 3, stars: 1 })
    expect(await kids.submitQuiz(reader.id, quizId, [1, 0, 0])).toEqual({ score: 3, total: 3, stars: 3 })
    await kids.submitQuiz(reader.id, quizId, [0, 1, 1])
    expect((await kids.getKidsItem(quizId, reader))!.best).toEqual({ score: 3, total: 3, stars: 3 })
  })

  it('Kids mode hides teachers’ lessons and only allows the Kids section', async () => {
    const all = await kids.listKids({ userId: reader.id })
    expect(all.some((x) => x.title === 'ZZ Lesson')).toBe(true)
    const mode = await kids.listKids({ kidsMode: true, age: '5_8' })
    expect(mode.some((x) => x.title === 'ZZ Lesson')).toBe(false)
    expect(mode.some((x) => x.title === 'ZZ Song')).toBe(true)
    expect((await kids.listKids({ kidsMode: true, age: '0_4' })).some((x) => x.title === 'ZZ Song')).toBe(false)
    expect(kidsAllowed('/children/abc')).toBe(true)
    expect(kidsAllowed('/messages')).toBe(false)
    expect(kidsAllowed('/market')).toBe(false)
  })

  it('the parent PIN locks Kids mode', async () => {
    expect(await kids.setKidsPin(reader.id, '12a4')).toBe(false)
    expect(await kids.setKidsPin(reader.id, '2580')).toBe(true)
    expect(await kids.checkKidsPin(reader.id, '0000')).toBe(false)
    expect(await kids.checkKidsPin(reader.id, '2580')).toBe(true)
  })
})
