import Link from 'next/link'
import { segments } from '@/lib/posts/rich-text'

/** Post text with @mentions, #hashtags and links made clickable. */
export function RichText({ body, className }: { body: string; className?: string }) {
  return (
    <p className={className ?? 'whitespace-pre-wrap break-words text-[15px] leading-relaxed'}>
      {segments(body).map((s, i) =>
        s.type === 'text' ? <span key={i}>{s.text}</span>
          : s.type === 'mention' ? <Link key={i} href={`/u/${s.username}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{s.text}</Link>
            : s.type === 'hashtag' ? <Link key={i} href={`/hashtag/${encodeURIComponent(s.tag)}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{s.text}</Link>
              : <a key={i} href={s.href} target="_blank" rel="noopener noreferrer nofollow ugc" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{s.text.replace(/^https?:\/\//, '').slice(0, 48)}{s.text.length > 56 ? '…' : ''}</a>)}
    </p>
  )
}
