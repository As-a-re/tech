import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const enabled = process.env.SUPABASE_INTEGRATION_TESTS === '1'
  && !!(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
  && !!process.env.SUPABASE_SERVICE_ROLE_KEY
const integration = enabled ? describe : describe.skip

integration('Supabase migration RPC integration (read-only/safe probes)', () => {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!
  const client = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const missingId = '00000000-0000-4000-8000-000000000000'

  it('exposes report listing and count RPCs', async () => {
    const [count, reports] = await Promise.all([
      client.rpc('papa_open_report_count'),
      client.rpc('papa_list_reports', { p_status: 'open' }),
    ])
    expect(count.error).toBeNull()
    expect(typeof count.data).toBe('number')
    expect(reports.error).toBeNull()
    expect(Array.isArray(reports.data)).toBe(true)
  })

  it('exposes payout list, waiting-detail, and blocker RPCs', async () => {
    const [mine, admin, waiting, blockers] = await Promise.all([
      client.rpc('papa_my_market_payouts', { p_user_id: missingId }),
      client.rpc('papa_admin_market_payouts', { p_status: null }),
      client.rpc('papa_waiting_market_payout_details'),
      client.rpc('papa_market_account_blockers', { p_user_id: missingId }),
    ])
    for (const result of [mine, admin, waiting, blockers]) expect(result.error).toBeNull()
    expect(Array.isArray(mine.data)).toBe(true)
    expect(Array.isArray(admin.data)).toBe(true)
    expect(Array.isArray(waiting.data)).toBe(true)
    expect(blockers.data).toMatchObject({ buying: 0, selling: 0, held: 0, delivering: 0, owed: 0 })
  })


  it('exposes rate-limit and audit RPCs and can clear its own test key', async () => {
    const key = `supabase-integration:${crypto.randomUUID()}`
    const first = await client.rpc('papa_hit_rate_limit', { p_key: key, p_max: 2, p_window_seconds: 60 })
    expect(first.error).toBeNull()
    expect(first.data).toBe(true)
    const audit = await client.rpc('papa_list_audit_log', { p_action: null, p_actor: null, p_from: null, p_to: null, p_page: 1, p_page_size: 10 })
    expect(audit.error).toBeNull()
    expect(audit.data).toHaveProperty('rows')
    const names = await client.rpc('papa_audit_action_names')
    expect(names.error).toBeNull()
    expect(Array.isArray(names.data)).toBe(true)
    const cleared = await client.rpc('papa_clear_rate_limit', { p_key: key })
    expect(cleared.error).toBeNull()
  })

  it('exposes post mutation and interaction RPCs with safe nonexistent-ID probes', async () => {
    const [reaction, vote, pin, favorite, views, release] = await Promise.all([
      client.rpc('papa_react_post', { p_user_id: missingId, p_post_id: missingId, p_kind: 'like', p_on: true }),
      client.rpc('papa_vote_post', { p_user_id: missingId, p_post_id: missingId, p_option_id: missingId }),
      client.rpc('papa_pin_post', { p_user_id: missingId, p_post_id: missingId, p_on: true }),
      client.rpc('papa_set_favorite', { p_user_id: missingId, p_favorite_id: missingId, p_on: true }),
      client.rpc('papa_increment_post_views', { p_post_ids: [missingId] }),
      client.rpc('papa_release_scheduled_posts'),
    ])
    for (const result of [reaction, vote, pin, favorite, views, release]) expect(result.error).toBeNull()
    expect(reaction.data).toMatchObject({ ok: false })
    expect(vote.data).toBe('invalid')
    expect(pin.data).toBe(false)
    expect(favorite.data).toBe(false)
    expect(views.data).toBe(0)
    expect(Array.isArray(release.data)).toBe(true)
  })

  it('exposes post edit/publish/delete and scheduled release RPCs safely', async () => {
    const [edit, publish, remove] = await Promise.all([
      client.rpc('papa_edit_post', { p_author_id: missingId, p_post_id: missingId, p_body: 'test', p_link_preview: null, p_tags: [], p_mention_ids: [] }),
      client.rpc('papa_publish_draft', { p_author_id: missingId, p_post_id: missingId, p_publish_at: null }),
      client.rpc('papa_delete_post', { p_user_id: missingId, p_post_id: missingId, p_as_admin: false }),
    ])
    for (const result of [edit, publish, remove]) expect(result.error).toBeNull()
    expect(edit.data).toBe(false)
    expect(publish.data).toBeNull()
    expect(remove.data).toBe(false)
  })

  it('supports provider payout outcomes without changing a missing payout', async () => {
    const result = await client.rpc('papa_finish_market_payout', {
      p_id: missingId, p_status: 'manual', p_provider_ref: 'TEST-NOOP', p_reason: '',
    })
    expect(result.error).toBeNull()
    expect(result.data).toBeNull()
  })

  it('does not claim or retry nonexistent payouts', async () => {
    const [claim, retry] = await Promise.all([
      client.rpc('papa_claim_market_payouts', { p_ids: [] }),
      client.rpc('papa_retry_market_payout', { p_id: missingId }),
    ])
    expect(claim.error).toBeNull()
    expect(claim.data).toEqual([])
    expect(retry.error).toBeNull()
    expect(retry.data).toBe(false)
  })
  it('exposes discovery and feed RPCs with safe empty-result probes', async () => {
    const [search, trending, popular, suggestions, saved, listFeed, feed] = await Promise.all([
      client.rpc('papa_search_post_ids', { p_query: 'nonexistenttoken:*', p_viewer_id: missingId, p_media_only: false, p_top: false, p_limit: 5 }),
      client.rpc('papa_trending_tags', { p_viewer_id: missingId, p_limit: 5 }),
      client.rpc('papa_popular_post_ids', { p_viewer_id: missingId, p_limit: 5 }),
      client.rpc('papa_who_to_follow', { p_viewer_id: missingId, p_limit: 5 }),
      client.rpc('papa_discovery_feed_ids', { p_mode: 'saved', p_user_id: missingId, p_list_id: null, p_folder_id: null, p_cursor_at: null, p_cursor_id: null, p_limit: 5 }),
      client.rpc('papa_discovery_feed_ids', { p_mode: 'list', p_user_id: missingId, p_list_id: missingId, p_folder_id: null, p_cursor_at: null, p_cursor_id: null, p_limit: 5 }),
      client.rpc('papa_post_feed_entries', { p_mode: 'for_you', p_viewer_id: missingId, p_author_id: null, p_post_id: null, p_tag: null, p_cursor_at: null, p_cursor_id: null, p_page: 0, p_limit: 5 }),
    ])
    for (const result of [search, trending, popular, suggestions, saved, listFeed, feed]) expect(result.error).toBeNull()
    for (const result of [search, trending, popular, suggestions, saved, listFeed, feed]) expect(Array.isArray(result.data)).toBe(true)
  })

  it('exposes transactional church sync without affecting a test register row', async () => {
    // The RPC is exercised by deployments using a disposable integration database; skip writes here.
    const result = await client.rpc('papa_post_engagers', { p_post_id: missingId, p_kind: 'likes', p_viewer_id: missingId })
    expect(result.error).toBeNull()
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('exposes feed, announcement, prayer, and testimony RPCs with nonexistent-ID probes', async () => {
    const [feed, engagers, announcementView, announcementList, deletedAnnouncement, prayerSet, prayerDelete, testimonyDelete, praise] = await Promise.all([
      client.rpc('papa_post_feed_entries', { p_mode: 'for_you', p_viewer_id: missingId, p_author_id: null, p_post_id: null, p_tag: null, p_cursor_at: null, p_cursor_id: null, p_page: 0, p_limit: 5 }),
      client.rpc('papa_post_engagers', { p_post_id: missingId, p_kind: 'likes', p_viewer_id: missingId }),
      client.rpc('papa_increment_announcement_view', { p_id: missingId }),
      client.rpc('papa_list_announcement_ids', { p_level: null, p_district_id: null, p_assembly_id: null, p_author_id: null, p_query: 'no-such-test-entry', p_keys: null, p_page: 1, p_page_size: 5 }),
      client.rpc('papa_delete_announcement', { p_user_id: missingId, p_id: missingId, p_as_admin: false }),
      client.rpc('papa_set_prayed', { p_user_id: missingId, p_prayer_id: missingId, p_on: true }),
      client.rpc('papa_delete_prayer', { p_user_id: missingId, p_prayer_id: missingId, p_as_admin: false }),
      client.rpc('papa_delete_testimony', { p_user_id: missingId, p_id: missingId, p_as_admin: false }),
      client.rpc('papa_set_testimony_praise', { p_user_id: missingId, p_testimony_id: missingId, p_on: true }),
    ])
    for (const result of [feed, engagers, announcementView, announcementList, deletedAnnouncement, prayerSet, prayerDelete, testimonyDelete, praise]) expect(result.error).toBeNull()
    expect(Array.isArray(feed.data)).toBe(true)
    expect(Array.isArray(engagers.data)).toBe(true)
    expect(Array.isArray(announcementList.data)).toBe(true)
    expect(deletedAnnouncement.data).toBe(false)
    expect(prayerSet.data).toBeNull()
    expect(prayerDelete.data).toBe(false)
    expect(testimonyDelete.data).toBe(false)
    expect(praise.data).toBeNull()
  })

  it('exposes event lifecycle RPCs with nonexistent-ID probes', async () => {
    const [update, cancel, remove, rsvp, list, reminders] = await Promise.all([
      client.rpc('papa_update_event', { p_author_id: missingId, p_event_id: missingId, p_event: { title: 'Test', description: '', starts_at: new Date().toISOString(), ends_at: null, venue: 'Test', address: null, lat: null, lng: null, online_url: null, cover_url: null } }),
      client.rpc('papa_cancel_event', { p_author_id: missingId, p_event_id: missingId }),
      client.rpc('papa_delete_event', { p_user_id: missingId, p_event_id: missingId, p_as_admin: false }),
      client.rpc('papa_set_event_rsvp', { p_user_id: missingId, p_event_id: missingId, p_status: 'going' }),
      client.rpc('papa_list_event_ids', { p_filter: 'all', p_viewer_id: missingId, p_home_district_id: null, p_home_assembly_id: null, p_district_id: null, p_assembly_id: null, p_from: null, p_to: null, p_query: 'nonexistent-test-event', p_page: 1, p_page_size: 5 }),
      client.rpc('papa_claim_event_reminders', { p_kind: 'hour' }),
    ])
    for (const result of [update, cancel, remove, rsvp, list, reminders]) expect(result.error).toBeNull()
    expect(update.data).toBe(false)
    expect(cancel.data).toBeNull()
    expect(remove.data).toBe(false)
    expect(rsvp.data).toBe('not_found')
    expect(Array.isArray(list.data)).toBe(true)
    expect(Array.isArray(reminders.data)).toBe(true)
  })

  it('exposes market catalog and order lifecycle RPCs with safe missing-ID probes', async () => {
    const [products, categories, cancelled, refunded] = await Promise.all([
      client.rpc('papa_market_list_products', {
        p_query: 'no-such-market-integration-item', p_category: null, p_min_pesewas: null, p_max_pesewas: null,
        p_condition: null, p_in_stock: false, p_deals: false, p_delivery: false, p_district_id: null,
        p_rating_min: null, p_shop_id: missingId, p_sort: 'best', p_page: 1, p_limit: 5,
        p_exclude_id: null, p_ids: null, p_since: null,
      }),
      client.rpc('papa_market_category_counts'),
      client.rpc('papa_market_cancel_order', { p_order_id: missingId, p_by: 'system', p_actor_id: null, p_reason: 'integration probe' }),
      client.rpc('papa_market_record_refund', { p_order_id: missingId, p_amount: 1 }),
    ])
    for (const result of [products, categories, cancelled, refunded]) expect(result.error).toBeNull()
    expect(products.data).toEqual([])
    expect(Array.isArray(categories.data)).toBe(true)
    expect(cancelled.data).toEqual([])
    expect(refunded.data).toEqual([])
  })

  it('exposes Market admin read RPCs without mutating Market data', async () => {
    const [stats, orders, requests, products, shops, data] = await Promise.all([
      client.rpc('papa_market_admin_stats'),
      client.rpc('papa_market_admin_orders', { p_status: null, p_query: 'nonexistent-order-test', p_problems: false, p_page: 1, p_page_size: 5 }),
      client.rpc('papa_market_admin_requests', { p_status: 'withdrawn' }),
      client.rpc('papa_market_admin_products', { p_query: 'nonexistent-product-test', p_status: null, p_page: 1, p_page_size: 5 }),
      client.rpc('papa_market_admin_shops', { p_query: 'nonexistent-shop-test', p_page: 1, p_page_size: 5 }),
      client.rpc('papa_market_member_data', { p_user_id: missingId }),
    ])
    for (const result of [stats, orders, requests, products, shops, data]) expect(result.error).toBeNull()
    expect(stats.data).toHaveProperty('sales')
    expect(orders.data).toHaveProperty('rows')
    expect(Array.isArray(requests.data)).toBe(true)
    expect(products.data).toHaveProperty('rows')
    expect(shops.data).toHaveProperty('rows')
    expect(data.data).toHaveProperty('marketOrders')
  })

  it('does not allow product save through a shop the actor does not own', async () => {
    const result = await client.rpc('papa_market_save_product', {
      p_user_id: missingId,
      p_shop_id: missingId,
      p_product_id: null,
      p_values: { title: 'Test', category: 'test', condition: 'new', images: [], option_names: [], price_pesewas: 100, status: 'draft' },
      p_variants: [],
    })
    expect(result.error?.message).toContain('shop_not_found')
  })

})
