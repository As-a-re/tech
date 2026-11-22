import { Baby, BookOpen, Church, Footprints, Headphones, Layers, Package, Shirt, Smartphone, Sofa, Sparkles, UtensilsCrossed, Wrench, type LucideIcon } from 'lucide-react'

/** Market categories (names in locales: market.cat.<key>). Kept in code so every install has the same list. */
export const CATEGORIES = [
  { key: 'fashion', icon: Shirt },
  { key: 'fabrics', icon: Layers },
  { key: 'shoes', icon: Footprints },
  { key: 'beauty', icon: Sparkles },
  { key: 'food', icon: UtensilsCrossed },
  { key: 'phones', icon: Smartphone },
  { key: 'electronics', icon: Headphones },
  { key: 'home', icon: Sofa },
  { key: 'books', icon: BookOpen },
  { key: 'kids', icon: Baby },
  { key: 'church', icon: Church },
  { key: 'services', icon: Wrench },
  { key: 'other', icon: Package },
] as const satisfies readonly { key: string; icon: LucideIcon }[]

export type CategoryKey = (typeof CATEGORIES)[number]['key']
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as CategoryKey[]
export const isCategory = (v: unknown): v is CategoryKey => typeof v === 'string' && (CATEGORY_KEYS as string[]).includes(v)

export const SORTS = ['best', 'newest', 'price_asc', 'price_desc', 'popular', 'rating'] as const
export type SortKey = (typeof SORTS)[number]

/** Order status steps shown on the tracking timeline (pickup orders say "ready for pickup" instead of "shipped"). */
export const ORDER_STEPS = ['paid', 'accepted', 'packed', 'shipped', 'delivered'] as const

/** "-25%" for a deal. */
export const percentOff = (price: number, was: number | null | undefined) => (was && was > price ? Math.round((1 - price / was) * 100) : 0)
