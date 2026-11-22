'use client'

import { ThemeProvider, useTheme } from 'next-themes'
import { Toaster } from 'sonner'
import { I18nProvider } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/config'
import { ServiceWorker } from './service-worker'

export function Providers({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="papa_theme">
      <I18nProvider locale={locale}>
        {children}
        <ThemedToaster />
        <ServiceWorker />
      </I18nProvider>
    </ThemeProvider>
  )
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster position="top-center" richColors closeButton theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />
}
