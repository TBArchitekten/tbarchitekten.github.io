-- Romy phase 1: isolated PostgreSQL 17 test base. No production endpoints or data.
-- Synthetic stand-ins for Office's pre-existing tables and Supabase Auth/Storage.
create extension if not exists pgcrypto;
create extension if not exists vector;
create schema if not exists auth;
create schema if not exists private;
create schema if not exists storage;
do $roles$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $roles$;
grant usage on schema public, auth, private, storage to authenticated;
grant usage on schema public, auth, private, storage to service_role;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant execute on function auth.uid() to authenticated;

create table auth.users(
  id uuid primary key,
  instance_id uuid, aud text, role text, email text, encrypted_password text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.office_members(
  user_id uuid primary key references auth.users(id),
  email text not null unique,
  display_name text not null,
  role text not null default 'member' check(role in ('admin','projektleiter','member')),
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
-- Office already exposes this invoker compatibility view over member records.
create or replace view public.isabella_people with (security_invoker=true) as
  select m.user_id as id,m.user_id,m.display_name as name,
    null::text as relationship,null::date as birthday,
    jsonb_build_object('role',m.role) as metadata,
    m.created_at,m.updated_at,m.user_id::text as client_key
  from public.office_members m where m.is_active;
grant select on public.isabella_people to authenticated;

create or replace function private.office_is_member()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.office_members m
    where m.user_id=(select auth.uid()) and m.is_active)
$$;
grant execute on function private.office_is_member() to authenticated;

create table public.office_projects(
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  name text not null,
  status text not null default 'aktiv',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
create table public.office_project_members(
  project_id uuid not null references public.office_projects(id),
  user_id uuid not null references auth.users(id),
  added_by uuid references auth.users(id),
  primary key(project_id,user_id)
);
create table public.isabella_tasks(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  project_id uuid references public.office_projects(id),
  title text not null default 'Synthetic task',
  due_date date, completed_at timestamptz, archived_at timestamptz,
  work_status text not null default 'not_started', priority text not null default 'normal',
  work_bucket_id uuid, start_date date,
  client_key text not null default 'fixture-key',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(id,user_id)
);
create table public.minds_work_threads(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  project_id uuid references public.office_projects(id),
  conversation_id uuid,
  title text not null default 'Synthetic thread',
  created_at timestamptz not null default now()
);
create table public.minds_work_files(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  project_id uuid references public.office_projects(id),
  name text not null,
  folder_id uuid,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  storage_path text not null,
  source_kind text not null default 'file',
  index_status text not null default 'stored',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.minds_work_folders(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  project_id uuid references public.office_projects(id)
);
grant select on public.office_members, public.office_projects, public.office_project_members,
  public.minds_work_files, public.minds_work_folders to authenticated;

-- Original Office Work file policies permit reads to the studio.
-- Phase 1 adds restrictive policies to narrow project-specific visibility.
alter table public.minds_work_files enable row level security;
alter table public.minds_work_folders enable row level security;
create policy fixture_work_file_permissive on public.minds_work_files for select to authenticated using (true);
create policy fixture_work_folder_permissive on public.minds_work_folders for select to authenticated using (true);

create table storage.buckets(
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint
);
create table storage.objects(
  id bigint generated always as identity primary key,
  bucket_id text not null references storage.buckets(id),
  name text not null
);
create or replace function storage.foldername(name text)
returns text[] language sql stable as $$
  select regexp_split_to_array(name,'/')
$$;
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
insert into storage.buckets(id,name,public,file_size_limit)
values ('minds-work','minds-work',false,12582912);
create policy fixture_minds_work_visible on storage.objects for select to authenticated using (bucket_id='minds-work');
create policy fixture_minds_work_insert on storage.objects for insert to authenticated with check (bucket_id='minds-work');
create policy fixture_minds_work_update on storage.objects for update to authenticated using (bucket_id='minds-work') with check (bucket_id='minds-work');
create policy fixture_minds_work_delete on storage.objects for delete to authenticated using (bucket_id='minds-work');
