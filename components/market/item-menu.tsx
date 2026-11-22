'use client'

import { useState } from 'react'
import { Flag, Link2, MoreHorizontal, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ReportDialog } from '@/components/moderation/report-dialog'
import type { ReportTarget } from '@/server/moderation/reports'

/** ••• on a product or shop: share, copy link, report. */
export function MarketMenu({ path, title, report, reportLabel }: { path: string; title: string; report: ReportTarget | null; reportLabel: string }) {
  const { t } = useI18n()
  const [reporting, setReporting] = useState(false)
  const url = () => `${location.origin}${path}`
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('prayer.more')} className="flex size-10 items-center justify-center rounded-full border bg-background hover:bg-muted"><MoreHorizontal className="size-5" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={async () => { if (navigator.share) await navigator.share({ title, url: url() }).catch(() => {}); else { await navigator.clipboard.writeText(url()); toast.success(t('market.product.copied')) } }}><Share2 />{t('market.product.share')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={async () => { await navigator.clipboard.writeText(url()); toast.success(t('market.product.copied')) }}><Link2 />{t('prayer.copyLink')}</DropdownMenuItem>
          {report && <DropdownMenuItem onSelect={() => setReporting(true)}><Flag />{reportLabel}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      {report && <ReportDialog target={report} title={reportLabel} open={reporting} onOpenChange={setReporting} />}
    </>
  )
}
