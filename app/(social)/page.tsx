import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { following, forYou } from '@/server/posts/feeds'
import { Notice } from '@/components/common/notice'
import { Composer } from '@/components/posts/composer'
import { Feed } from '@/components/posts/feed'
import { SectionTabs } from '@/components/shell/section-tabs'
import { VerseCard } from '@/components/devotion/verse-card'
import { verseFor } from '@/server/devotion/verse'
import { liveNow } from '@/server/live/live'
import { LiveNowBar } from '@/components/live/live-card'

const TABS = ['for_you', 'following'] as const

export default async function HomePage({ searchParams }: { searchParams: Promise<{ notice?: string; tab?: string }> }) {
  const [t, me, sp, verse, lives] = await Promise.all([getT(), getCurrentUser(), searchParams, verseFor(), liveNow()])
  if (me && !me.onboarded) redirect('/welcome')
  if (sp.tab === 'favorites') redirect('/favorites')
  const tab = me && TABS.includes(sp.tab as never) ? (sp.tab as (typeof TABS)[number]) : 'for_you'
  const page = tab === 'following' ? await following(me!.id) : await forYou(me?.id ?? null)
  const empty = { for_you: t('feed.emptyForYou'), following: t('feed.emptyFollowing') }
  return (
    <>
      {sp.notice === 'password_reset' && <Notice message={t('home.notice_password_reset')} />}
      {sp.notice === 'account_deleted' && <Notice message={t('home.notice_account_deleted')} />}
      <SectionTabs active={tab} signedIn={!!me} />
      <LiveNowBar lives={lives} t={t} />
      {tab === 'for_you' && <VerseCard v={verse} hideable />}

      {me ? (
        <div className="border-b px-4 py-3"><Composer me={me} compact /></div>
      ) : (
        <section className="relative overflow-hidden border-b bg-hero px-6 py-10 text-white dark:border-brand-blue/40 sm:px-10">
          <div aria-hidden className="absolute -right-20 -top-24 size-80 rounded-full bg-white/5" />
          <div aria-hidden className="absolute -bottom-28 right-10 size-64 rounded-full bg-brand-red/25" />
          <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{t('home.eyebrow')}</p>
          <h2 className="relative mt-3 text-4xl font-extrabold leading-tight tracking-tight">{t('home.title')}</h2>
          <p className="relative mt-3 max-w-lg text-[17px] leading-relaxed text-white/85">{t('home.lead')}</p>
          <div className="relative mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-blue hover:bg-white/90 dark:bg-brand-blue dark:text-black">{t('home.joinCta')}</Link>
            <Link href="/login" className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">{t('auth.signIn')}</Link>
          </div>
        </section>
      )}

      <Feed initial={page} request={{ kind: tab }} empty={empty[tab]} />
    </>
  )
}
