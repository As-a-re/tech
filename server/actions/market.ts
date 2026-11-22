'use server'

import { revalidatePath } from 'next/cache'
import { requireTechAdmin, requireUser } from '@/server/identity/session'
import { audit } from '@/server/identity/audit'
import * as catalog from '@/server/market/catalog'
import * as cart from '@/server/market/cart'
import * as orders from '@/server/market/orders'
import * as admin from '@/server/market/admin'
import * as seller from '@/server/market/seller'
import * as riders from '@/server/market/riders'
import * as payouts from '@/server/market/payouts'

/* ───── Browsing: wishlist, follow, alerts, questions ───── */
export async function wishlistAction(productId: string, on: boolean) {
  const me = await requireUser(`/market/p/${productId}`)
  const r = await catalog.setWishlist(me, productId, on)
  if (r.ok) revalidatePath('/market/wishlist')
  return r
}

export async function followShopAction(shopId: string, on: boolean) {
  const me = await requireUser('/market')
  return catalog.followShop(me, shopId, on)
}

export async function alertAction(productId: string, kind: 'stock' | 'price', on: boolean) {
  const me = await requireUser(`/market/p/${productId}`)
  return catalog.setAlert(me, productId, kind === 'price' ? 'price' : 'stock', on)
}

export async function askQuestionAction(productId: string, body: string) {
  const me = await requireUser(`/market/p/${productId}`)
  const r = await catalog.askQuestion(me, productId, body)
  if (r.ok) revalidatePath(`/market/p/${productId}`)
  return r
}

export async function answerQuestionAction(questionId: string, answer: string, productId: string) {
  const me = await requireUser()
  const r = await catalog.answerQuestion(me, questionId, answer)
  if (r.ok) revalidatePath(`/market/p/${productId}`)
  return r
}

export async function removeQuestionAction(questionId: string, productId: string) {
  const me = await requireUser()
  const ok = await catalog.removeQuestion(me, questionId)
  if (ok) { revalidatePath(`/market/p/${productId}`); if (me.role === 'tech_admin') await audit('admin.market_question_hidden', { actorId: me.id, target: questionId }) }
  return ok
}

export async function clearRecentAction() {
  const me = await requireUser()
  await catalog.clearRecentlyViewed(me.id)
  revalidatePath('/market')
}

/* ───── Cart and checkout ───── */
export async function addToCartAction(variantId: string, qty: number) {
  const me = await requireUser('/market')
  const r = await cart.addToCart(me, variantId, qty)
  if (r.ok) revalidatePath('/cart')
  return r
}

export async function setCartQtyAction(itemId: string, qty: number) {
  const me = await requireUser('/cart')
  const r = await cart.setCartQty(me, itemId, qty)
  revalidatePath('/cart')
  return r
}

export async function saveForLaterAction(itemId: string, saved: boolean) {
  const me = await requireUser('/cart')
  const r = await cart.saveForLater(me, itemId, saved)
  revalidatePath('/cart')
  return r
}

export async function quoteAction(choices: cart.CheckoutChoice[]) {
  const me = await requireUser('/market/checkout')
  const q = await cart.quoteCheckout(me, choices)
  return { groups: q.groups, totalPesewas: q.totalPesewas }
}

/** Returns where to pay. */
export async function placeOrderAction(choices: cart.CheckoutChoice[], address: cart.Address | null) {
  const me = await requireUser('/market/checkout')
  return cart.placeOrder(me, choices, address)
}

/* ───── Orders (buyer) ───── */
const touch = (id: string) => { revalidatePath(`/market/orders/${id}`); revalidatePath('/market/orders') }

export async function cancelOrderAction(orderId: string, reason: string, details?: string) {
  const me = await requireUser()
  const r = await orders.cancelOrder(me, orderId, reason, details)
  if (r.ok) touch(orderId)
  return r
}

export async function confirmReceivedAction(orderId: string) {
  const me = await requireUser()
  const ok = await orders.confirmReceived(me, orderId)
  if (ok) touch(orderId)
  return ok
}

export async function requestReturnAction(orderId: string, kind: 'return' | 'refund', reason: string, details?: string) {
  const me = await requireUser()
  const r = await orders.requestReturn(me, orderId, kind === 'refund' ? 'refund' : 'return', reason, details)
  if (r.ok) touch(orderId)
  return r
}

export async function withdrawRequestAction(requestId: string, orderId: string) {
  const me = await requireUser()
  const ok = await orders.withdrawRequest(me, requestId)
  if (ok) touch(orderId)
  return ok
}

export async function reviewAction(orderId: string, productId: string, rating: number, body: string) {
  const me = await requireUser()
  const r = await orders.writeReview(me, orderId, productId, rating, body)
  if (r.ok) { touch(orderId); revalidatePath(`/market/p/${productId}`) }
  return r
}

/* ───── Orders (seller: quick actions on the order page; the full dashboard comes with Batch 17) ───── */
export async function sellerStepAction(orderId: string, step: 'accept' | 'pack' | 'ship', note?: string) {
  const me = await requireUser()
  const r = await orders.sellerStep(me, orderId, step, note)
  if (r.ok) touch(orderId)
  return r
}

export async function handoverAction(orderId: string, code: string) {
  const me = await requireUser()
  const r = await orders.sellerHandover(me, orderId, code)
  if (r.ok) touch(orderId)
  return r
}

export async function sellerCancelAction(orderId: string, reason: string) {
  const me = await requireUser()
  const r = await orders.sellerCancel(me, orderId, reason)
  if (r.ok) touch(orderId)
  return r
}

export async function answerRequestAction(requestId: string, orderId: string, approve: boolean, response: string, refundGhs?: number | null) {
  const me = await requireUser()
  const r = await orders.answerRequest(me, requestId, approve, response, refundGhs != null ? Math.round(refundGhs * 100) : null)
  if (r.ok) { touch(orderId); revalidatePath('/admin/market', 'layout'); if (me.role === 'tech_admin') await audit(`admin.market_request_${approve ? 'approved' : 'declined'}`, { actorId: me.id, target: requestId }) }
  return r
}

export async function replyReviewAction(reviewId: string, reply: string, productId: string) {
  const me = await requireUser()
  const ok = await orders.replyToReview(me, reviewId, reply)
  if (ok) revalidatePath(`/market/p/${productId}`)
  return ok
}

/* ───── Tech Admins ───── */
export async function adminCancelOrderAction(orderId: string, reason: string) {
  const me = await requireTechAdmin('/admin/market')
  const ok = await orders.adminCancel(me, orderId, reason)
  if (ok) { touch(orderId); revalidatePath('/admin/market', 'layout'); await audit('admin.market_order_cancelled', { actorId: me.id, target: orderId, meta: { reason } }) }
  return ok
}

export async function adminRefundAction(orderId: string, amountGhs: number, note: string) {
  const me = await requireTechAdmin('/admin/market')
  const r = await orders.adminRefund(me, orderId, Math.round(amountGhs * 100), note)
  if (r.ok) { touch(orderId); revalidatePath('/admin/market', 'layout'); await audit('admin.market_refund', { actorId: me.id, target: orderId, meta: { amountGhs, note } }) }
  return r
}

export async function setProductStatusAction(productId: string, status: 'active' | 'removed') {
  const me = await requireTechAdmin('/admin/market')
  const ok = await admin.setProductStatus(productId, status)
  if (ok) { revalidatePath('/admin/market', 'layout'); revalidatePath(`/market/p/${productId}`); await audit(`admin.product_${status === 'removed' ? 'removed' : 'restored'}`, { actorId: me.id, target: productId }) }
  return ok
}

export async function setShopStatusAction(shopId: string, status: 'active' | 'suspended') {
  const me = await requireTechAdmin('/admin/market')
  const ok = await admin.setShopStatus(shopId, status)
  if (ok) { revalidatePath('/admin/market', 'layout'); await audit(`admin.shop_${status === 'suspended' ? 'suspended' : 'restored'}`, { actorId: me.id, target: shopId }) }
  return ok
}

export async function setShopVerifiedAction(shopId: string, verified: boolean) {
  const me = await requireTechAdmin('/admin/market')
  const ok = await admin.setShopVerified(shopId, verified)
  if (ok) { revalidatePath('/admin/market', 'layout'); await audit(`admin.shop_${verified ? 'verified' : 'unverified'}`, { actorId: me.id, target: shopId }) }
  return ok
}

export async function hideReviewAction(reviewId: string, productId: string) {
  const me = await requireTechAdmin('/admin/market')
  const ok = await orders.hideReview(reviewId)
  if (ok) { revalidatePath(`/market/p/${productId}`); await audit('admin.market_review_hidden', { actorId: me.id, target: reviewId }) }
  return ok
}

/* ───── Selling (Batch 17) ───── */

const sellPaths = () => { revalidatePath('/market/sell', 'layout'); revalidatePath('/market', 'layout') }

export async function openShopAction(input: seller.ShopInput) {
  const me = await requireUser('/market/sell/start')
  const r = await seller.openShop(me, input)
  if (r.ok) { sellPaths(); await audit('market.shop_opened', { actorId: me.id, target: r.slug }) }
  return r
}

export async function updateShopAction(input: seller.ShopInput) {
  const me = await requireUser('/market/sell/settings')
  const r = await seller.updateShop(me, input)
  if (r.ok) { sellPaths(); revalidatePath(`/market/shop/${r.slug}`) }
  return r
}

export async function pauseShopAction(paused: boolean) {
  const me = await requireUser('/market/sell/settings')
  const r = await seller.setShopPaused(me, paused)
  if (r.ok) sellPaths()
  return r
}

export async function closeShopAction() {
  const me = await requireUser('/market/sell/settings')
  const r = await seller.closeShop(me)
  if (r.ok) { sellPaths(); await audit('market.shop_closed', { actorId: me.id }) }
  return r
}

export async function saveProductAction(input: seller.ProductInput, id?: string) {
  const me = await requireUser('/market/sell/products')
  const r = await seller.saveProduct(me, input, id)
  if (r.ok) { sellPaths(); revalidatePath(`/market/p/${r.id}`) }
  return r
}

export async function listingStatusAction(productId: string, status: 'active' | 'draft') {
  const me = await requireUser('/market/sell/products')
  const r = await seller.setListingStatus(me, productId, status)
  if (r.ok) { sellPaths(); revalidatePath(`/market/p/${productId}`) }
  return r
}

export async function deleteListingAction(productId: string) {
  const me = await requireUser('/market/sell/products')
  const ok = await seller.deleteListing(me, productId)
  if (ok) sellPaths()
  return ok
}

export async function duplicateListingAction(productId: string) {
  const me = await requireUser('/market/sell/products')
  const r = await seller.duplicateListing(me, productId)
  if (r.ok) sellPaths()
  return r
}

export async function variantStockAction(variantId: string, stock: number) {
  const me = await requireUser('/market/sell/products')
  const ok = await seller.setVariantStock(me, variantId, stock)
  if (ok) sellPaths()
  return ok
}

export async function saveCouponAction(input: seller.CouponInput, id?: string) {
  const me = await requireUser('/market/sell/coupons')
  const r = await seller.saveCoupon(me, input, id)
  if (r.ok) revalidatePath('/market/sell/coupons')
  return r
}

export async function removeCouponAction(id: string) {
  const me = await requireUser('/market/sell/coupons')
  const ok = await seller.removeCoupon(me, id)
  if (ok) revalidatePath('/market/sell/coupons')
  return ok
}

export async function answerFromInboxAction(questionId: string, answer: string) {
  const me = await requireUser('/market/sell/questions')
  const r = await catalog.answerQuestion(me, questionId, answer)
  if (r.ok) revalidatePath('/market/sell', 'layout')
  return r
}

/* ───── Riders and payouts (Batch 18) ───── */
const rideP = () => { revalidatePath('/market/ride', 'layout') }

export async function applyRiderAction(input: riders.RiderInput) {
  const me = await requireUser('/market/ride')
  const r = await riders.applyRider(me, input)
  if (r.ok) { rideP(); revalidatePath('/admin/market'); await audit('market.rider_applied', { actorId: me.id }) }
  return r
}

export async function updateRiderAction(input: riders.RiderInput) {
  const me = await requireUser('/market/ride/settings')
  const r = await riders.updateRider(me, input)
  if (r.ok) rideP()
  return r
}

export async function riderAvailableAction(available: boolean) {
  const me = await requireUser('/market/ride')
  const ok = await riders.setAvailable(me, available)
  if (ok) rideP()
  return ok
}

export async function requestRiderAction(orderId: string, feeGhs: number, note?: string) {
  const me = await requireUser()
  const r = await riders.requestRider(me, orderId, feeGhs, note)
  if (r.ok) { touch(orderId); rideP() }
  return r
}

export async function cancelRiderAction(orderId: string) {
  const me = await requireUser()
  const ok = await riders.cancelRider(me, orderId)
  if (ok) { touch(orderId); rideP() }
  return ok
}

export async function jobAction(id: string, step: 'accept' | 'drop' | 'pickup') {
  const me = await requireUser('/market/ride')
  const r = step === 'accept' ? await riders.acceptJob(me, id) : { ok: step === 'drop' ? await riders.dropJob(me, id) : await riders.pickUp(me, id), error: 'state' as const }
  if (r.ok) rideP()
  return r
}

export async function deliverJobAction(id: string, code: string) {
  const me = await requireUser('/market/ride')
  const r = await riders.deliver(me, id, code)
  if (r.ok) rideP()
  return r
}

export async function escalateAction(orderId: string, note: string) {
  const me = await requireUser()
  const r = await orders.escalateRequest(me, orderId, note)
  if (r.ok) { touch(orderId); revalidatePath('/admin/market', 'layout') }
  return r
}

export async function riderStatusAction(riderId: string, status: 'active' | 'paused' | 'rejected' | 'suspended', note?: string) {
  const me = await requireTechAdmin('/admin/market')
  const ok = await riders.setRiderStatus(me, riderId, status, note)
  if (ok) { revalidatePath('/admin/market', 'layout'); await audit(`admin.rider_${status}`, { actorId: me.id, target: riderId }) }
  return ok
}

export async function retryPayoutAction(id: string) {
  const me = await requireTechAdmin('/admin/market')
  const ok = await payouts.retryPayout(me, id)
  if (ok) { revalidatePath('/admin/market', 'layout'); await audit('admin.payout_retried', { actorId: me.id, target: id }) }
  return ok
}

export async function markPaidAction(id: string, note: string) {
  const me = await requireTechAdmin('/admin/market')
  const ok = await payouts.markPaid(me, id, note)
  if (ok) { revalidatePath('/admin/market', 'layout'); await audit('admin.payout_marked_paid', { actorId: me.id, target: id, meta: { note } }) }
  return ok
}
