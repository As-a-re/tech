import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { PreferencesMenu } from '@/components/shell/preferences-menu'

/** Two-panel layout for sign in, registration and password reset. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getT()
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-hero p-10 text-white dark:border-r lg:flex">
        <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-white/5" />
        <div aria-hidden className="absolute -bottom-32 -left-16 size-[28rem] rounded-full bg-brand-red/25" />
        <Link href="/" className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={52} height={52} className="size-13 rounded-full bg-white ring-4 ring-white/20" />
          <span className="leading-none"><span className="block text-2xl font-extrabold tracking-tight">PAPA</span>
            <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">{t('app.church')}</span></span>
        </Link>
        <p className="relative max-w-md text-4xl font-bold leading-tight">{t('app.tagline')}</p>
        <p className="relative text-sm text-white/60">{t('footer.rights')}</p>
      </div>
      <div className="flex flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 lg:invisible">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={36} height={36} className="size-9 rounded-full bg-white" />
            <span className="text-lg font-extrabold text-primary">PAPA</span>
          </Link>
          <PreferencesMenu />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">{children}</div>
      </div>
    </div>
  )
}
