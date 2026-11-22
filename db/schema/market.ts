import { sql } from 'drizzle-orm'
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './identity'
import { assemblies } from './church'

const ts = (n: string) => timestamp(n, { withTimezone: true })

/**
 * MARKET: members buy from one another. The buyer pays the platform (escrow), the seller is paid after
 * delivery is confirmed (Batch 18), minus the platform fee set by Tech Admins (platform setting marketFeePercent).
 * All money is whole pesewas.
 */

/* ───────── Shops ───────── */
export const shopStatus = pgEnum('shop_status', ['active', 'paused', 'suspended'])

/** One shop per member (Batch 17: "Become a seller"). */
export const shops = pgTable('shops', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  bio: text('bio').notNull().default(''),
  logoUrl: text('logo_url'),
  coverUrl: text('cover_url'),
  /** Where the shop is (for "near me"). */
  assemblyId: uuid('assembly_id').references(() => assemblies.id, { onDelete: 'set null' }),
  town: text('town'),
  phone: text('phone'),
  offersPickup: boolean('offers_pickup').default(true).notNull(),
  pickupAddress: text('pickup_address'),
  offersDelivery: boolean('offers_delivery').default(true).notNull(),
  /** Flat delivery fee per order. */
  deliveryFeePesewas: integer('delivery_fee_pesewas').default(0).notNull(),
  /** Free delivery when the items come to at least this much (null = never). */
  freeDeliveryOverPesewas: integer('free_delivery_over_pesewas'),
  /** e.g. "Accra and Tema, 1–3 days". */
  deliveryNote: text('delivery_note'),
  /** Days after delivery a buyer may ask to return (0 = no returns). */
  returnDays: integer('return_days').default(7).notNull(),
  status: shopStatus('status').default('active').notNull(),
  verifiedAt: ts('verified_at'),
  /** Where the seller is paid (Batch 18 pays out through Paystack Transfers): momo or bank. */
  payoutMethod: text('payout_method'),
  /** mtn | telecel | airteltigo, or the bank's name. */
  payoutProvider: text('payout_provider'),
  payoutNumber: text('payout_number'),
  payoutName: text('payout_name'),
  termsAcceptedAt: ts('terms_accepted_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
  deletedAt: ts('deleted_at'),
}, (t) => [uniqueIndex('shops_slug_idx').on(t.slug), uniqueIndex('shops_owner_idx').on(t.ownerId).where(sql`${t.deletedAt} is null`)])

export const shopFollows = pgTable('shop_follows', {
  shopId: uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.shopId, t.userId] }), index('shop_follows_user_idx').on(t.userId)])

/* ───────── Products ───────── */
export const productCondition = pgEnum('product_condition', ['new', 'used', 'refurbished'])
/** removed = taken down by a Tech Admin. */
export const productStatus = pgEnum('product_status', ['active', 'draft', 'removed'])

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopId: uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  /** One of lib/market/categories.ts. */
  category: text('category').notNull(),
  condition: productCondition('condition').default('new').notNull(),
  /** Up to 8 pictures; the first is the cover. */
  images: jsonb('images').$type<string[]>().default([]).notNull(),
  /** e.g. ["Size", "Colour"]; empty = no choices. */
  optionNames: jsonb('option_names').$type<string[]>().default([]).notNull(),
  /** Lowest variant price (kept up to date for listing and sorting). */
  pricePesewas: integer('price_pesewas').notNull(),
  /** "Was" price: higher than the price = a deal. */
  compareAtPesewas: integer('compare_at_pesewas'),
  dealEndsAt: ts('deal_ends_at'),
  ratingSum: integer('rating_sum').default(0).notNull(),
  ratingCount: integer('rating_count').default(0).notNull(),
  soldCount: integer('sold_count').default(0).notNull(),
  viewCount: integer('view_count').default(0).notNull(),
  status: productStatus('status').default('active').notNull(),
  /** First time it went on sale (followers of the shop are told once). */
  publishedAt: ts('published_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
  deletedAt: ts('deleted_at'),
}, (t) => [
  index('products_shop_idx').on(t.shopId),
  index('products_list_idx').on(t.status, t.category, t.createdAt).where(sql`${t.deletedAt} is null`),
])

/** Every product has at least one variant (a simple product has one with an empty name). Stock lives here. */
export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  /** e.g. "M / Blue"; '' for a product without choices. */
  name: text('name').notNull().default(''),
  /** e.g. { Size: "M", Colour: "Blue" }. */
  options: jsonb('options').$type<Record<string, string>>().default({}).notNull(),
  pricePesewas: integer('price_pesewas').notNull(),
  stock: integer('stock').default(0).notNull(),
  sku: text('sku'),
  position: integer('position').default(0).notNull(),
  active: boolean('active').default(true).notNull(),
}, (t) => [index('product_variants_product_idx').on(t.productId)])

export const productQuestions = pgTable('product_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  askerId: uuid('asker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  answer: text('answer'),
  answeredBy: uuid('answered_by').references(() => users.id, { onDelete: 'set null' }),
  answeredAt: ts('answered_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
  hiddenAt: ts('hidden_at'),
}, (t) => [index('product_questions_product_idx').on(t.productId, t.createdAt)])

/** One review per product per buyer (only after a delivered order); the buyer may edit it. */
export const productReviews = pgTable('product_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderId: uuid('order_id').references(() => marketOrders.id, { onDelete: 'set null' }),
  rating: integer('rating').notNull(),
  body: text('body').notNull().default(''),
  sellerReply: text('seller_reply'),
  sellerReplyAt: ts('seller_reply_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
  hiddenAt: ts('hidden_at'),
}, (t) => [uniqueIndex('product_reviews_one_idx').on(t.productId, t.userId), index('product_reviews_product_idx').on(t.productId, t.createdAt)])

export const wishlistItems = pgTable('wishlist_items', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.productId] })])

export const recentlyViewed = pgTable('recently_viewed', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  viewedAt: ts('viewed_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.productId] }), index('recently_viewed_user_idx').on(t.userId, t.viewedAt)])

/** "Tell me when it's back in stock" / "Tell me when the price drops". */
export const productAlertKind = pgEnum('product_alert_kind', ['stock', 'price'])
export const productAlerts = pgTable('product_alerts', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  kind: productAlertKind('kind').notNull(),
  /** Price when the alert was set (a drop below this notifies). */
  pricePesewas: integer('price_pesewas').notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
  notifiedAt: ts('notified_at'),
}, (t) => [primaryKey({ columns: [t.userId, t.productId, t.kind] }), index('product_alerts_product_idx').on(t.productId, t.kind)])

/* ───────── Cart ───────── */
export const cartItems = pgTable('cart_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  qty: integer('qty').default(1).notNull(),
  /** "Save for later": kept in the cart page but not checked out. */
  savedForLater: boolean('saved_for_later').default(false).notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('cart_items_one_idx').on(t.userId, t.variantId)])

/* ───────── Coupons (made by sellers in Batch 17) ───────── */
export const couponKind = pgEnum('coupon_kind', ['percent', 'amount'])
export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopId: uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  /** Upper case, e.g. WELCOME10. */
  code: text('code').notNull(),
  kind: couponKind('kind').notNull(),
  /** percent: 1–90; amount: pesewas off. */
  value: integer('value').notNull(),
  minSpendPesewas: integer('min_spend_pesewas').default(0).notNull(),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').default(0).notNull(),
  startsAt: ts('starts_at'),
  endsAt: ts('ends_at'),
  active: boolean('active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('coupons_code_idx').on(t.shopId, t.code)])

/* ───────── Orders ───────── */
/** One checkout = one payment, split into one order per shop. */
export const marketCheckouts = pgTable('market_checkouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  buyerId: uuid('buyer_id').references(() => users.id, { onDelete: 'set null' }),
  totalPesewas: integer('total_pesewas').notNull(),
  createdAt: ts('created_at').defaultNow().notNull(),
})

/**
 * pending_payment → paid (money held) → accepted → packed → shipped (or ready for pickup) → delivered → completed (seller paid, Batch 18).
 * cancelled at any point before delivery (refunded if paid).
 */
export const marketOrderStatus = pgEnum('market_order_status', ['pending_payment', 'paid', 'accepted', 'packed', 'shipped', 'delivered', 'completed', 'cancelled'])
export const fulfilment = pgEnum('fulfilment', ['delivery', 'pickup'])
export const escrowState = pgEnum('escrow_state', ['held', 'released', 'refunded'])

export const marketOrders = pgTable('market_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Shown to people, e.g. PM-7KQ2XD. */
  number: text('number').notNull(),
  checkoutId: uuid('checkout_id').references(() => marketCheckouts.id, { onDelete: 'set null' }),
  buyerId: uuid('buyer_id').references(() => users.id, { onDelete: 'set null' }),
  shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'set null' }),
  sellerId: uuid('seller_id').references(() => users.id, { onDelete: 'set null' }),
  /** Kept so the order still reads correctly if the shop changes or closes. */
  shopName: text('shop_name').notNull(),
  status: marketOrderStatus('status').default('pending_payment').notNull(),
  fulfilment: fulfilment('fulfilment').notNull(),
  recipientName: text('recipient_name'),
  phone: text('phone'),
  town: text('town'),
  address: text('address'),
  landmark: text('landmark'),
  note: text('note'),
  pickupAddress: text('pickup_address'),
  subtotalPesewas: integer('subtotal_pesewas').notNull(),
  deliveryFeePesewas: integer('delivery_fee_pesewas').default(0).notNull(),
  discountPesewas: integer('discount_pesewas').default(0).notNull(),
  totalPesewas: integer('total_pesewas').notNull(),
  /** Platform fee in basis points at the time of the order (250 = 2.5%). */
  feeBps: integer('fee_bps').default(0).notNull(),
  feePesewas: integer('fee_pesewas').default(0).notNull(),
  sellerNetPesewas: integer('seller_net_pesewas').default(0).notNull(),
  couponId: uuid('coupon_id').references(() => coupons.id, { onDelete: 'set null' }),
  couponCode: text('coupon_code'),
  escrow: escrowState('escrow'),
  refundedPesewas: integer('refunded_pesewas').default(0).notNull(),
  /** The buyer shows this at hand-over (pickup or delivery). */
  handoverCode: text('handover_code'),
  paidAt: ts('paid_at'),
  acceptedAt: ts('accepted_at'),
  packedAt: ts('packed_at'),
  shippedAt: ts('shipped_at'),
  deliveredAt: ts('delivered_at'),
  completedAt: ts('completed_at'),
  /** When the held money became the seller's (delivered + return period over, no open request). */
  releasedAt: ts('released_at'),
  /** What the seller pays a PAPA rider for this delivery (taken from the seller's share). */
  riderFeePesewas: integer('rider_fee_pesewas').default(0).notNull(),
  sellerPayoutId: uuid('seller_payout_id'),
  cancelledAt: ts('cancelled_at'),
  cancelReason: text('cancel_reason'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('market_orders_number_idx').on(t.number),
  index('market_orders_buyer_idx').on(t.buyerId, t.createdAt),
  index('market_orders_shop_idx').on(t.shopId, t.status),
  index('market_orders_checkout_idx').on(t.checkoutId),
])

export const marketOrderItems = pgTable('market_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => marketOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  variantName: text('variant_name').notNull().default(''),
  image: text('image'),
  unitPesewas: integer('unit_pesewas').notNull(),
  qty: integer('qty').notNull(),
  totalPesewas: integer('total_pesewas').notNull(),
}, (t) => [index('market_order_items_order_idx').on(t.orderId), index('market_order_items_product_idx').on(t.productId)])

/** The tracking timeline: placed, paid, accepted, packed, shipped, delivered, cancelled, refunded, requests… */
export const marketOrderEvents = pgTable('market_order_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => marketOrders.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  note: text('note'),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [index('market_order_events_order_idx').on(t.orderId, t.createdAt)])

/** Buyer asks to cancel (after the seller accepted), return or get a refund. The seller (Batch 17) or a Tech Admin answers. */
export const marketRequestKind = pgEnum('market_request_kind', ['cancel', 'return', 'refund'])
/** escalated = the seller declined and the buyer asked a Tech Admin to decide (dispute). */
export const marketRequestStatus = pgEnum('market_request_status', ['open', 'approved', 'declined', 'withdrawn', 'escalated'])
export const marketRequests = pgTable('market_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => marketOrders.id, { onDelete: 'cascade' }),
  buyerId: uuid('buyer_id').references(() => users.id, { onDelete: 'set null' }),
  kind: marketRequestKind('kind').notNull(),
  reason: text('reason').notNull(),
  details: text('details'),
  status: marketRequestStatus('status').default('open').notNull(),
  escalatedAt: ts('escalated_at'),
  /** The buyer's reason for asking a Tech Admin to decide. */
  escalationNote: text('escalation_note'),
  response: text('response'),
  refundPesewas: integer('refund_pesewas'),
  handledBy: uuid('handled_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
  resolvedAt: ts('resolved_at'),
}, (t) => [index('market_requests_order_idx').on(t.orderId), index('market_requests_status_idx').on(t.status, t.createdAt)])

/* ───────── Riders (Batch 18) ───────── */
export const vehicleKind = pgEnum('vehicle_kind', ['motorbike', 'car', 'bicycle', 'foot'])
export const riderStatus = pgEnum('rider_status', ['pending', 'active', 'paused', 'rejected', 'suspended'])

/** A member who delivers Market orders. Tech Admins approve them. */
export const riders = pgTable('riders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  phone: text('phone').notNull(),
  vehicle: vehicleKind('vehicle').notNull(),
  plate: text('plate'),
  /** Towns and areas covered, e.g. ["Osu", "Labone", "Cantonments"]. */
  areas: jsonb('areas').$type<string[]>().default([]).notNull(),
  about: text('about'),
  /** Mobile money for payouts. */
  payoutProvider: text('payout_provider'),
  payoutNumber: text('payout_number'),
  payoutName: text('payout_name'),
  status: riderStatus('status').default('pending').notNull(),
  /** Riders on a break don't see new jobs. */
  available: boolean('available').default(true).notNull(),
  note: text('note'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: ts('reviewed_at'),
  createdAt: ts('created_at').defaultNow().notNull(),
}, (t) => [uniqueIndex('riders_user_idx').on(t.userId), index('riders_status_idx').on(t.status)])

/** open → accepted (a rider took it) → picked_up → delivered (buyer's code checked); or cancelled. */
export const deliveryStatus = pgEnum('delivery_status', ['open', 'accepted', 'picked_up', 'delivered', 'cancelled'])

/** A delivery job for one Market order, offered to riders by the seller. */
export const deliveries = pgTable('deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => marketOrders.id, { onDelete: 'cascade' }),
  shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'set null' }),
  riderId: uuid('rider_id').references(() => riders.id, { onDelete: 'set null' }),
  status: deliveryStatus('status').default('open').notNull(),
  feePesewas: integer('fee_pesewas').notNull(),
  pickupTown: text('pickup_town'),
  pickupAddress: text('pickup_address').notNull(),
  dropoffTown: text('dropoff_town'),
  dropoffAddress: text('dropoff_address').notNull(),
  note: text('note'),
  payoutId: uuid('payout_id'),
  createdAt: ts('created_at').defaultNow().notNull(),
  acceptedAt: ts('accepted_at'),
  pickedUpAt: ts('picked_up_at'),
  deliveredAt: ts('delivered_at'),
  cancelledAt: ts('cancelled_at'),
}, (t) => [index('deliveries_status_idx').on(t.status, t.createdAt), index('deliveries_rider_idx').on(t.riderId, t.status), index('deliveries_order_idx').on(t.orderId)])

/* ───────── Payouts (Batch 18) ───────── */
export const payoutKind = pgEnum('payout_kind', ['seller', 'rider'])
/** pending = waiting to send; processing = sent to the provider; manual = a Tech Admin pays by hand (bank accounts). */
export const payoutStatus = pgEnum('payout_status', ['pending', 'processing', 'paid', 'failed', 'manual'])

/** Money PAPA sends to a seller (released orders) or a rider (finished deliveries). */
export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  reference: text('reference').notNull(),
  kind: payoutKind('kind').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  shopId: uuid('shop_id').references(() => shops.id, { onDelete: 'set null' }),
  riderId: uuid('rider_id').references(() => riders.id, { onDelete: 'set null' }),
  amountPesewas: integer('amount_pesewas').notNull(),
  /** Where it went, copied at the time: momo or bank, provider, number, name. */
  method: text('method').notNull(),
  provider: text('provider'),
  number: text('number'),
  name: text('name'),
  status: payoutStatus('status').default('pending').notNull(),
  providerRef: text('provider_ref'),
  failureReason: text('failure_reason'),
  attempts: integer('attempts').default(0).notNull(),
  handledBy: uuid('handled_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: ts('created_at').defaultNow().notNull(),
  paidAt: ts('paid_at'),
}, (t) => [uniqueIndex('payouts_reference_idx').on(t.reference), index('payouts_status_idx').on(t.status, t.createdAt), index('payouts_user_idx').on(t.userId, t.createdAt)])
