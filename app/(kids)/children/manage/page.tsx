import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import type { MessageKey } from '@/lib/i18n/config'
import { requireUser } from '@/server/identity/session'
import { myKidsItems } from '@/server/library/kids'
import { PageHeader } from '@/components/common/page-header'
import { KIDS_ICON } from '@/components/kids/kids-card'

export const metadata = { title: 'My kids content' }

export default async function ManageKids() {
  const [me, t] = await Promise.all([requireUser('/children/manage'), getT()])
  const items = await myKidsItems(me)
  return (
    <>
      <PageHeader title={t('kids.manage')} back="/children" action={<Link href="/children/new" className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">{t('kids.add')}</Link>} />
      {items.length === 0 ? <p className="px-8 py-16 text-center text-muted-foreground">{t('kids.none')}</p> : (
        <ul className="divide-y">{items.map((i) => { const Icon = KIDS_ICON[i.kind]; return (
          <li key={i.id}><Link href={`/children/${i.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
            <Icon className="size-5 text-primary" /><span className="min-w-0 flex-1"><b className="block truncate">{i.title}</b>
              <span className="text-sm text-muted-foreground">{t(`kids.kinds.${i.kind}` as MessageKey)} · {t(`kids.agesLong.${i.ageGroup}`)}{i.status === 'draft' && ` · ${t('pubs.draft')}`}</span></span>
          </Link></li>
        ) })}</ul>
      )}
    </>
  )
}
