-- Atomically synchronize an external church register row and its district/assembly parents.
create or replace function public.papa_sync_church_member(
 p_church_id text,p_full_name text,p_phone text,p_active boolean,p_date_of_birth date,
 p_district_external_id text,p_district_name text,p_district_slug text,
 p_assembly_external_id text,p_assembly_name text,p_assembly_town text,p_assembly_slug text
) returns uuid language plpgsql security definer set search_path=public as $$
declare d_id uuid; a_id uuid;
begin
 insert into districts(external_id,name,slug) values(p_district_external_id,p_district_name,p_district_slug)
 on conflict(external_id) do update set name=excluded.name,slug=excluded.slug returning id into d_id;
 insert into assemblies(external_id,district_id,name,town,slug) values(p_assembly_external_id,d_id,p_assembly_name,p_assembly_town,p_assembly_slug)
 on conflict(external_id) do update set district_id=excluded.district_id,name=excluded.name,town=excluded.town,slug=excluded.slug returning id into a_id;
 insert into church_members(church_id,full_name,phone,assembly_id,active,date_of_birth,synced_at)
 values(p_church_id,p_full_name,p_phone,a_id,p_active,p_date_of_birth,now())
 on conflict(church_id) do update set full_name=excluded.full_name,phone=excluded.phone,assembly_id=excluded.assembly_id,active=excluded.active,date_of_birth=excluded.date_of_birth,synced_at=now();
 return a_id;
end $$;
revoke all on function public.papa_sync_church_member(text,text,text,boolean,date,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.papa_sync_church_member(text,text,text,boolean,date,text,text,text,text,text,text,text) to service_role;
