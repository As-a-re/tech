import Link from 'next/link'
import { UserAvatar } from '@/components/common/user-avatar'
import { VerifiedBadge } from '@/components/common/verified-badge'

/** One member in a list (followers, search results…), with an optional action on the right. */
export function PersonRow({ username, fullName, avatarUrl, sub, bio, action, verified }: {
  username: string; fullName: string; avatarUrl: string | null; sub?: string; bio?: string | null; action?: React.ReactNode; verified?: boolean
}) {
  return (
    <div className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
      <Link href={`/u/${username}`} className="shrink-0"><UserAvatar name={fullName} src={avatarUrl} /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/u/${username}`} className="min-w-0">
            <span className="flex items-center gap-1 font-semibold"><span className="truncate hover:underline">{fullName}</span>{verified && <VerifiedBadge />}</span>
            <span className="block truncate text-sm text-muted-foreground">@{username}{sub ? ` · ${sub}` : ''}</span>
          </Link>
          {action}
        </div>
        {bio && <p className="mt-1 line-clamp-2 text-sm">{bio}</p>}
      </div>
    </div>
  )
}
