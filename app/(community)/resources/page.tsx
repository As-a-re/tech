import Link from 'next/link'
import { Package, Settings2 } from 'lucide-react'
import { getT } from '@/lib/i18n/server'
import { getCurrentUser } from '@/server/identity/session'
import { isResourceManagerAnywhere, listResources } from '@/server/resources/resources'
import { PageHeader } from '@/components/common/page-header'
import { LinkTabs } from '@/components/community/tabs'
import { ResourceTile } from '@/components/resources/resource-card'

export const metadata = { title: 'Resources' }

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ level?: string }> }) {
  const [t, me, sp] = await Promise.all([getT(), getCurrentUser(), searchParams])
  const level = me && (sp.level === 'district' || sp.level === 'local') ? sp.level : me && !sp.level ? 'local' : 'national'
  const items = await listResources(level === 'national' ? { level } : level === 'district' ? { level, districtId: me!.districtId } : { level, assemblyId: me!.assemblyId })
  const manager = await isResourceManagerAnywhere(me)
  const uniforms = items.filter((i) => i.kind === 'uniform'), guides = items.filter((i) => i.kind === 'study_guide')
  return (
    <>
      <PageHeader title={t('res.title')} action={me && (
        <span className="flex gap-2">
          {manager && <Link href="/resources/manage" aria-label={t('res.manage')} className="rounded-full border p-2 hover:bg-muted"><Settings2 className="size-4" /></Link>}
          <Link href="/resources/orders" className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold hover:bg-muted"><Package className="size-4" />{t('res.myOrders')}</Link>
        </span>
      )} />
      <p className="border-b px-4 py-3 text-sm text-muted-foreground">{t('res.lead')}</p>
      <LinkTabs sticky={false} active={level} items={[
        ...(me ? [{ key: 'local', label: `${t('res.tabs.local')}`, href: '/resources?level=local' }, { key: 'district', label: t('res.tabs.district'), href: '/resources?level=district' }] : []),
        { key: 'national', label: t('res.tabs.national'), href: '/resources?level=national' }]} />
      {me && level !== 'national' && <p className="px-4 pt-3 text-sm font-semibold text-primary">{level === 'local' ? me.assemblyName : me.districtName}</p>}
      {items.length === 0 && <p className="px-8 py-16 text-center text-muted-foreground">{t('res.none')}</p>}
      {uniforms.length > 0 && <section className="px-4 pt-4"><h2 className="mb-2 font-bold">{t('res.uniforms')}</h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">{uniforms.map((r) => <ResourceTile key={r.id} r={r} t={t} />)}</div></section>}
      {guides.length > 0 && <section className="px-4 py-4"><h2 className="mb-2 font-bold">{t('res.guides')}</h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">{guides.map((r) => <ResourceTile key={r.id} r={r} t={t} />)}</div></section>}
    </>
  )
}
