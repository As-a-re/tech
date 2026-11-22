import { AppShell } from '@/components/shell/app-shell'

/** Messages use the whole width and height (no right column). */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <AppShell full>{children}</AppShell>
}
