-- TBA Office / Desktop v1: shared office root plus a document tree per project.
-- Files remain in a private Supabase Storage bucket; no client binaries in GitHub.
-- All active office members may read every project and the office-wide Desktop.
-- Creation is open to active members; rename/delete metadata is owner-or-admin only.

create table public.minds_work_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.office_projects(id) on delete cascade,
  parent_id uuid references public.minds_work_folders(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 180),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (project_id, parent_id, name)
);
create index minds_work_folders_project_idx on public.minds_work_folders(project_id, parent_id, sort_order);

create table public.minds_work_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.office_projects(id) on delete cascade,
  folder_id uuid references public.minds_work_folders(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 255),
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes >= 0),
  storage_path text not null unique check (length(storage_path) > 38),
  source_kind text not null default 'file',
  index_status text not null default 'stored',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index minds_work_files_folder_idx on public.minds_work_files(project_id, folder_id, created_at desc);
create index minds_work_files_user_idx on public.minds_work_files(user_id);

-- A folder never changes project scope. Moves cannot create cycles.
-- including office-root (null-project) folders attached to project documents.
create function public.office_desktop_folder_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.project_id is distinct from old.project_id
       or new.created_at is distinct from old.created_at then
      raise exception 'office_folder_scope_immutable' using errcode = '23514';
    end if;
    if new.parent_id is distinct from old.parent_id and exists (
      with recursive ancestors(id, parent_id) as (
        select p.id, p.parent_id from public.minds_work_folders p where p.id = new.parent_id
        union all
        select p.id, p.parent_id from public.minds_work_folders p join ancestors a on p.id = a.parent_id
      )
      select 1 from ancestors where id = new.id
    ) then raise exception 'office_folder_cycle' using errcode = '23514'; end if;
    new.updated_at := now();
  end if;
  if new.parent_id is not null and not exists (
    select 1 from public.minds_work_folders p
    where p.id = new.parent_id
      and p.project_id is not distinct from new.project_id
  ) then
    raise exception 'office_folder_parent_scope' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.office_desktop_folder_guard() from public, anon, authenticated;
create trigger office_desktop_folder_guard before insert or update on public.minds_work_folders
  for each row execute function public.office_desktop_folder_guard();

create function public.office_desktop_file_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
       or new.project_id is distinct from old.project_id
       or new.storage_path is distinct from old.storage_path
       or new.size_bytes is distinct from old.size_bytes
       or new.created_at is distinct from old.created_at then
      raise exception 'office_file_scope_immutable' using errcode = '23514';
    end if;
    new.updated_at := now();
  end if;
  if new.folder_id is not null and not exists (
    select 1 from public.minds_work_folders p
    where p.id = new.folder_id
      and p.project_id is not distinct from new.project_id
  ) then
    raise exception 'office_file_folder_scope' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.office_desktop_file_guard() from public, anon, authenticated;
create trigger office_desktop_file_guard before insert or update on public.minds_work_files
  for each row execute function public.office_desktop_file_guard();

alter table public.minds_work_folders enable row level security;
alter table public.minds_work_files enable row level security;
revoke all on public.minds_work_folders, public.minds_work_files from public, anon, authenticated;
grant select, insert, update, delete on public.minds_work_folders, public.minds_work_files to authenticated;

create policy office_folders_read on public.minds_work_folders for select to authenticated
  using ((select private.office_is_member()));
create policy office_folders_insert on public.minds_work_folders for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.office_is_member())
    and (project_id is null or exists (
      select 1 from public.office_projects p where p.id = project_id and p.status = 'aktiv'
    )));
create policy office_folders_update on public.minds_work_folders for update to authenticated
  using ((select private.office_is_member())
    and (user_id = (select auth.uid()) or (select private.office_is_admin())))
  with check ((select private.office_is_member())
    and (user_id = (select auth.uid()) or (select private.office_is_admin())));
create policy office_folders_delete on public.minds_work_folders for delete to authenticated
  using ((select private.office_is_member())
    and (user_id = (select auth.uid()) or (select private.office_is_admin())));

create policy office_files_read on public.minds_work_files for select to authenticated
  using ((select private.office_is_member()));
create policy office_files_insert on public.minds_work_files for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.office_is_member())
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
    and (project_id is null or exists (
      select 1 from public.office_projects p where p.id = project_id and p.status = 'aktiv'
    )));
create policy office_files_update on public.minds_work_files for update to authenticated
  using ((select private.office_is_member())
    and (user_id = (select auth.uid()) or (select private.office_is_admin())))
  with check ((select private.office_is_member())
    and (user_id = (select auth.uid()) or (select private.office_is_admin())));
create policy office_files_delete on public.minds_work_files for delete to authenticated
  using ((select private.office_is_member())
    and (user_id = (select auth.uid()) or (select private.office_is_admin())));

insert into storage.buckets (id, name, public)
values ('minds-work', 'minds-work', false)
on conflict (id) do nothing;

-- Storage access is independent from metadata RLS. Keep BOTH private.
create policy office_work_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'minds-work' and (select private.office_is_member()));
create policy office_work_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'minds-work' and (select private.office_is_member())
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy office_work_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'minds-work' and (select private.office_is_member())
    and ((storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.office_is_admin())));
