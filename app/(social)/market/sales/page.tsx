import { redirect } from 'next/navigation'

/** Old address (Batch 16): orders to my shop now live in the seller area. */
export default async function Sales({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams
  redirect(`/market/sell/orders${s ? `?s=${encodeURIComponent(s)}` : ''}`)
}
