import { AppShell } from '@/components/shell/app-shell'
import { DiscoveryRail } from '@/components/rail/discovery-rail'
import { KidsShell } from '@/components/kids/kids-shell'
import { kidsMode } from '@/lib/library/kids-server'

/** The Kids section: inside the normal app, or on its own when the device is in Kids mode. */
export default async function KidsLayout({ children }: { children: React.ReactNode }) {
  const age = await kidsMode()
  return age ? <KidsShell age={age}>{children}</KidsShell> : <AppShell rail={<DiscoveryRail />}>{children}</AppShell>
}
