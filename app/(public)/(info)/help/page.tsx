import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { getSetting } from '@/server/admin/platform-settings'
import { PageHeader } from '@/components/common/page-header'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export const metadata = { title: 'Help & Support' }

const FAQ: [string, React.ReactNode][] = [
  ['How do I join PAPA?', <>Tap <Link href="/register">Join</Link>, enter your Church ID and the phone number the church has for you, type the 6-digit code we text you, then choose a username and password.</>],
  ['What is my Church ID, and where do I find it?', <>Your Church ID is your membership number in the church register. If you don&apos;t know it, ask the secretary of your local assembly.</>],
  ['It says my Church ID and phone don’t match.', <>PAPA checks both against the church register. If your phone number has changed, ask your local assembly to update your record, then try again.</>],
  ['I didn’t receive the SMS code.', <>Wait a minute and check your messages. Then use &ldquo;Send a new code&rdquo;. Make sure the number is a Ghana mobile number that can receive SMS. For your security, codes expire after 10 minutes.</>],
  ['I forgot my password.', <>Use <Link href="/forgot-password">Forgot password</Link> on the sign-in page. We&apos;ll text a code to the phone on your account so you can choose a new password. You will be signed out everywhere else.</>],
  ['Can I sign in with my phone number?', <>Yes. You can sign in with your Church ID, your username, or your phone number, together with your password.</>],
  ['How do I change the language or dark mode?', <>Use the sliders button at the top of the screen. Your language choice is saved on your account.</>],
  ['Can I install PAPA on my phone?', <>Yes. Open PAPA in your phone&apos;s browser and choose &ldquo;Add to Home screen&rdquo; (Android: menu ⋮; iPhone: Share button). It then opens like an app.</>],
]

export default async function HelpPage() {
  const [t, support] = await Promise.all([getT(), getSetting('support')])
  return (
    <>
      <PageHeader title={t('info.help')} />
      <div className="px-5 py-6 sm:px-8">
        <h2 className="text-lg font-bold">Frequently asked questions</h2>
        <Accordion type="single" collapsible className="mt-3">
          {FAQ.map(([q, a], i) => (
            <AccordionItem key={i} value={String(i)}>
              <AccordionTrigger className="text-left text-[15px]">{q}</AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <h2 className="mt-8 text-lg font-bold">Contact us</h2>
        {support.email || support.phone ? (
          <ul className="mt-3 space-y-2 text-[15px]">
            {support.email && <li><a className="inline-flex items-center gap-2 text-primary hover:underline" href={`mailto:${support.email}`}><Mail className="size-4" />{support.email}</a></li>}
            {support.phone && <li><a className="inline-flex items-center gap-2 text-primary hover:underline" href={`tel:${support.phone.replace(/\s/g, '')}`}><Phone className="size-4" />{support.phone}</a></li>}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-muted-foreground">Contact the secretary of your local assembly, who will pass your question to the church&apos;s Tech Department.</p>
        )}
      </div>
    </>
  )
}
