'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n/client'
import type { MessageKey } from '@/lib/i18n/config'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  adminCancelOrderAction, adminRefundAction, answerRequestAction, cancelOrderAction, confirmReceivedAction, handoverAction, requestReturnAction, reviewAction,
  sellerCancelAction, sellerStepAction, withdrawRequestAction, requestRiderAction, cancelRiderAction, escalateAction,
} from '@/server/actions/market'

const REASONS = ['changed_mind', 'wrong_item', 'damaged', 'not_as_described', 'not_received', 'late', 'other'] as const
type R = { ok: boolean; error?: string } | boolean

function useRun() {
  const { t } = useI18n()
  const [pending, start] = useTransition()
  const run = (p: () => Promise<R>, done: string, after?: () => void) => start(async () => {
    const r = await p()
    const ok = typeof r === 'boolean' ? r : r.ok
    if (!ok) { toast.error(t(`market.err.${typeof r === 'boolean' ? 'state' : r.error ?? 'generic'}` as MessageKey)); return }
    toast.success(done); after?.()
  })
  return { pending, run, t }
}

/** A dialog asking for a reason (and details) before sending. */
function ReasonDialog({ open, onOpenChange, title, lead, reasons, onSend, pending }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; lead: string; reasons: readonly string[]; onSend: (reason: string, details: string) => void; pending: boolean
}) {
  const { t } = useI18n()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{lead}</DialogDescription></DialogHeader>
        <fieldset className="space-y-1" aria-label={t('market.order.reason')}>
          {reasons.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted">
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--primary)]" />
              <span className="text-[15px]">{t(`market.reasons.${r}` as MessageKey)}</span>
            </label>
          ))}
        </fieldset>
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={2} placeholder={t('market.order.details')} aria-label={t('market.order.details')} />
        <DialogFooter><Button disabled={!reason || pending} onClick={() => onSend(reason, details)} data-send-request>{t('market.order.send')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Buyer: cancel, ask to cancel, confirm delivery, return/refund, withdraw a request. */
export function BuyerActions({ orderId, can, openRequestId }: {
  orderId: string; openRequestId: string | null
  can: { cancel: boolean; requestCancel: boolean; confirm: boolean; notReceived: boolean; return: boolean; withdraw: boolean }
}) {
  const { pending, run, t } = useRun()
  const [dialog, setDialog] = useState<null | 'cancel' | 'requestCancel' | 'return' | 'notReceived' | 'confirm'>(null)
  const close = () => setDialog(null)
  return (
    <div className="flex flex-wrap gap-2" data-buyer-actions>
      {can.confirm && <Button onClick={() => setDialog('confirm')} data-confirm-received>{t('market.order.confirm')}</Button>}
      {can.cancel && <Button variant="outline" className="text-destructive" onClick={() => setDialog('cancel')} data-cancel-order>{t('market.order.cancel')}</Button>}
      {can.requestCancel && <Button variant="outline" onClick={() => setDialog('requestCancel')} data-request-cancel>{t('market.order.requestCancel')}</Button>}
      {can.return && <Button variant="outline" onClick={() => setDialog('return')} data-return>{t('market.order.return')}</Button>}
      {can.notReceived && <Button variant="outline" onClick={() => setDialog('notReceived')} data-not-received>{t('market.order.notReceived')}</Button>}
      {can.withdraw && openRequestId && <Button variant="ghost" disabled={pending} onClick={() => run(() => withdrawRequestAction(openRequestId, orderId), t('market.admin.done'))}>{t('market.order.withdraw')}</Button>}
      <Dialog open={dialog === 'confirm'} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('market.order.confirm')}</DialogTitle><DialogDescription>{t('market.order.confirmLead')}</DialogDescription></DialogHeader>
          <DialogFooter><Button disabled={pending} onClick={() => run(() => confirmReceivedAction(orderId), t('market.order.confirmed'), close)} data-confirm-yes>{t('market.order.confirm')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ReasonDialog open={dialog === 'cancel' || dialog === 'requestCancel'} onOpenChange={(o) => !o && close()} pending={pending} reasons={REASONS.filter((r) => r !== 'not_received' && r !== 'damaged' && r !== 'wrong_item' && r !== 'not_as_described')}
        title={dialog === 'cancel' ? t('market.order.cancel') : t('market.order.requestCancel')} lead={dialog === 'cancel' ? t('market.order.cancelLead') : t('market.order.requestCancelLead')}
        onSend={(reason, details) => run(() => cancelOrderAction(orderId, reason, details), dialog === 'cancel' ? t('market.order.cancelled') : t('market.order.sent'), close)} />
      <ReasonDialog open={dialog === 'return' || dialog === 'notReceived'} onOpenChange={(o) => !o && close()} pending={pending}
        reasons={dialog === 'notReceived' ? ['not_received'] : REASONS.filter((r) => r !== 'not_received' && r !== 'late')}
        title={dialog === 'notReceived' ? t('market.order.notReceived') : t('market.order.return')} lead={t('market.order.returnLead')}
        onSend={(reason, details) => run(() => requestReturnAction(orderId, dialog === 'notReceived' || reason === 'not_received' ? 'refund' : 'return', reason, details), t('market.order.sent'), close)} />
    </div>
  )
}

/** Buyer: rate a product from a delivered order (writing again changes the review). */
export function ReviewButton({ orderId, productId, title, current }: { orderId: string; productId: string; title: string; current: number | null }) {
  const { pending, run, t } = useRun()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(current ?? 0)
  const [body, setBody] = useState('')
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-review-item={productId} className="text-sm font-semibold text-primary hover:underline">
        {current ? t('market.order.reviewed', { n: current }) : t('market.reviews.write')}</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{current ? t('market.reviews.edit') : t('market.reviews.write')}</DialogTitle><DialogDescription>{title}</DialogDescription></DialogHeader>
          <div className="flex justify-center gap-1" role="radiogroup" aria-label={t('market.reviews.rating')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t('market.reviews.stars', { n })} onClick={() => setRating(n)} data-star={n}>
                <Star className={cn('size-9 text-amber-500', n <= rating ? 'fill-current' : 'opacity-30')} />
              </button>
            ))}
          </div>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3} placeholder={t('market.reviews.bodyPh')} aria-label={t('market.reviews.bodyPh')} />
          <DialogFooter><Button disabled={!rating || pending} onClick={() => run(() => reviewAction(orderId, productId, rating, body), t('market.reviews.saved'), () => setOpen(false))} data-save-review>{t('market.reviews.save')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Seller: accept → pack → ship/ready, hand over with the buyer's code, or cancel. */
export function SellerActions({ orderId, pickup, can }: { orderId: string; pickup: boolean; can: { accept: boolean; pack: boolean; ship: boolean; handover: boolean; sellerCancel: boolean } }) {
  const { pending, run, t } = useRun()
  const [note, setNote] = useState('')
  const [code, setCode] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const done = t('market.seller.done')
  return (
    <div className="space-y-3" data-seller-actions>
      {(can.ship || can.pack || can.accept) && <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t('market.seller.note')} aria-label={t('market.seller.note')} />}
      <div className="flex flex-wrap gap-2">
        {can.accept && <Button disabled={pending} onClick={() => run(() => sellerStepAction(orderId, 'accept', note), done, () => setNote(''))} data-seller-accept>{t('market.seller.accept')}</Button>}
        {can.pack && <Button disabled={pending} variant="outline" onClick={() => run(() => sellerStepAction(orderId, 'pack', note), done, () => setNote(''))} data-seller-pack>{t('market.seller.pack')}</Button>}
        {can.ship && <Button disabled={pending} onClick={() => run(() => sellerStepAction(orderId, 'ship', note), done, () => setNote(''))} data-seller-ship>{pickup ? t('market.seller.ready') : t('market.seller.ship')}</Button>}
        {can.sellerCancel && <Button disabled={pending} variant="outline" className="text-destructive" onClick={() => setCancelling(true)} data-seller-cancel>{t('market.seller.cancel')}</Button>}
      </div>
      {can.handover && (
        <div className="flex gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder={t('market.seller.codePh')} aria-label={t('market.seller.codePh')} data-handover-code />
          <Button disabled={pending || code.length !== 6} onClick={() => run(() => handoverAction(orderId, code), t('market.seller.handoverDone'))} data-handover>{t('market.seller.handover')}</Button>
        </div>
      )}
      <Dialog open={cancelling} onOpenChange={setCancelling}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('market.seller.cancel')}</DialogTitle><DialogDescription>{t('market.seller.cancelReason')}</DialogDescription></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} aria-label={t('market.seller.cancelReason')} />
          <DialogFooter><Button variant="destructive" disabled={pending || !reason.trim()} onClick={() => run(() => sellerCancelAction(orderId, reason), done, () => setCancelling(false))}>{t('market.seller.cancel')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Seller or Tech Admin: approve or decline the buyer's request. */
export function AnswerRequest({ orderId, requestId, kind, maxGhs, suggestGhs, dispute }: { orderId: string; requestId: string; kind: 'cancel' | 'return' | 'refund'; maxGhs: number; suggestGhs: number; dispute?: boolean }) {
  const { pending, run, t } = useRun()
  const [response, setResponse] = useState('')
  const [amount, setAmount] = useState(String(suggestGhs))
  const done = t('market.seller.done')
  const n = Number(amount)
  return (
    <div className="space-y-2" data-answer-request={kind}>
      <Textarea value={response} onChange={(e) => setResponse(e.target.value)} maxLength={1000} rows={2} placeholder={t('market.seller.responsePh')} aria-label={t('market.seller.responsePh')} />
      {kind !== 'cancel' && <label className="flex items-center gap-2 text-sm"><span className="font-medium">{t('market.seller.refundAmount')}</span>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={0.01} max={maxGhs} step="0.01" className="w-32" /></label>}
      <div className="flex gap-2">
        <Button disabled={pending || (kind !== 'cancel' && !(n > 0 && n <= maxGhs))} onClick={() => run(() => answerRequestAction(requestId, orderId, true, response, kind === 'cancel' ? null : n), done)} data-approve>{dispute ? t('market.admin.decideBuyer') : t('market.seller.approve')}</Button>
        <Button disabled={pending} variant="outline" onClick={() => run(() => answerRequestAction(requestId, orderId, false, response), done)} data-decline>{dispute ? t('market.admin.decideSeller') : t('market.seller.decline')}</Button>
      </div>
    </div>
  )
}

/** Tech Admin: refund part or all, or cancel and refund everything. */
export function AdminOrderActions({ orderId, canRefund, canCancel, maxGhs }: { orderId: string; canRefund: boolean; canCancel: boolean; maxGhs: number }) {
  const { pending, run, t } = useRun()
  const [amount, setAmount] = useState(String(maxGhs))
  const [note, setNote] = useState('')
  const done = t('market.admin.done')
  return (
    <div className="space-y-2" data-admin-order>
      <div className="flex flex-wrap items-end gap-2">
        {canRefund && <label className="space-y-1 text-sm"><span className="font-medium">{t('market.admin.refundAmount')}</span><Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={0.01} max={maxGhs} step="0.01" className="w-32" /></label>}
        <label className="flex-1 space-y-1 text-sm"><span className="font-medium">{t('market.admin.refundNote')}</span><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></label>
        {canRefund && <Button disabled={pending || !(Number(amount) > 0) || !note.trim()} onClick={() => run(() => adminRefundAction(orderId, Number(amount), note), done)}>{t('market.admin.refund')}</Button>}
      </div>
      {canCancel && <Button variant="destructive" disabled={pending || !note.trim()} onClick={() => run(() => adminCancelOrderAction(orderId, note), done)}>{t('market.admin.cancelOrder')}</Button>}
    </div>
  )
}

/** Seller: offer the delivery to PAPA riders (paying them from their share), or call the rider off. */
export function RiderPanel({ orderId, canRequest, canCancel, deliveryFeeGhs, maxGhs }: { orderId: string; canRequest: boolean; canCancel: boolean; deliveryFeeGhs: number; maxGhs: number }) {
  const { pending, run, t } = useRun()
  const [fee, setFee] = useState(String(Math.max(5, deliveryFeeGhs)))
  const [note, setNote] = useState('')
  return (
    <div className="space-y-2" data-rider-panel>
      {canRequest && <>
        <p className="text-sm font-semibold">{t('market.seller.rider')}</p>
        <p className="text-xs text-muted-foreground">{t('market.seller.riderLead')} {t('market.seller.riderFeeHint', { fee: `GHS ${deliveryFeeGhs}` })}</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm"><span className="font-medium">{t('market.seller.riderFee')}</span>
            <Input value={fee} onChange={(e) => setFee(e.target.value)} type="number" min={5} max={maxGhs} step="0.5" className="w-28" data-rider-fee /></label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t('market.seller.riderNote')} aria-label={t('market.seller.riderNote')} className="min-w-40 flex-1" />
          <Button disabled={pending || !(Number(fee) >= 5)} onClick={() => run(() => requestRiderAction(orderId, Number(fee), note), t('market.seller.riderSent'))} data-request-rider>{t('market.seller.riderSend')}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('market.seller.ownDelivery')}</p>
      </>}
      {canCancel && <Button variant="outline" disabled={pending} onClick={() => run(() => cancelRiderAction(orderId), t('market.seller.done'))} data-cancel-rider>{t('market.seller.riderCancel')}</Button>}
    </div>
  )
}

/** Buyer: the seller declined, so ask a Tech Admin to decide. */
export function EscalateButton({ orderId }: { orderId: string }) {
  const { pending, run, t } = useRun()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-escalate>{t('market.order.escalate')}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('market.order.escalate')}</DialogTitle><DialogDescription>{t('market.order.escalateLead')}</DialogDescription></DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder={t('market.order.disputeNote')} aria-label={t('market.order.disputeNote')} />
          <DialogFooter><Button disabled={pending || !note.trim()} onClick={() => run(() => escalateAction(orderId, note), t('market.order.escalated'), () => setOpen(false))} data-send-escalate>{t('market.order.send')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
