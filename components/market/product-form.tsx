'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { CATEGORIES } from '@/lib/market/categories'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ImagePicker, toPicked, type PickedImage } from '@/components/common/image-picker'
import { saveProductAction } from '@/server/actions/market'
import type { ProductInput, VariantInput } from '@/server/market/seller'

const input = 'h-11 w-full rounded-lg border bg-background px-3 outline-none focus:border-primary'
type Opt = { name: string; values: string }
const split = (s: string) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 30)
const key = (o: Record<string, string>) => JSON.stringify(Object.entries(o).sort())

/** Add or edit a listing: photos, details, choices (each combination with its own price and stock), deal and status. */
export function ProductForm({ id, initial, removed }: { id?: string; initial?: ProductInput; removed?: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  const [v, setV] = useState<ProductInput>(initial ?? { title: '', description: '', category: 'fashion', condition: 'new', images: [], optionNames: [], variants: [{ options: {}, priceGhs: 0, stock: 1 }], status: 'active' })
  const set = <K extends keyof ProductInput>(k: K, val: ProductInput[K]) => setV((x) => ({ ...x, [k]: val }))
  const [photos, setPhotos] = useState<PickedImage[]>(toPicked((initial?.images ?? []).map((url) => ({ url }))))
  const [opts, setOpts] = useState<Opt[]>((initial?.optionNames ?? []).map((n) => ({ name: n, values: [...new Set((initial?.variants ?? []).map((x) => x.options[n]).filter(Boolean))].join(', ') })))
  // Price/stock/code per combination, kept by the combination's choices so they survive changes to the lists
  const [cells, setCells] = useState<Record<string, VariantInput>>(() => Object.fromEntries((initial?.variants ?? []).map((x) => [key(x.options), x])))
  const [all, setAll] = useState({ price: '', stock: '' })
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  const names = opts.map((o) => o.name.trim()).filter(Boolean)
  const combos = useMemo(() => {
    const lists = opts.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), values: split(o.values) }))
    if (!lists.length) return [{}] as Record<string, string>[]
    return lists.reduce<Record<string, string>[]>((acc, l) => acc.flatMap((a) => l.values.map((val) => ({ ...a, [l.name]: val }))), [{}]).filter((c) => Object.keys(c).length === lists.length)
  }, [opts])
  const simple = !names.length
  const cell = (c: Record<string, string>): VariantInput => cells[key(c)] ?? (simple ? Object.values(cells)[0] : undefined) ?? { options: c, priceGhs: Number(all.price) || v.variants[0]?.priceGhs || 0, stock: Number(all.stock) || 0 }
  const edit = (c: Record<string, string>, patch: Partial<VariantInput>) => setCells((x) => ({ ...x, [key(c)]: { ...cell(c), ...patch, options: c } }))
  const move = (i: number, d: -1 | 1) => setPhotos((p) => { const a = [...p]; const j = i + d; if (j < 0 || j >= a.length) return p; [a[i], a[j]] = [a[j], a[i]]; return a })

  const submit = (status: 'active' | 'draft') => start(async () => {
    setError('')
    if (photos.some((p) => p.uploading)) return
    const variants = combos.map((c) => { const x = cell(c); return { id: x.id ?? null, options: c, priceGhs: Number(x.priceGhs), stock: Number(x.stock), sku: x.sku ?? null } })
    const r = await saveProductAction({ ...v, status, optionNames: names, images: photos.map((p) => p.url!).filter(Boolean), variants }, id)
    if (!r.ok) { setError(t(`market.sell.err.${r.error}` as MessageKey)); return }
    toast.success(t('market.sell.pform.saved'))
    router.push(status === 'active' ? `/market/p/${r.id}` : '/market/sell/products?s=draft')
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit('active') }} className="space-y-5 px-4 py-5" data-product-form>
      {removed && <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">{t('market.sell.pform.removed')}</p>}
      <section className="space-y-2">
        <span className="text-sm font-semibold">{t('market.sell.pform.photos')}</span>
        <ImagePicker value={photos} onChange={setPhotos} max={8} label={t('market.sell.pform.addPhotos')} onError={() => setError(t('market.sell.err.upload'))} />
        {photos.length > 1 && <div className="flex flex-wrap gap-1">{photos.map((p, i) => (
          <span key={p.key} className="flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs">{i + 1}
            <button type="button" aria-label="Move left" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30"><ArrowUp className="size-3 -rotate-90" /></button>
            <button type="button" aria-label="Move right" disabled={i === photos.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30"><ArrowDown className="size-3 -rotate-90" /></button></span>
        ))}</div>}
      </section>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.pform.title')}</span>
        <input name="title" required maxLength={120} value={v.title} onChange={(e) => set('title', e.target.value)} placeholder={t('market.sell.pform.titlePh')} className={input} /></label>
      <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.pform.description')}</span>
        <textarea name="description" rows={4} maxLength={5000} value={v.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder={t('market.sell.pform.descriptionPh')} className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:border-primary" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.pform.category')}</span>
          <select name="category" value={v.category} onChange={(e) => set('category', e.target.value)} className={input}>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{t(`market.cat.${c.key}`)}</option>)}</select></label>
        <fieldset className="space-y-1"><legend className="text-sm font-semibold">{t('market.sell.pform.condition')}</legend>
          <div className="flex gap-2">{(['new', 'used', 'refurbished'] as const).map((c) => (
            <button key={c} type="button" aria-pressed={v.condition === c} onClick={() => set('condition', c)} data-condition={c}
              className={cn('flex-1 rounded-lg border px-2 py-2.5 text-sm font-medium', v.condition === c ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>{t(`market.condition.${c}`)}</button>
          ))}</div></fieldset>
      </div>

      <section className="space-y-3 rounded-2xl border p-4" data-options>
        <div><h2 className="font-bold">{t('market.sell.pform.options')}</h2><p className="text-sm text-muted-foreground">{t('market.sell.pform.optionsLead')}</p></div>
        {opts.map((o, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <input aria-label={t('market.sell.pform.optionName')} placeholder={t('market.sell.pform.optionNamePh')} maxLength={20} value={o.name} data-option-name={i}
              onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={cn(input, 'h-10')} />
            <input aria-label={t('market.sell.pform.optionValues')} placeholder={t('market.sell.pform.optionValuesPh')} value={o.values} data-option-values={i}
              onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))} className={cn(input, 'h-10')} />
            <button type="button" aria-label={t('market.sell.pform.removeOption')} onClick={() => setOpts(opts.filter((_, j) => j !== i))} className="justify-self-start rounded p-2 text-destructive hover:bg-muted"><Trash2 className="size-4" /></button>
          </div>
        ))}
        {opts.length < 2 && <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setOpts([...opts, { name: '', values: '' }])} data-add-option><Plus className="size-4" />{t('market.sell.pform.addOption')}</Button>}
      </section>

      <section className="space-y-2" data-variants={combos.length}>
        {!simple && combos.length > 1 && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl bg-muted/60 p-2">
            <span className="self-center text-sm font-semibold">{t('market.sell.pform.all')}:</span>
            <input aria-label={t('market.sell.pform.price')} placeholder={t('market.sell.pform.price')} inputMode="decimal" value={all.price} onChange={(e) => setAll({ ...all, price: e.target.value })} className={cn(input, 'h-9 w-28')} />
            <input aria-label={t('market.sell.pform.stock')} placeholder={t('market.sell.pform.stock')} inputMode="numeric" value={all.stock} onChange={(e) => setAll({ ...all, stock: e.target.value })} className={cn(input, 'h-9 w-24')} />
            <Button type="button" size="sm" variant="outline" onClick={() => setCells((x) => Object.fromEntries(combos.map((c) => { const old = x[key(c)] ?? cell(c); return [key(c), { ...old, options: c, ...(all.price ? { priceGhs: Number(all.price) } : {}), ...(all.stock ? { stock: Number(all.stock) } : {}) }] })))} data-set-all>OK</Button>
          </div>
        )}
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              {!simple && <th className="px-3 py-2">{t('market.sell.pform.variant')}</th>}<th className="px-3 py-2">{t('market.sell.pform.price')}</th><th className="px-3 py-2">{t('market.sell.pform.stock')}</th><th className="px-3 py-2">{t('market.sell.pform.sku')}</th>
            </tr></thead>
            <tbody>{combos.map((c) => { const x = cell(c); return (
              <tr key={key(c)} className="border-b last:border-0" data-variant-row={Object.values(c).join(' / ') || 'default'}>
                {!simple && <td className="whitespace-nowrap px-3 py-2 font-medium">{Object.values(c).join(' / ')}</td>}
                <td className="px-3 py-2"><input aria-label={t('market.sell.pform.price')} inputMode="decimal" value={x.priceGhs || ''} onChange={(e) => edit(c, { priceGhs: Number(e.target.value.replace(/[^\d.]/g, '') || 0) })} className={cn(input, 'h-9 w-28')} data-price-input /></td>
                <td className="px-3 py-2"><input aria-label={t('market.sell.pform.stock')} inputMode="numeric" value={x.stock} onChange={(e) => edit(c, { stock: Number(e.target.value.replace(/\D/g, '') || 0) })} className={cn(input, 'h-9 w-20')} data-stock-input /></td>
                <td className="px-3 py-2"><input aria-label={t('market.sell.pform.sku')} maxLength={40} value={x.sku ?? ''} onChange={(e) => edit(c, { sku: e.target.value })} className={cn(input, 'h-9 w-28')} /></td>
              </tr>) })}</tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">{t('market.sell.pform.deal')}</h2>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.pform.compareAt')}</span>
          <input name="compareAt" inputMode="decimal" value={v.compareAtGhs ?? ''} onChange={(e) => set('compareAtGhs', e.target.value ? Number(e.target.value.replace(/[^\d.]/g, '')) : null)} className={input} />
          <span className="text-xs text-muted-foreground">{t('market.sell.pform.compareHint')}</span></label>
        <label className="block space-y-1"><span className="text-sm font-semibold">{t('market.sell.pform.dealEnds')}</span>
          <input name="dealEnds" type="date" value={v.dealEndsAt ?? ''} onChange={(e) => set('dealEndsAt', e.target.value || null)} disabled={!v.compareAtGhs} className={input} /></label>
      </section>

      {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" size="lg" className="rounded-full" disabled={pending || !v.title.trim()} onClick={() => submit('draft')} data-save-draft>{t('market.sell.pform.saveDraft')}</Button>
        <Button type="submit" size="lg" className="rounded-full" disabled={pending || removed || !v.title.trim()} data-publish>{t('market.sell.pform.publish')}</Button>
      </div>
    </form>
  )
}
