import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { PageHeader } from '@/components/common/page-header'
import { Prose } from '@/components/common/prose'

export const metadata = { title: 'Privacy Policy' }
const UPDATED = '26 October 2026'

export default async function PrivacyPage() {
  const t = await getT()
  return (
    <>
      <PageHeader title={t('info.privacy')} subtitle={t('info.updated', { date: UPDATED })} />
      <Prose>
        <p>Christ Anointed Church Ghana is responsible for the personal data used in PAPA. We handle it in line with Ghana&apos;s Data Protection Act, 2012 (Act 843).</p>
        <h2>What we use</h2>
        <ul>
          <li><b>From the church register:</b> your Church ID, full name, phone number, local assembly and district, and date of birth where the register holds it.</li>
          <li><b>What you add:</b> username, password (stored only in scrambled, irreversible form), photo, bio, email if you give it, and what you post, send or upload.</li>
          <li><b>Technical information:</b> the devices you sign in on, IP address, and sign-in times, used to keep your account secure.</li>
        </ul>
        <h2>Why we use it</h2>
        <ul>
          <li>To confirm you are a member and keep your account secure (for example, SMS codes).</li>
          <li>To show you what concerns your assembly, district and the whole church.</li>
          <li>To run the features you use: posts, messages, groups, live services, giving and the Market.</li>
          <li>To prevent abuse and keep a record of important security and admin actions.</li>
        </ul>
        <h2>Who can see it</h2>
        <ul>
          <li>Your name, username, photo, bio and assembly are shown on your profile to other members. Guests may see public posts and profiles.</li>
          <li>Your phone number, Church ID and email are not shown to other members.</li>
          <li>Private messages are visible only to the people in the conversation.</li>
        </ul>
        <h2>Who we share it with</h2>
        <p>We do not sell personal data. We share only what is needed with services that help run PAPA: an SMS provider (to send codes), payment providers (when you pay), and our hosting and storage providers. They may use the data only to provide those services.</p>
        <h2>How long we keep it</h2>
        <p>We keep your data while you have an account. When you delete your account we remove your profile and content, except records we must keep for security, financial or legal reasons.</p>
        <h2>Your rights</h2>
        <p>Under Act 843 you can ask to see the data we hold about you, correct it, or have it deleted, and you can object to how it is used. Details held in the church register are corrected through your local assembly.</p>
        <h2>Security</h2>
        <p>We protect data with encrypted connections, scrambled passwords, verification codes, limits on repeated attempts, and access only for authorised Tech Department staff.</p>
        <h2>Contact</h2>
        <p>For privacy questions or requests, see <Link href="/help">Help &amp; Support</Link>.</p>
      </Prose>
    </>
  )
}
