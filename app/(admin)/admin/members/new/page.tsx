import { redirect } from 'next/navigation'
import { getT } from '@/lib/i18n/server'
import { env } from '@/lib/env'
import { PageHeader } from '@/components/common/page-header'
import { MemberForm } from '@/components/admin/member-form'

export const metadata = { title: 'Add member' }

export default async function NewMember() {
  if (env.churchDbMode === 'api') redirect('/admin/members')
  const t = await getT()
  return (<><PageHeader title={t('admin.members.add')} back="/admin/members" /><div className="p-4 sm:p-6"><MemberForm /></div></>)
}
