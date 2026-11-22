import { AppShell } from '@/components/shell/app-shell'

/** Watching a live service uses the whole width: player and chat side by side on big screens. */
export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return <AppShell full>{children}</AppShell>
}
