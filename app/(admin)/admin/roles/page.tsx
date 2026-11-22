import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { listAccounts } from '@/server/admin/accounts'
import { listLevelRoles } from '@/server/admin/roles'
import { listDistricts } from '@/server/admin/structure'
import { AdminHeading, Panel } from '@/components/admin/ui'
import { UserAvatar } from '@/components/common/user-avatar'
import { GrantForm, RevokeButton } from './controls'

export const metadata = { title: 'Roles' }

export default async function Roles() {
  const [t, admins, managers, districts] = await Promise.all([getT(), listAccounts({ role: 'tech_admin', page: 1 }), listLevelRoles(), listDistricts()])
  const scope = (m: (typeof managers)[number]) => m.level === 'national' ? t('admin.roles.national') : m.level === 'district' ? `${t('admin.roles.district')} · ${m.districtName}` : `${t('admin.roles.local')} · ${m.assemblyName}`
  return (
    <>
      <AdminHeading title={t('admin.tabs.roles')} />
      <div className="space-y-5 p-4 sm:p-6">
        <Panel title={t('admin.roles.techAdmins')} note={t('admin.roles.techAdminsNote')}>
          <ul className="-mx-4 divide-y sm:-mx-5">
            {admins.rows.map((a) => (
              <li key={a.id}><Link href={`/admin/accounts/${a.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 sm:px-5">
                <UserAvatar name={a.fullName} src={a.avatarUrl} className="size-9" /><span><b>{a.fullName}</b> <span className="text-sm text-muted-foreground">@{a.username}</span></span>
              </Link></li>
            ))}
          </ul>
        </Panel>
        <Panel title={t('admin.roles.levelRoles')} note={t('admin.roles.levelRolesNote')}>
          <GrantForm districts={districts.map(({ id, name }) => ({ id, name }))} />
          <ul className="-mx-4 mt-5 divide-y border-t sm:-mx-5">
            {managers.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground sm:px-5">{t('admin.roles.none')}</li>}
            {managers.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <UserAvatar name={m.fullName} src={m.avatarUrl} className="size-9" />
                <span className="min-w-0 flex-1"><b>{m.fullName}</b> <span className="text-sm text-muted-foreground">@{m.username}</span><span className="block text-sm"><b className="text-primary">{t(`admin.roles.kinds.${m.role}`)}</b> · {scope(m)}</span></span>
                <RevokeButton id={m.id} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  )
}
