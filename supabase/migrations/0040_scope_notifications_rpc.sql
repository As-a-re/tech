create or replace function public.papa_notify_scope(
 p_key text,p_type text,p_actor_id uuid,p_announcement_id uuid default null,p_event_id uuid default null,p_live_id uuid default null
) returns table(user_id uuid) language plpgsql security definer set search_path=public as $$
begin
 if p_type not in ('announcement','event','live') then raise exception 'invalid_notification_type'; end if;
 if p_key<>'national' and p_key !~ '^[da]:[0-9a-fA-F-]{36}$' then raise exception 'invalid_scope_key'; end if;
 return query insert into notifications(user_id,type,actor_id,announcement_id,event_id,live_id)
 select u.id,p_type::notification_type,p_actor_id,p_announcement_id,p_event_id,p_live_id
 from users u left join notification_settings ns on ns.user_id=u.id
 where u.status='active' and u.id<>p_actor_id
 and coalesce((select ls.on from level_subscriptions ls where ls.user_id=u.id and ls.scope=p_key),
   case when p_key='national' then true when left(p_key,2)='d:' then exists(select 1 from assemblies a where a.id=u.assembly_id and a.district_id=substring(p_key from 3)::uuid) else u.assembly_id=substring(p_key from 3)::uuid end)
 and coalesce((ns.prefs->p_type->>'inApp')::boolean,true)
 and not exists(select 1 from blocks b where (b.blocker_id=u.id and b.blocked_id=p_actor_id) or (b.blocker_id=p_actor_id and b.blocked_id=u.id))
 and not exists(select 1 from mutes m where m.muter_id=u.id and m.muted_id=p_actor_id)
 returning notifications.user_id;
end $$;

create or replace function public.papa_scope_push_subscriptions(p_key text,p_type text,p_actor_id uuid)
returns table(id uuid,endpoint text,p256dh text,auth text)
language sql stable security definer set search_path=public as $$
 select s.id,s.endpoint,s.p256dh,s.auth from push_subscriptions s join users u on u.id=s.user_id
 left join notification_settings ns on ns.user_id=u.id
 where u.status='active' and u.id<>p_actor_id
 and coalesce((select ls.on from level_subscriptions ls where ls.user_id=u.id and ls.scope=p_key),
   case when p_key='national' then true when left(p_key,2)='d:' then exists(select 1 from assemblies a where a.id=u.assembly_id and a.district_id=substring(p_key from 3)::uuid) else u.assembly_id=substring(p_key from 3)::uuid end)
 and coalesce((ns.prefs->p_type->>'push')::boolean,true)
 and not exists(select 1 from blocks b where (b.blocker_id=u.id and b.blocked_id=p_actor_id) or (b.blocker_id=p_actor_id and b.blocked_id=u.id))
 and not exists(select 1 from mutes m where m.muter_id=u.id and m.muted_id=p_actor_id)
$$;
revoke all on function public.papa_notify_scope(text,text,uuid,uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.papa_scope_push_subscriptions(text,text,uuid) from public,anon,authenticated;
grant execute on function public.papa_notify_scope(text,text,uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.papa_scope_push_subscriptions(text,text,uuid) to service_role;
