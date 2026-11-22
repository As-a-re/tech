import { AppShell } from '@/components/shell/app-shell'
import { DiscoveryRail } from '@/components/rail/discovery-rail'

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return <AppShell rail={<DiscoveryRail />}>{children}</AppShell>
}
