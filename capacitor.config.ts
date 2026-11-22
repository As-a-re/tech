import type { CapacitorConfig } from '@capacitor/cli'
import { existsSync, readFileSync } from 'node:fs'

// MOBILE_APP_URL / MOBILE_APP_ID can live in .env.local like the other settings (the environment wins)
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^(MOBILE_APP_URL|MOBILE_APP_ID)=(.*)$/)
    if (m && !process.env[m[1]] && m[2].trim()) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

/**
 * PAPA for Android and iOS: the native app opens the hosted PAPA (MOBILE_APP_URL) in a secure app window,
 * adds phone notifications (Firebase), the splash screen and the status bar. Everything else is the same web app,
 * so every update to the website reaches the apps at once (no store update needed for normal changes).
 *   MOBILE_APP_URL=https://papa.your-domain.org npx cap sync     (see docs/MOBILE-APPS.md)
 */
const url = process.env.MOBILE_APP_URL || 'https://papa.example.org'

const config: CapacitorConfig = {
  appId: process.env.MOBILE_APP_ID || 'org.christanointed.papa',
  appName: 'PAPA',
  // Shown only if the server can't be reached when the app starts
  webDir: 'mobile/www',
  server: { url, cleartext: url.startsWith('http://'), errorPath: 'index.html', allowNavigation: [new URL(url).host, 'checkout.paystack.com', '*.paystack.co', '*.paystack.com'] },
  android: { allowMixedContent: false },
  ios: { contentInset: 'automatic', limitsNavigationsToAppBoundDomains: false },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: '#1E3FA0', showSpinner: false, androidScaleType: 'CENTER_INSIDE' },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
}

export default config
