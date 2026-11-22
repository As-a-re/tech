import { sql } from 'drizzle-orm'
import { date, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './identity'
import { assemblies, districts } from './church'
import { level } from './admin'

const ts = (n: string) => timestamp(n, { withTimezone: true })
const userRef = (n: string) => uuid(n).notNull().references(() => users.id, { onDelete: 'cascade' })
const districtRef = () => uuid('district_id').references(() => districts.id, { onDelete: 'cascade' })
const assemblyRef = () => uuid('assembly_id').references(() => assemblies.id, { onDelete: 'cascade' })

export const contentStatus = pgEnum('content_status', ['draft', 'scheduled', 'published'])

/* ───────── Publications (Batch 12) ───────── */
export const publicationKind = pgEnum('publication_kind', ['magazine', 'devotional', 'book', 'newsletter', 'bulletin', 'manual'])
/** pdf = an uploaded PDF read page by page; article = chapters written in PAPA. */
export const publicationFormat = pgEnum('publication_format', ['pdf', 'article'])

/** A run of issues, e.g. "Anointed Magazine" or "Daily Bread". Members follow a series to hear about new issues. */
export const publicationSeries = pgTable('publication_series', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  kind: publicationKind('kind').notNull(),
  coverUrl: text('cover_url'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('publication_series_slug_idx').on(t.slug)])

export const publications = pgTable('publications', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: publicationKind('kind').notNull(),
  format: publicationFormat('format').notNull(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  description: text('description').notNull().default(''),
  author: text('author'),
  seriesId: uuid('series_id').references(() => publicationSeries.id, { onDelete: 'set null' }),
  /** e.g. "Issue 12 · October 2026" */
  edition: text('edition'),
  language: text('language').default('en').notNull(),
  level: level('level').notNull(),
  districtId: districtRef(),
  assemblyId: assemblyRef(),
  coverUrl: text('cover_url'),
  /** Full PDF (private: served only to readers allowed to read it). */
  fileUrl: text('file_url'),
  /** The first pages, free for everyone (paid PDFs). */
  previewUrl: text('preview_url'),
  pageCount: integer('page_count'),
  previewPages: smallint('preview_pages').default(3).notNull(),
  /** Price in pesewas (GHS × 100); 0 = free. Buying switches on with Payments. */
  pricePesewas: integer('price_pesewas').default(0).notNull(),
  status: contentStatus('status').default('draft').notNull(),
  publishAt: ts('publish_at'),
  publishedAt: ts('published_at'),
  readCount: integer('read_count').default(0).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
  deletedAt: ts('deleted_at'),
}, (t) => [
  index('publications_list_idx').on(t.status, t.publishedAt).where(sql`${t.deletedAt} is null`),
  index('publications_series_idx').on(t.seriesId, t.publishedAt),
  index('publications_search_idx').using('gin', sql`to_tsvector('simple', ${t.title} || ' ' || coalesce(${t.subtitle}, '') || ' ' || ${t.description})`),
])

/** Chapters of an article-format publication. */
export const publicationChapters = pgTable('publication_chapters', {
  id: uuid('id').primaryKey().defaultRandom(),
  publicationId: uuid('publication_id').notNull().references(() => publications.id, { onDelete: 'cascade' }),
  position: smallint('position').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
}, (t) => [index('publication_chapters_idx').on(t.publicationId, t.position)])

export const seriesFollows = pgTable('series_follows', {
  userId: userRef('user_id'),
  seriesId: uuid('series_id').notNull().references(() => publicationSeries.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.seriesId] })])

/** "Continue where you stopped": page (PDF) or chapter (article). */
export const readingProgress = pgTable('reading_progress', {
  userId: userRef('user_id'),
  publicationId: uuid('publication_id').notNull().references(() => publications.id, { onDelete: 'cascade' }),
  position: integer('position').default(1).notNull(),
  percent: smallint('percent').default(0).notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.publicationId] }), index('reading_progress_user_idx').on(t.userId, t.updatedAt)])

/** My library (shown under Favorites on the profile). */
export const publicationSaves = pgTable('publication_saves', {
  userId: userRef('user_id'),
  publicationId: uuid('publication_id').notNull().references(() => publications.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.publicationId] })])

/* ───────── Children (Batch 12) ───────── */
export const kidsKind = pgEnum('kids_kind', ['story', 'quiz', 'song', 'video', 'colouring', 'memory_verse', 'lesson'])
/** all = for every age. Lessons are for Sunday school teachers (not shown in Kids mode). */
export const ageGroup = pgEnum('age_group', ['all', '0_4', '5_8', '9_12'])

export const kidsItems = pgTable('kids_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: kidsKind('kind').notNull(),
  ageGroup: ageGroup('age_group').default('all').notNull(),
  title: text('title').notNull(),
  summary: text('summary'),
  /** Story text, lesson notes, song words or the memory verse (paragraphs separated by blank lines). */
  body: text('body').notNull().default(''),
  bibleRef: text('bible_ref'),
  coverUrl: text('cover_url'),
  /** Read-aloud recording (stories); without one, the phone reads the story aloud. */
  audioUrl: text('audio_url'),
  /** Uploaded video, or a YouTube link. */
  videoUrl: text('video_url'),
  /** Colouring page (image or PDF) or lesson handout. */
  fileUrl: text('file_url'),
  /** Memory verse: the week it's for (Monday). */
  weekOf: date('week_of'),
  level: level('level').default('national').notNull(),
  districtId: districtRef(),
  assemblyId: assemblyRef(),
  status: contentStatus('status').default('published').notNull(),
  publishedAt: ts('published_at'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
  deletedAt: ts('deleted_at'),
}, (t) => [index('kids_items_list_idx').on(t.kind, t.publishedAt).where(sql`${t.deletedAt} is null`)])

export const kidsQuizQuestions = pgTable('kids_quiz_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull().references(() => kidsItems.id, { onDelete: 'cascade' }),
  position: smallint('position').notNull(),
  question: text('question').notNull(),
  options: jsonb('options').$type<string[]>().notNull(),
  answer: smallint('answer').notNull(),
  explain: text('explain'),
}, (t) => [index('kids_quiz_questions_idx').on(t.itemId, t.position)])

/** Best quiz score on this account (a parent's phone may be used by several children; the best is kept). */
export const kidsQuizResults = pgTable('kids_quiz_results', {
  userId: userRef('user_id'),
  itemId: uuid('item_id').notNull().references(() => kidsItems.id, { onDelete: 'cascade' }),
  score: smallint('score').notNull(),
  total: smallint('total').notNull(),
  stars: smallint('stars').notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.itemId] })])
