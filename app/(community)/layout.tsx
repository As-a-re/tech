import { AppShell } from '@/components/shell/app-shell'
import { DiscoveryRail } from '@/components/rail/discovery-rail'

/** Announcements, events and the assembly directory. */
export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <AppShell rail={<DiscoveryRail />}>{children}</AppShell>
}
