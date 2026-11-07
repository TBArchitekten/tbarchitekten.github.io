-- Office Terminplan: private, reusable source files owned by the uploading employee.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('office-plan-sources','office-plan-sources',false,8388608,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

create table public.office_terminplan_sources(
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.office_terminplan_instances(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 storage_path text not null unique,
 file_name text not null check(length(file_name) between 1 and 180),
 mime text not null check(mime in ('application/pdf','image/jpeg','image/png','image/webp')),
 bytes bigint not null check(bytes between 1 and 8388608),
 created_at timestamptz not null default now(),
 check(storage_path like user_id::text||'/'||plan_id::text||'/%')
);
create index office_plan_sources_owner_plan_idx on public.office_terminplan_sources(user_id,plan_id,created_at desc);
alter table public.office_terminplan_sources enable row level security;
grant select,insert,delete on public.office_terminplan_sources to authenticated;
create policy office_plan_source_select on public.office_terminplan_sources for select to authenticated
 using(user_id=(select auth.uid()) and (select private.office_is_member())
   and exists(select 1 from public.office_terminplan_instances p where p.id=plan_id));
create policy office_plan_source_insert on public.office_terminplan_sources for insert to authenticated
 with check(user_id=(select auth.uid()) and (select private.office_is_member())
   and exists(select 1 from public.office_terminplan_instances p where p.id=plan_id));
create policy office_plan_source_delete on public.office_terminplan_sources for delete to authenticated
 using(user_id=(select auth.uid()) and (select private.office_is_member()));

create policy office_plan_storage_insert on storage.objects for insert to authenticated
 with check(bucket_id='office-plan-sources' and (select private.office_is_member())
   and (storage.foldername(name))[1]=(select auth.uid())::text
   and exists(select 1 from public.office_terminplan_instances p
     where p.id::text=(storage.foldername(name))[2]));
create policy office_plan_storage_select on storage.objects for select to authenticated
 using(bucket_id='office-plan-sources' and (select private.office_is_member())
   and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy office_plan_storage_delete on storage.objects for delete to authenticated
 using(bucket_id='office-plan-sources' and (select private.office_is_member())
   and (storage.foldername(name))[1]=(select auth.uid())::text);

-- No public read, no share to other employees, no upsert on source files.
comment on table public.office_terminplan_sources is
 'Employee-private persistent PDF/image sources for a particular Terminplan. The assistant may read them only using employee JWT RLS.';
