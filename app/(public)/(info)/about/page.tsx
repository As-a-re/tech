import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { PageHeader } from '@/components/common/page-header'
import { Prose } from '@/components/common/prose'

export const metadata = { title: 'About PAPA' }

export default async function AboutPage() {
  const t = await getT()
  return (
    <>
      <PageHeader title={t('info.about')} />
      <div className="flex flex-col items-center border-b bg-hero px-6 py-10 text-center text-white dark:border-brand-blue/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Christ Anointed Church Ghana logo" width={88} height={88} className="size-22 rounded-full bg-white ring-4 ring-white/20" />
        <p className="mt-4 text-3xl font-extrabold tracking-tight">PAPA</p>
        <p className="mt-1 text-sm text-white/75">{t('app.church')} · {t('app.country')}</p>
      </div>
      <Prose>
        <p><b>PAPA</b> is the official app of Christ Anointed Church Ghana. It is named after the founder of the church, known to members as Papa.</p>
        <p>PAPA brings every member, local assembly and district into one place: to follow church news, talk and pray together, take part in services wherever you are, give, read and share the church&apos;s publications, and buy and sell among members.</p>
        <h2>Built around the church</h2>
        <p>Everything in PAPA follows the church&apos;s structure: <b>National</b>, <b>District</b> and <b>Local assembly</b>. Announcements, live services, giving and resources are always for a level, so members see what concerns them.</p>
        <h2>Members only</h2>
        <p>Anyone can look around as a guest. To post, message, give or trade, you join with your <b>Church ID</b>, confirmed by a code sent to the phone number on the church register.</p>
        <h2>Who builds PAPA</h2>
        <p>PAPA is built and run by the Tech Department of Christ Anointed Church Ghana. Questions or ideas? See <Link href="/help">Help &amp; Support</Link>.</p>
      </Prose>
    </>
  )
}
