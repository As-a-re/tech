import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { users } from './identity'
import type { LinkPreview } from '@/lib/posts/types'
export type { LinkPreview } from '@/lib/posts/types'

const ts = (n: string) => timestamp(n, { withTimezone: true })
const userRef = (n: string) => uuid(n).notNull().references(() => users.id, { onDelete: 'cascade' })

export const replySetting = pgEnum('reply_setting', ['everyone', 'following', 'mentioned'])
export const mediaKind = pgEnum('media_kind', ['image', 'video'])


/**
 * Posts, replies and quotes. Visibility rule everywhere:
 *   published_at <= now()  AND  deleted_at IS NULL
 * Drafts have published_at = NULL; scheduled posts have published_at in the future.
 */
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: userRef('author_id'),
  body: text('body').notNull().default(''),
  replyToId: uuid('reply_to_id').references((): AnyPgColumn => posts.id, { onDelete: 'set null' }),
  rootId: uuid('root_id').references((): AnyPgColumn => posts.id, { onDelete: 'set null' }),
  quoteOfId: uuid('quote_of_id').references((): AnyPgColumn => posts.id, { onDelete: 'set null' }),
  replySetting: replySetting('reply_setting').default('everyone').notNull(),
  linkPreview: jsonb('link_preview').$type<LinkPreview>(),
  isDraft: boolean('is_draft').default(false).notNull(),
  publishedAt: ts('published_at'),
  editedAt: ts('edited_at'),
  deletedAt: ts('deleted_at'),
  replyCount: integer('reply_count').default(0).notNull(),
  likeCount: integer('like_count').default(0).notNull(),
  repostCount: integer('repost_count').default(0).notNull(),
  quoteCount: integer('quote_count').default(0).notNull(),
  bookmarkCount: integer('bookmark_count').default(0).notNull(),
  viewCount: integer('view_count').default(0).notNull(),
  /** Set once replies/quotes/mentions have been notified (scheduled posts are picked up by the job runner). */
  notifiedAt: ts('notified_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [
  index('posts_author_pub_idx').on(t.authorId, t.publishedAt),
  index('posts_pub_idx').on(t.publishedAt).where(sql`${t.deletedAt} is null and ${t.replyToId} is null`),
  index('posts_reply_to_idx').on(t.replyToId),
  index('posts_quote_idx').on(t.quoteOfId),
  index('posts_body_search_idx').using('gin', sql`to_tsvector('simple', ${t.body})`),
])

export const postMedia = pgTable('post_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  kind: mediaKind('kind').notNull(),
  url: text('url').notNull(),
  alt: text('alt'),
  width: integer('width'),
  height: integer('height'),
  position: smallint('position').notNull(),
}, (t) => [index('post_media_post_idx').on(t.postId)])

/** Earlier versions of edited posts (shown as "Edited"). */
export const postEdits = pgTable('post_edits', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  editedAt: ts('edited_at').defaultNow().notNull(),
})

export const polls = pgTable('polls', {
  postId: uuid('post_id').primaryKey().references(() => posts.id, { onDelete: 'cascade' }),
  endsAt: ts('ends_at').notNull(),
})
export const pollOptions = pgTable('poll_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => polls.postId, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  position: smallint('position').notNull(),
  votes: integer('votes').default(0).notNull(),
}, (t) => [index('poll_options_post_idx').on(t.postId)])
export const pollVotes = pgTable('poll_votes', {
  postId: uuid('post_id').notNull().references(() => polls.postId, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
  optionId: uuid('option_id').notNull().references(() => pollOptions.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.postId, t.userId] })])

const reaction = (name: string) => pgTable(name, {
  userId: userRef('user_id'),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.postId] }), index(`${name}_post_idx`).on(t.postId)])

export const likes = reaction('likes')
export const reposts = reaction('reposts')
export const bookmarks = pgTable('bookmarks', {
  userId: userRef('user_id'),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  /** Optional folder (Saved → folders); references bookmark_folders.id, cleared if the folder is deleted. */
  folderId: uuid('folder_id'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.postId] }), index('bookmarks_post_idx').on(t.postId)])

export const postHashtags = pgTable('post_hashtags', {
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull(),
}, (t) => [primaryKey({ columns: [t.postId, t.tag] }), index('post_hashtags_tag_idx').on(t.tag)])

export const postMentions = pgTable('post_mentions', {
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: userRef('user_id'),
}, (t) => [primaryKey({ columns: [t.postId, t.userId] }), index('post_mentions_user_idx').on(t.userId)])

/** People whose posts appear in your Favorites feed. */
export const favorites = pgTable('favorites', {
  userId: userRef('user_id'),
  favoriteId: userRef('favorite_id'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.favoriteId] })])

/** Pinned post on a member's profile. */
export const pinnedPosts = pgTable('pinned_posts', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
})
