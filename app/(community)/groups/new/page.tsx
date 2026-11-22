import { getT } from '@/lib/i18n/server'
import { requireUser } from '@/server/identity/session'
import { PageHeader } from '@/components/common/page-header'
import { GroupForm } from '@/components/groups/group-form'

export const metadata = { title: 'New group' }

export default async function NewGroup() {
  const [, t] = await Promise.all([requireUser('/groups/new'), getT()])
  return <><PageHeader title={t('groups.new')} back="/groups" /><GroupForm /></>
}
