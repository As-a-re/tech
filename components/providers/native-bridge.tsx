'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { saveNativePushToken } from '@/server/actions/discovery'

/**
 * Only does something inside the PAPA Android/iOS app (Capacitor): phone notifications, opening the screen a
 * notification points to, the hardware back button, and the status bar colour. In browsers it does nothing.
 */
export function NativeBridge({ signedIn, push }: { signedIn: boolean; push: boolean }) {
  const router = useRouter()
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor
    if (!cap?.isNativePlatform?.()) return
    const platform = cap.getPlatform?.() === 'ios' ? 'ios' : 'android'
    const cleanups: (() => void)[] = []
    ;(async () => {
      const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([import('@capacitor/app'), import('@capacitor/status-bar'), import('@capacitor/splash-screen')])
      SplashScreen.hide().catch(() => {})
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches || document.documentElement.classList.contains('dark')
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
      const back = await App.addListener('backButton', ({ canGoBack }) => { if (canGoBack) window.history.back(); else App.exitApp() })
      cleanups.push(() => back.remove())
      // Links shared from other apps (https://<papa>/...) open the right screen
      const open = await App.addListener('appUrlOpen', ({ url }) => { try { const u = new URL(url); router.push(u.pathname + u.search) } catch { /* ignore */ } })
      cleanups.push(() => open.remove())
      // Only when the server can send app notifications (FCM_SERVICE_ACCOUNT): registering on Android without Firebase
      // set up in the app (google-services.json) would crash it. See docs/MOBILE-APPS.md.
      if (!signedIn || !push) return
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const perm = await PushNotifications.checkPermissions()
      const granted = perm.receive === 'granted' || (perm.receive === 'prompt' && (await PushNotifications.requestPermissions()).receive === 'granted')
      if (!granted) return
      if (platform === 'android') {
        await PushNotifications.createChannel({ id: 'default', name: 'PAPA', importance: 4 }).catch(() => {})
        await PushNotifications.createChannel({ id: 'calls', name: 'Calls', importance: 5, sound: 'default' }).catch(() => {})
      }
      const reg = await PushNotifications.addListener('registration', ({ value }) => { void saveNativePushToken(value, platform) })
      const tap = await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const url = (notification.data as { url?: string } | undefined)?.url
        if (url) { try { const u = new URL(url, location.origin); router.push(u.pathname + u.search) } catch { /* ignore */ } }
      })
      cleanups.push(() => reg.remove(), () => tap.remove())
      await PushNotifications.register()
    })().catch(() => {})
    return () => cleanups.forEach((c) => c())
  }, [router, signedIn, push])
  return null
}
