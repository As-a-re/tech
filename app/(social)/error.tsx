'use client'

import { RotateCcw, TriangleAlert } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'
import { StatusScreen } from '@/components/common/status-screen'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n()
  return (
    <StatusScreen icon={<TriangleAlert className="size-7" />} title={t('errors.errorTitle')} text={t('errors.errorText')}
      action={<button onClick={reset} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"><RotateCcw className="size-4" />{t('errors.tryAgain')}</button>} />
  )
}
