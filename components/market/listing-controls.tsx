'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Eye, EyeOff, MoreHorizontal, Pencil, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteListingAction, duplicateListingAction, listingStatusAction, variantStockAction } from '@/server/actions/market'

/** ••• on a listing: edit, view, put on sale / drafts, stock, duplicate, delete. */
export function ListingMenu({ id, status, variants }: { id: string; status: 'active' | 'draft' | 'removed'; variants: { id: string; name: string; stock: number }[] }) {
  const { t } = useI18n()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [confirm, setConfirm] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)
  const [stock, setStock] = useState<Record<string, string>>(Object.fromEntries(variants.map((v) => [v.id, String(v.stock)])))
  const done = () => { toast.success(t('market.sell.products.updated')); router.refresh() }
  const fail = (e: string) => toast.error(t(`market.sell.err.${e}` as MessageKey))
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t('prayer.more')} disabled={pending} className="rounded-full p-2 hover:bg-muted" data-listing-menu={id}><MoreHorizontal className="size-5" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild><Link href={`/market/sell/products/${id}/edit`}><Pencil />{t('market.sell.products.edit')}</Link></DropdownMenuItem>
          <DropdownMenuItem asChild><Link href={`/market/p/${id}`}><Eye />{t('market.sell.products.view')}</Link></DropdownMenuItem>
          {status !== 'removed' && <DropdownMenuItem onSelect={() => setStockOpen(true)} data-edit-stock><Upload />{t('market.sell.products.stockEdit')}</DropdownMenuItem>}
          {status === 'draft' && <DropdownMenuItem data-publish-listing onSelect={() => start(async () => { const r = await listingStatusAction(id, 'active'); if (r.ok) done(); else fail(r.error) })}><Eye />{t('market.sell.products.publish')}</DropdownMenuItem>}
          {status === 'active' && <DropdownMenuItem data-unpublish-listing onSelect={() => start(async () => { const r = await listingStatusAction(id, 'draft'); if (r.ok) done(); else fail(r.error) })}><EyeOff />{t('market.sell.products.unpublish')}</DropdownMenuItem>}
          <DropdownMenuItem data-duplicate onSelect={() => start(async () => { const r = await duplicateListingAction(id); if (r.ok) router.push(`/market/sell/products/${r.id}/edit`); else fail(r.error) })}><Copy />{t('market.sell.products.duplicate')}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)} data-delete-listing><Trash2 />{t('market.sell.products.delete')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t('market.sell.products.delete')}</AlertDialogTitle><AlertDialogDescription>{t('market.sell.products.deleteConfirm')}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t('profile.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => start(async () => { if (await deleteListingAction(id)) done() })}>{t('market.sell.products.delete')}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('market.sell.products.stockEdit')}</DialogTitle></DialogHeader>
          <div className="max-h-[50dvh] space-y-2 overflow-y-auto">{variants.map((v) => (
            <label key={v.id} className="flex items-center gap-3 text-sm"><span className="flex-1 font-medium">{v.name || '—'}</span>
              <Input inputMode="numeric" value={stock[v.id] ?? ''} onChange={(e) => setStock({ ...stock, [v.id]: e.target.value.replace(/\D/g, '') })} className="w-24" data-stock-for={v.name} /></label>
          ))}</div>
          <DialogFooter><Button disabled={pending} data-save-stock onClick={() => start(async () => {
            for (const v of variants) if (String(v.stock) !== stock[v.id] && stock[v.id] !== '') await variantStockAction(v.id, Number(stock[v.id]))
            setStockOpen(false); done()
          })}>{t('market.sell.products.saveStock')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
