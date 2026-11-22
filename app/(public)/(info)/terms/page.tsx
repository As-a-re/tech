import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { PageHeader } from '@/components/common/page-header'
import { Prose } from '@/components/common/prose'

export const metadata = { title: 'Terms of Use' }
const UPDATED = '26 October 2026'

export default async function TermsPage() {
  const t = await getT()
  return (
    <>
      <PageHeader title={t('info.terms')} subtitle={t('info.updated', { date: UPDATED })} />
      <Prose>
        <p>These terms apply to everyone who uses PAPA, the app of Christ Anointed Church Ghana (&ldquo;the Church&rdquo;, &ldquo;we&rdquo;). By creating an account or using PAPA you agree to them.</p>
        <h2>1. Who can join</h2>
        <ul>
          <li>Accounts are for members listed in the Church&apos;s register, confirmed by Church ID and a code sent to the registered phone.</li>
          <li>One account per member. Keep your password private; you are responsible for activity on your account.</li>
          <li>Members under 18 should use PAPA with the guidance of a parent or guardian.</li>
        </ul>
        <h2>2. How we expect members to behave</h2>
        <p>PAPA is a church community. Treat others with love and respect (Galatians 5:13–14). You must not post or send content that:</p>
        <ul>
          <li>is false, misleading, defamatory, hateful, violent, sexually explicit, or harassing;</li>
          <li>impersonates another person, assembly or church office;</li>
          <li>infringes anyone&apos;s copyright or privacy, including sharing others&apos; personal details without permission;</li>
          <li>is spam, a scam, or advertising outside the Market;</li>
          <li>breaks the laws of Ghana.</li>
        </ul>
        <h2>3. Your content</h2>
        <p>You own what you post. You allow the Church to show it within PAPA to the audience you choose, and to keep copies needed to run the service. You can delete your content at any time.</p>
        <h2>4. Announcements and live services</h2>
        <p>Members may post announcements and go live at National, District or Local level. Use these for genuine church matters. The Tech Department may remove content or end a live session that breaks these terms.</p>
        <h2>5. Giving and the Market</h2>
        <p>Payments are processed by licensed payment providers. Offerings and tithes are given to the level you choose. Market sales are between members; the Church holds the buyer&apos;s payment until delivery is confirmed and may charge a small service fee shown before you pay. Detailed giving and market rules are shown where you pay.</p>
        <h2>6. Reporting and enforcement</h2>
        <p>Use &ldquo;Report&rdquo; to tell us about content that breaks these terms. We may remove content, limit features, or suspend accounts that break them. Serious matters may be referred to church leadership or the authorities.</p>
        <h2>7. Availability</h2>
        <p>We work to keep PAPA running and secure but cannot promise it will always be available or error-free. Features may change as PAPA grows.</p>
        <h2>8. Leaving PAPA</h2>
        <p>You can stop using PAPA and ask for your account to be deleted at any time. Membership of the Church itself is not affected.</p>
        <h2>9. Changes</h2>
        <p>We may update these terms. We will tell members about important changes in the app. The date at the top shows the latest version.</p>
        <p>See also our <Link href="/privacy">Privacy Policy</Link>.</p>
      </Prose>
    </>
  )
}
