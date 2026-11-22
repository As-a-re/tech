import { getCurrentUser } from '@/server/identity/session'
import { searchAssemblies, searchHashtags, searchPeople } from '@/server/discovery/search'
import { listPublications } from '@/server/library/publications'
import { suggestProducts } from '@/server/market/catalog'
import { ghs } from '@/lib/give/money'

export const dynamic = 'force-dynamic'

/** Suggestions while typing in the search box: people, hashtags, assemblies, publications and Market products. */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 60)
  if (q.replace(/^[@#]/, '').length < 1) return Response.json({ people: [], tags: [], places: [], pubs: [], products: [] })
  const me = await getCurrentUser()
  const [people, tags, places, pubs, products] = await Promise.all([
    q.startsWith('#') ? [] : searchPeople(q, me?.id ?? null, 5),
    searchHashtags(q, q.startsWith('#') ? 8 : 3),
    q.startsWith('#') || q.startsWith('@') ? [] : searchAssemblies(q, 3),
    q.startsWith('#') || q.startsWith('@') || q.length < 2 ? { items: [] } : listPublications({ q }),
    q.startsWith('#') || q.startsWith('@') ? [] : suggestProducts(q, 3),
  ])
  return Response.json({
    people: people.map((p) => ({ username: p.username, fullName: p.full_name, avatarUrl: p.avatar_url, verified: p.verified, assembly: p.assembly_name })),
    tags: tags.map((x) => ({ tag: x.tag, posts: x.posts })),
    places: places.map((a) => ({ slug: a.slug, name: a.name, district: a.district_name })),
    pubs: pubs.items.slice(0, 3).map((p) => ({ id: p.id, title: p.title, edition: p.edition ?? p.seriesName, coverUrl: p.coverUrl })),
    products: products.map((p) => ({ id: p.id, title: p.title, price: ghs(p.pricePesewas), image: p.image, shop: p.shopName })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
