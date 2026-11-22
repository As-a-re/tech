import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/inter'
import './globals.css'
import { cookies } from 'next/headers'
import { getLocale } from '@/lib/i18n/server'
import { DISPLAY_COOKIES, isTextSize } from '@/lib/display'
import { Providers } from '@/components/providers/providers'
import { CallProvider } from '@/components/calls/call-provider'
import { getCurrentUser } from '@/server/identity/session'
import { livekitEnabled } from '@/integrations/livekit'
import { KIDS_COOKIE } from '@/lib/library/kids-mode'

export const metadata: Metadata = {
  title: { default: 'PAPA · Christ Anointed Church', template: '%s · PAPA' },
  description: 'PAPA is the app of Christ Anointed Church Ghana: announcements, groups, live services, giving, publications and the members’ market.',
  applicationName: 'PAPA',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.png', apple: '/apple-icon.png' },
  appleWebApp: { capable: true, title: 'PAPA', statusBarStyle: 'default' },
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  openGraph: { siteName: 'PAPA · Christ Anointed Church', images: ['/icon-512.png'] },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, jar, me] = await Promise.all([getLocale(), cookies(), getCurrentUser()])
  const size = jar.get(DISPLAY_COOKIES.textSize)?.value
  return (
    <html lang={locale === 'tw' ? 'ak' : locale === 'ga' ? 'gaa' : locale} suppressHydrationWarning
      data-text-size={isTextSize(size) ? size : 'default'} data-saver={jar.get(DISPLAY_COOKIES.dataSaver)?.value === '1' ? 'on' : undefined}>
      <body className="min-h-dvh font-sans">
        <Providers locale={locale}>
          {/* Calls sit above every screen so a call continues while moving around the app (never in Kids mode) */}
          <CallProvider me={me && !jar.get(KIDS_COOKIE)?.value ? { id: me.id, fullName: me.fullName } : null} enabled={livekitEnabled()}>{children}</CallProvider>
        </Providers>
      </body>
    </html>
  )
}
