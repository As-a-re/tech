/** A post as the screens receive it (plain data, safe to pass to client components). */
export type PostAuthor = { id: string; username: string; fullName: string; avatarUrl: string | null; verified: boolean; assemblyName: string }
export type PostMediaView = { id: string; kind: 'image' | 'video'; url: string; alt: string | null; width: number | null; height: number | null }
export type PollView = { endsAt: string; ended: boolean; total: number; myVote: string | null; options: { id: string; label: string; votes: number }[] }
export type LinkPreview = { url: string; title: string; description?: string; image?: string; site?: string }
export type LinkPreviewView = LinkPreview

export type PostView = {
  id: string
  author: PostAuthor
  body: string
  createdAt: string
  publishedAt: string
  editedAt: string | null
  deleted: boolean
  replyToId: string | null
  replyToUsername: string | null
  media: PostMediaView[]
  poll: PollView | null
  linkPreview: LinkPreviewView | null
  quote: PostView | null
  quoteUnavailable: boolean
  counts: { replies: number; likes: number; reposts: number; quotes: number; bookmarks: number; views: number }
  viewer: { liked: boolean; reposted: boolean; bookmarked: boolean; isAuthor: boolean; canReply: boolean; canEdit: boolean }
  pinned: boolean
  replySetting: 'everyone' | 'following' | 'mentioned'
}

/** One row in a feed: a post, optionally shown because someone reposted it. */
export type FeedItem = { key: string; post: PostView; repostedBy: { username: string; fullName: string } | null }
export type FeedPage = { items: FeedItem[]; next: string | null }

export const EDIT_WINDOW_MINUTES = 30
