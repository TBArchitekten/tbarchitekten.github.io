-- TBA Office · Kostenberechnung v1 (21.11.2026, Claude, Auftrag Gari).
-- Gleiches Muster wie der Terminplan: Muster (Vorlage) → Projekt-Kostenberechnung mit JSON-Stand und
-- Serverrevision → festgehaltene Stände. Lesen ist enger als beim Terminplan: Kosten sieht nur, wer die
-- Kostenberechnung angelegt hat, das Projekt leitet (Projektleitung oder Admin) oder im Projektteam ist.
-- Die DIN-276-Gliederung steht nicht in dieser Datei. Das Muster mit der Gliederung wird in der Datenbank
-- gepflegt, weil das Repository öffentlich ist.

create table public.office_kosten_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  norm text not null default 'DIN 276:2018-12',
  version text not null,
  status text not null default 'Entwurf',
  state jsonb not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(title, version)
);
create index office_kosten_templates_created_by_idx on public.office_kosten_templates(created_by);

create table public.office_kosten_instances (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.office_projects(id) on delete restrict,
  template_id uuid references public.office_kosten_templates(id) on delete set null,
  template_version text not null,
  -- Für den Kopf des Editors; maßgeblich bleibt die Projektzeile.
  project_number text not null,
  project_name text not null,
  phase text not null default 'LPH3' check (phase ~ '^LPH[1-9]$'),
  owner_id uuid not null references auth.users(id) on delete restrict,
  state jsonb not null,
  is_archived boolean not null default false,
  server_revision bigint not null default 1 check (server_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index office_kosten_instances_project_idx on public.office_kosten_instances(project_id);
create index office_kosten_instances_owner_idx on public.office_kosten_instances(owner_id);
create index office_kosten_instances_template_idx on public.office_kosten_instances(template_id);
comment on column public.office_kosten_instances.server_revision is
  'Monotone Revision für bedingte PostgREST-Updates; der Client filtert auf die erwartete Revision.';

create table public.office_kosten_versions (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.office_kosten_instances(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 160),
  state jsonb not null,
  server_revision bigint not null check (server_revision > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index office_kosten_versions_instance_idx on public.office_kosten_versions(instance_id);
create index office_kosten_versions_created_by_idx on public.office_kosten_versions(created_by);

-- Wer eine Kostenberechnung sehen und fortschreiben darf.
create function private.office_can_read_kosten(p_owner uuid, p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.office_is_member())
     and (p_owner = (select auth.uid())
          or (select private.office_leads_project(p_project))
          or (select private.office_in_project_team(p_project)))
$$;
revoke all on function private.office_can_read_kosten(uuid, uuid) from public, anon;
grant execute on function private.office_can_read_kosten(uuid, uuid) to authenticated;

-- Projekt und Ersteller einer Kostenberechnung ändern sich nach dem Anlegen nicht.
create function public.office_kosten_identity_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.project_id is distinct from old.project_id or new.owner_id is distinct from old.owner_id then
    raise exception 'Projekt und Ersteller einer Kostenberechnung sind unveränderlich';
  end if;
  return new;
end;
$$;
revoke all on function public.office_kosten_identity_guard() from public, anon, authenticated;

create trigger office_kosten_instances_identity before update on public.office_kosten_instances
  for each row execute function public.office_kosten_identity_guard();
create trigger office_kosten_instances_revision before update on public.office_kosten_instances
  for each row execute function public.office_terminplan_advance_revision();
create trigger office_kosten_instances_touch before update on public.office_kosten_instances
  for each row execute function public.office_touch_updated_at();
create trigger office_kosten_templates_touch before update on public.office_kosten_templates
  for each row execute function public.office_touch_updated_at();

alter table public.office_kosten_templates enable row level security;
alter table public.office_kosten_instances enable row level security;
alter table public.office_kosten_versions enable row level security;
revoke all on public.office_kosten_templates, public.office_kosten_instances, public.office_kosten_versions
  from public, anon, authenticated;
grant select on public.office_kosten_templates to authenticated;
grant select, insert, update, delete on public.office_kosten_instances to authenticated;
grant select, insert on public.office_kosten_versions to authenticated;

create policy office_kosten_templates_member_select on public.office_kosten_templates
  for select to authenticated using ((select private.office_is_member()));

create policy office_kosten_instances_select on public.office_kosten_instances
  for select to authenticated using ((select private.office_can_read_kosten(owner_id, project_id)));
create policy office_kosten_instances_insert on public.office_kosten_instances
  for insert to authenticated
  with check (owner_id = (select auth.uid())
              and (select private.office_is_member())
              and ((select private.office_leads_project(project_id)) or (select private.office_in_project_team(project_id))));
create policy office_kosten_instances_update on public.office_kosten_instances
  for update to authenticated
  using ((select private.office_can_read_kosten(owner_id, project_id)))
  with check ((select private.office_can_read_kosten(owner_id, project_id)));
create policy office_kosten_instances_delete on public.office_kosten_instances
  for delete to authenticated using ((select private.office_can_edit_plan(owner_id, project_id)));

create policy office_kosten_versions_select on public.office_kosten_versions
  for select to authenticated
  using (exists(select 1 from public.office_kosten_instances i
                where i.id = instance_id and (select private.office_can_read_kosten(i.owner_id, i.project_id))));
create policy office_kosten_versions_insert on public.office_kosten_versions
  for insert to authenticated
  with check (created_by = (select auth.uid())
              and exists(select 1 from public.office_kosten_instances i
                         where i.id = instance_id and (select private.office_can_read_kosten(i.owner_id, i.project_id))));
