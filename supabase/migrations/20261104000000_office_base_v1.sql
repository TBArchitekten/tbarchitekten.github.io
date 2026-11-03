-- TBA Office · base schema for its own Supabase project "TBA Office" (EU, eu-west-1).
-- Consolidates the Office tables that lived in the Bernried Project Hub (2026-10-28 migrations)
-- and adds what every future tool hangs off: members with roles and Office projects.
-- No Bernried, MINDS or Isabella tables, keys or identities.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- ── Members ────────────────────────────────────────────────────────────────
create table public.office_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(email) and position('@' in email) > 1),
  display_name text not null check (char_length(display_name) between 1 and 80),
  role text not null default 'member' check (role in ('admin','projektleiter','member')),
  is_active boolean not null default true,
  -- Accounts are created by an admin with a start password; the person sets their own at first sign-in.
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Membership checks run as definer so policies on office_members itself cannot recurse.
create function private.office_is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.office_members m where m.user_id = (select auth.uid()) and m.is_active)
$$;
create function private.office_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.office_members m where m.user_id = (select auth.uid()) and m.is_active and m.role = 'admin')
$$;
create function private.office_can_lead() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.office_members m where m.user_id = (select auth.uid()) and m.is_active and m.role in ('admin','projektleiter'))
$$;
revoke all on function private.office_is_member(), private.office_is_admin(), private.office_can_lead() from public, anon;
grant execute on function private.office_is_member(), private.office_is_admin(), private.office_can_lead() to authenticated;

alter table public.office_members enable row level security;
revoke all on public.office_members from public, anon, authenticated;
-- Colleagues see each other (names for the Planner, owners of plans). Changes go through the admin function.
grant select on public.office_members to authenticated;
create policy office_members_member_select on public.office_members
  for select to authenticated using ((select private.office_is_member()));

-- After changing the start password inside the page, the person clears their own flag.
create function public.office_password_changed() returns void
language sql security definer set search_path = '' as $$
  update public.office_members set must_change_password = false, updated_at = now()
  where user_id = (select auth.uid()) and is_active
$$;
revoke all on function public.office_password_changed() from public, anon;
grant execute on function public.office_password_changed() to authenticated;

-- ── Projects: the backbone every tool hangs off ───────────────────────────
create table public.office_projects (
  id uuid primary key default gen_random_uuid(),
  number text not null unique check (char_length(number) between 1 and 20),
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'aktiv' check (status in ('aktiv','archiviert')),
  projektleiter_id uuid references public.office_members(user_id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index office_projects_projektleiter_idx on public.office_projects(projektleiter_id);
create index office_projects_created_by_idx on public.office_projects(created_by);

create function private.office_leads_project(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.office_is_admin())
      or exists(select 1 from public.office_projects p
                where p.id = p_project and p.projektleiter_id = (select auth.uid()))
$$;
revoke all on function private.office_leads_project(uuid) from public, anon;
grant execute on function private.office_leads_project(uuid) to authenticated;

alter table public.office_projects enable row level security;
revoke all on public.office_projects from public, anon, authenticated;
grant select, insert, update, delete on public.office_projects to authenticated;
create policy office_projects_member_select on public.office_projects
  for select to authenticated using ((select private.office_is_member()));
create policy office_projects_lead_insert on public.office_projects
  for insert to authenticated with check ((select private.office_can_lead()) and created_by = (select auth.uid()));
create policy office_projects_lead_update on public.office_projects
  for update to authenticated
  using ((select private.office_leads_project(id)))
  with check ((select private.office_leads_project(id)));
create policy office_projects_admin_delete on public.office_projects
  for delete to authenticated using ((select private.office_is_admin()));

-- ── Terminplan ────────────────────────────────────────────────────────────
create table public.office_terminplan_templates (
  id uuid primary key default gen_random_uuid(),
  phase text not null check (phase ~ '^LPH[1-9]$'),
  title text not null,
  description text not null default '',
  version text not null,
  status text not null default 'Entwurf',
  state jsonb not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(phase, version)
);
create index office_terminplan_templates_created_by_idx on public.office_terminplan_templates(created_by);

create table public.office_terminplan_instances (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.office_projects(id) on delete restrict,
  template_id uuid references public.office_terminplan_templates(id) on delete set null,
  template_version text not null,
  -- Kept for the editor's header; the project row is the source of truth.
  project_number text not null,
  project_name text not null,
  phase text not null check (phase ~ '^LPH[1-9]$'),
  owner_id uuid not null references auth.users(id) on delete restrict,
  state jsonb not null,
  source text not null default 'template',
  is_archived boolean not null default false,
  server_revision bigint not null default 1 check (server_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index office_terminplan_instances_project_idx on public.office_terminplan_instances(project_id);
create index office_terminplan_instances_owner_idx on public.office_terminplan_instances(owner_id);
create index office_terminplan_instances_template_idx on public.office_terminplan_instances(template_id);
create index office_terminplan_instances_phase_idx on public.office_terminplan_instances(phase);
comment on column public.office_terminplan_instances.server_revision is
  'Monotonic revision for conditional PostgREST updates; client must filter on expected revision.';

create table public.office_terminplan_versions (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.office_terminplan_instances(id) on delete cascade,
  label text not null,
  state jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index office_terminplan_versions_instance_idx on public.office_terminplan_versions(instance_id);
create index office_terminplan_versions_created_by_idx on public.office_terminplan_versions(created_by);

-- Who may change a plan: its owner, an admin, or the Projektleiter of its project.
create function private.office_can_edit_plan(p_owner uuid, p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.office_is_member())
     and (p_owner = (select auth.uid()) or (select private.office_leads_project(p_project)))
$$;
revoke all on function private.office_can_edit_plan(uuid, uuid) from public, anon;
grant execute on function private.office_can_edit_plan(uuid, uuid) to authenticated;

alter table public.office_terminplan_templates enable row level security;
alter table public.office_terminplan_instances enable row level security;
alter table public.office_terminplan_versions enable row level security;
revoke all on public.office_terminplan_templates, public.office_terminplan_instances, public.office_terminplan_versions from public, anon, authenticated;
grant select on public.office_terminplan_templates to authenticated;
grant select, insert, update, delete on public.office_terminplan_instances to authenticated;
grant select, insert on public.office_terminplan_versions to authenticated;

create policy office_templates_member_select on public.office_terminplan_templates
  for select to authenticated using ((select private.office_is_member()));

create policy office_instances_member_select on public.office_terminplan_instances
  for select to authenticated using ((select private.office_is_member()));
create policy office_instances_member_insert on public.office_terminplan_instances
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.office_is_member()));
create policy office_instances_editor_update on public.office_terminplan_instances
  for update to authenticated
  using ((select private.office_can_edit_plan(owner_id, project_id)))
  with check ((select private.office_can_edit_plan(owner_id, project_id)));
create policy office_instances_editor_delete on public.office_terminplan_instances
  for delete to authenticated using ((select private.office_can_edit_plan(owner_id, project_id)));

create policy office_versions_member_select on public.office_terminplan_versions
  for select to authenticated using ((select private.office_is_member()));
create policy office_versions_editor_insert on public.office_terminplan_versions
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists(select 1 from public.office_terminplan_instances i
               where i.id = instance_id and (select private.office_can_edit_plan(i.owner_id, i.project_id)))
  );

-- Optimistic concurrency: every update advances the revision, even from older editors.
create function public.office_terminplan_advance_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.server_revision := old.server_revision + 1;
  return new;
end;
$$;
revoke all on function public.office_terminplan_advance_revision() from public, anon, authenticated;
create trigger office_terminplan_revision_update
  before update on public.office_terminplan_instances
  for each row execute function public.office_terminplan_advance_revision();

-- updated_at for the editable tables.
create function public.office_touch_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.office_touch_updated_at() from public, anon, authenticated;
create trigger office_members_touch before update on public.office_members
  for each row execute function public.office_touch_updated_at();
create trigger office_projects_touch before update on public.office_projects
  for each row execute function public.office_touch_updated_at();
create trigger office_instances_touch before update on public.office_terminplan_instances
  for each row execute function public.office_touch_updated_at();

-- ── Terminplan assistant: conversation and daily AI budget ────────────────
create table public.office_terminplan_dialogue_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.office_terminplan_instances(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role text not null check (role in ('user','assistant','system_receipt')),
  body text not null check (char_length(body) between 1 and 4000),
  event_kind text not null default 'answer' check (event_kind in ('question','answer','proposal','approval','receipt','warning')),
  request_id text check (request_id is null or char_length(request_id) <= 96),
  event_data jsonb not null default '{}'::jsonb check (jsonb_typeof(event_data) = 'object' and pg_column_size(event_data) <= 16000),
  created_at timestamptz not null default now()
);
create index office_dialogue_owner_plan_created_idx on public.office_terminplan_dialogue_messages(user_id, plan_id, created_at desc);
create index office_dialogue_plan_idx on public.office_terminplan_dialogue_messages(plan_id);
comment on table public.office_terminplan_dialogue_messages is
  'User-scoped Office conversation display history. Client-origin events are not trusted execution receipts.';
alter table public.office_terminplan_dialogue_messages enable row level security;
revoke all on public.office_terminplan_dialogue_messages from public, anon, authenticated;
grant select, insert on public.office_terminplan_dialogue_messages to authenticated;
create policy office_dialogue_user_read on public.office_terminplan_dialogue_messages
  for select to authenticated
  using (user_id = (select auth.uid()) and (select private.office_is_member())
         and exists(select 1 from public.office_terminplan_instances p where p.id = plan_id));
create policy office_dialogue_user_insert on public.office_terminplan_dialogue_messages
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.office_is_member())
              and exists(select 1 from public.office_terminplan_instances p where p.id = plan_id));

-- At most 25 model requests per member per UTC day. No prompts, answers or keys are stored.
create table public.office_terminplan_ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.office_terminplan_instances(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index office_terminplan_ai_requests_user_day_idx on public.office_terminplan_ai_requests(user_id, created_at desc);
create index office_terminplan_ai_requests_plan_idx on public.office_terminplan_ai_requests(plan_id);
alter table public.office_terminplan_ai_requests enable row level security;
revoke all on public.office_terminplan_ai_requests from public, anon, authenticated;
grant select, insert on public.office_terminplan_ai_requests to authenticated;
create policy office_ai_requests_self_read on public.office_terminplan_ai_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy office_ai_requests_self_insert on public.office_terminplan_ai_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.office_is_member())
              and exists(select 1 from public.office_terminplan_instances p where p.id = plan_id));

create function public.office_ai_consume_request(p_plan_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  used integer;
begin
  if uid is null then return false; end if;
  if not (select private.office_is_member()) then return false; end if;
  if not exists(select 1 from public.office_terminplan_instances p where p.id = p_plan_id) then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('office-ai-quota:' || uid::text)::bigint);
  select count(*) into used from public.office_terminplan_ai_requests
    where user_id = uid and created_at >= (pg_catalog.date_trunc('day', now() at time zone 'UTC') at time zone 'UTC');
  if used >= 25 then return false; end if;
  insert into public.office_terminplan_ai_requests(user_id, plan_id) values (uid, p_plan_id);
  return true;
end;
$$;
revoke all on function public.office_ai_consume_request(uuid) from public, anon;
grant execute on function public.office_ai_consume_request(uuid) to authenticated;
comment on function public.office_ai_consume_request(uuid) is
  'Atomic per-user daily quota for Office model requests; authenticated invoker under RLS, at most 25 per UTC day.';
