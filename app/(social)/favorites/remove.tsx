'use client'

import { useTransition } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { Button } from '@/components/ui/button'
import { removeFavoriteAction } from '@/server/actions/discovery'

export function RemoveFavorite({ id }: { id: string }) {
  const { t } = useI18n(); const [p, start] = useTransition()
  return <Button size="sm" variant="outline" disabled={p} onClick={() => start(() => removeFavoriteAction(id))}>{t('favorites.remove')}</Button>
}
