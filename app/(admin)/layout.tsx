import { AppShell } from '@/components/shell/app-shell'
import { AdminTabs } from '@/components/admin/admin-tabs'
import { requireTechAdmin } from '@/server/identity/session'

export const metadata = { title: { default: 'Admin', template: '%s · Admin · PAPA' } }

/** Tech Department area. Every page and action inside also checks the role on the server. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireTechAdmin('/admin')
  return (
    <AppShell wide>
      <AdminTabs />
      {children}
    </AppShell>
  )
}
