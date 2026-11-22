-- Stable cursor-paged feed IDs for list membership and saved-post folders.
create or replace function public.papa_discovery_feed_ids(
 p_mode text, p_user_id uuid, p_list_id uuid default null, p_folder_id text default null,
 p_cursor_at timestamptz default null, p_cursor_id uuid default null, p_limit integer default 20
) returns table(id uuid, at timestamptz, folder_id uuid)
language plpgsql stable security definer set search_path=public as $$
begin
 if p_mode not in ('list','saved') then raise exception 'invalid_mode'; end if;
 if p_mode='list' and p_list_id is null then raise exception 'list_required'; end if;
 if p_mode='saved' and p_user_id is null then raise exception 'user_required'; end if;
 return query
 select p.id, case when p_mode='saved' then b.created_at else p.published_at end,
   case when p_mode='saved' then b.folder_id else null::uuid end
 from posts p join users u on u.id=p.author_id
 left join user_preferences pr on pr.user_id=p.author_id
 left join bookmarks b on p_mode='saved' and b.post_id=p.id and b.user_id=p_user_id
 where p.deleted_at is null and p.is_draft=false and p.published_at<=now() and u.status='active'
  and (p_mode='list' and p.author_id in(select lm.user_id from list_members lm where lm.list_id=p_list_id)
    or p_mode='saved' and b.post_id is not null
      and (p_folder_id is null or p_folder_id='all' or (p_folder_id='none' and b.folder_id is null) or b.folder_id::text=p_folder_id))
  and (coalesce(pr.private_profile,false)=false or p.author_id=p_user_id or exists(select 1 from follows f where f.follower_id=p_user_id and f.followee_id=p.author_id))
  and not exists(select 1 from blocks bl where (bl.blocker_id=p_user_id and bl.blocked_id=p.author_id) or (bl.blocker_id=p.author_id and bl.blocked_id=p_user_id))
  and not exists(select 1 from mutes m where m.muter_id=p_user_id and m.muted_id=p.author_id)
  and (p_cursor_at is null or (case when p_mode='saved' then b.created_at else p.published_at end,p.id)<(p_cursor_at,p_cursor_id))
 order by case when p_mode='saved' then b.created_at else p.published_at end desc,p.id desc
 limit least(100,greatest(1,coalesce(p_limit,20)));
end $$;
revoke all on function public.papa_discovery_feed_ids(text,uuid,uuid,text,timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.papa_discovery_feed_ids(text,uuid,uuid,text,timestamptz,uuid,integer) to service_role;
