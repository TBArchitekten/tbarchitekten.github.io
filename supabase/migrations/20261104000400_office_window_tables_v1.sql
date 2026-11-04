-- TBA Office · Window's tables in the office project (part A of copying Window).
-- Same names and columns as in Window, so Window's web code runs here almost unchanged.
-- Empty and separate: nothing connects to Window's own database.
-- Differences for an office of several people:
--   * isabella_projects and isabella_people are read-only views over office_projects and office_members:
--     creating projects and accounts stays with the office rules;
--   * client_key is unique per table (not per user);
--   * personal rows (no project) belong to one person; project rows are read by every active member
--     and changed by their author, the people assigned and the project's lead (admins included);
--   * calendar entries (events), categories, preferences and tombstones are personal.

-- ── Projects and people: views over the office tables ─────────────────────
create view public.isabella_projects with (security_invoker = true) as
  select p.id,
         coalesce(p.projektleiter_id, p.created_by) as user_id,
         null::uuid as category_id,
         p.name,
         (p.status = 'archiviert') as archived,
         p.created_at,
         p.updated_at,
         p.id::text as client_key,
         null::text as color,
         p.number,
         p.projektleiter_id
  from public.office_projects p;

create view public.isabella_people with (security_invoker = true) as
  select m.user_id as id,
         m.user_id,
         m.display_name as name,
         null::text as relationship,
         null::date as birthday,
         jsonb_build_object('email', m.email, 'role', m.role) as metadata,
         m.created_at,
         m.updated_at,
         m.user_id::text as client_key
  from public.office_members m
  where m.is_active;

revoke all on public.isabella_projects, public.isabella_people from public, anon, authenticated;
grant select on public.isabella_projects, public.isabella_people to authenticated;

-- ── Personal: categories, preferences, tombstones ─────────────────────────
create table public.isabella_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  color text,
  client_key text not null default gen_random_uuid()::text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create index isabella_categories_user_idx on public.isabella_categories(user_id);

create table public.isabella_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  preference_key text not null,
  value jsonb not null default '{}'::jsonb,
  status text not null default 'inferred',
  confidence numeric not null default 0.500,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, preference_key)
);

create table public.isabella_deleted_items (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entity_type text not null,
  client_key text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, entity_type, client_key)
);

-- ── Planner: buckets and project teams ────────────────────────────────────
create table public.minds_work_buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.office_projects(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index minds_work_buckets_project_idx on public.minds_work_buckets(project_id, sort_order);
create index minds_work_buckets_user_idx on public.minds_work_buckets(user_id);

-- Who works on a project (Window's "Team"); people are office members.
create table public.minds_work_project_people (
  project_id uuid not null references public.office_projects(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, person_id)
);
create index minds_work_project_people_person_idx on public.minds_work_project_people(person_id);
create index minds_work_project_people_user_idx on public.minds_work_project_people(user_id);

-- ── Tasks and calendar entries ────────────────────────────────────────────
create table public.isabella_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  due_date date,
  completed_at timestamptz,
  category_id uuid references public.isabella_categories(id) on delete set null,
  project_id uuid references public.office_projects(id) on delete cascade,
  recurrence jsonb not null default '{}'::jsonb,
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_key text not null default gen_random_uuid()::text unique,
  archived_at timestamptz,
  sort_order integer not null default 0,
  reminder_time time,
  work_bucket_id uuid references public.minds_work_buckets(id) on delete set null,
  work_status text not null default 'not_started' check (work_status in ('not_started','in_progress','waiting','completed')),
  priority text not null default 'normal' check (priority in ('low','normal','important','urgent')),
  start_date date,
  assignee text,
  labels jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  work_sort_order integer,
  assignee_person_id uuid references auth.users(id) on delete set null,
  check (assignee_person_id is null or project_id is not null),
  foreign key (project_id, assignee_person_id) references public.minds_work_project_people(project_id, person_id) on delete restrict
);
create index isabella_tasks_user_idx on public.isabella_tasks(user_id);
create index isabella_tasks_project_idx on public.isabella_tasks(project_id, work_bucket_id);
create index isabella_tasks_due_idx on public.isabella_tasks(due_date);
create index isabella_tasks_assignee_idx on public.isabella_tasks(assignee_person_id);
create index isabella_tasks_bucket_idx on public.isabella_tasks(work_bucket_id);
create index isabella_tasks_category_idx on public.isabella_tasks(category_id);

create table public.isabella_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  category_id uuid references public.isabella_categories(id) on delete set null,
  project_id uuid references public.office_projects(id) on delete set null,
  recurrence jsonb not null default '{}'::jsonb,
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_key text not null default gen_random_uuid()::text unique,
  check (ends_at > starts_at)
);
create index isabella_events_user_idx on public.isabella_events(user_id, starts_at);
create index isabella_events_project_idx on public.isabella_events(project_id);
create index isabella_events_category_idx on public.isabella_events(category_id);

create table public.minds_work_task_assignees (
  task_id uuid not null references public.isabella_tasks(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, person_id),
  foreign key (project_id, person_id) references public.minds_work_project_people(project_id, person_id) on delete restrict
);
create index minds_work_task_assignees_person_idx on public.minds_work_task_assignees(person_id);
create index minds_work_task_assignees_project_idx on public.minds_work_task_assignees(project_id, person_id);
create index minds_work_task_assignees_user_idx on public.minds_work_task_assignees(user_id);

create table public.minds_work_task_allocations (
  task_id uuid not null references public.isabella_tasks(id) on delete cascade,
  person_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  planned_minutes integer not null check (planned_minutes between 15 and 720 and planned_minutes % 15 = 0),
  note text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (task_id, person_id, work_date),
  foreign key (task_id, person_id) references public.minds_work_task_assignees(task_id, person_id) on delete cascade deferrable initially deferred
);
create index minds_work_task_allocations_person_idx on public.minds_work_task_allocations(person_id, work_date);
create index minds_work_task_allocations_user_idx on public.minds_work_task_allocations(user_id);

-- ── Who may change a task ─────────────────────────────────────────────────
-- Its author, the person assigned (single or in the team list) or the project's lead.
create function private.office_can_edit_window_task(p_task uuid, p_user uuid, p_assignee uuid, p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.office_is_member())
     and (p_user = (select auth.uid())
          or p_assignee = (select auth.uid())
          or (p_project is not null and (select private.office_leads_project(p_project)))
          or exists(select 1 from public.minds_work_task_assignees a
                    where a.task_id = p_task and a.person_id = (select auth.uid())))
$$;
revoke all on function private.office_can_edit_window_task(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function private.office_can_edit_window_task(uuid, uuid, uuid, uuid) to authenticated;

create function private.office_can_edit_window_task_id(p_task uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.isabella_tasks t
                where t.id = p_task
                  and (select private.office_can_edit_window_task(t.id, t.user_id, t.assignee_person_id, t.project_id)))
$$;
revoke all on function private.office_can_edit_window_task_id(uuid) from public, anon;
grant execute on function private.office_can_edit_window_task_id(uuid) to authenticated;

-- The author of a row never changes; personal tasks stay personal; buckets match their task's project.
create function public.office_window_task_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  if new.project_id is null and new.work_bucket_id is not null then
    raise exception 'personal_task_without_bucket' using errcode = '23514';
  end if;
  if new.work_bucket_id is not null and not exists(
      select 1 from public.minds_work_buckets b where b.id = new.work_bucket_id and b.project_id = new.project_id) then
    raise exception 'bucket_of_other_project' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.office_window_task_guard() from public, anon, authenticated;
create trigger office_window_task_guard before insert or update on public.isabella_tasks
  for each row execute function public.office_window_task_guard();

create function public.office_window_keep_author() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.user_id := old.user_id;
  return new;
end;
$$;
revoke all on function public.office_window_keep_author() from public, anon, authenticated;
create trigger office_window_bucket_author before update on public.minds_work_buckets
  for each row execute function public.office_window_keep_author();
create trigger office_window_event_author before update on public.isabella_events
  for each row execute function public.office_window_keep_author();
create trigger office_window_category_author before update on public.isabella_categories
  for each row execute function public.office_window_keep_author();
create trigger office_window_preference_author before update on public.isabella_preferences
  for each row execute function public.office_window_keep_author();

-- ── Row level security ────────────────────────────────────────────────────
alter table public.isabella_categories enable row level security;
alter table public.isabella_preferences enable row level security;
alter table public.isabella_deleted_items enable row level security;
alter table public.minds_work_buckets enable row level security;
alter table public.minds_work_project_people enable row level security;
alter table public.isabella_tasks enable row level security;
alter table public.isabella_events enable row level security;
alter table public.minds_work_task_assignees enable row level security;
alter table public.minds_work_task_allocations enable row level security;
revoke all on public.isabella_categories, public.isabella_preferences, public.isabella_deleted_items,
  public.minds_work_buckets, public.minds_work_project_people, public.isabella_tasks, public.isabella_events,
  public.minds_work_task_assignees, public.minds_work_task_allocations from public, anon, authenticated;
grant select, insert, update, delete on public.isabella_categories, public.isabella_preferences, public.isabella_deleted_items,
  public.minds_work_buckets, public.minds_work_project_people, public.isabella_tasks, public.isabella_events,
  public.minds_work_task_assignees, public.minds_work_task_allocations to authenticated;

-- Personal tables: only the person.
create policy isabella_categories_own on public.isabella_categories for all to authenticated
  using ((select private.office_is_member()) and user_id = (select auth.uid()))
  with check ((select private.office_is_member()) and user_id = (select auth.uid()));
create policy isabella_preferences_own on public.isabella_preferences for all to authenticated
  using ((select private.office_is_member()) and user_id = (select auth.uid()))
  with check ((select private.office_is_member()) and user_id = (select auth.uid()));
create policy isabella_deleted_items_own on public.isabella_deleted_items for all to authenticated
  using ((select private.office_is_member()) and user_id = (select auth.uid()))
  with check ((select private.office_is_member()) and user_id = (select auth.uid()));
create policy isabella_events_own on public.isabella_events for all to authenticated
  using ((select private.office_is_member()) and user_id = (select auth.uid()))
  with check ((select private.office_is_member()) and user_id = (select auth.uid()));

-- Buckets: read by all; added by any member in an active project; changed by author or lead.
create policy minds_work_buckets_select on public.minds_work_buckets for select to authenticated
  using ((select private.office_is_member()));
create policy minds_work_buckets_insert on public.minds_work_buckets for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.office_is_member())
              and exists(select 1 from public.office_projects p where p.id = project_id and p.status = 'aktiv'));
create policy minds_work_buckets_update on public.minds_work_buckets for update to authenticated
  using ((select private.office_is_member()) and (user_id = (select auth.uid()) or (select private.office_leads_project(project_id))))
  with check ((select private.office_is_member()) and (user_id = (select auth.uid()) or (select private.office_leads_project(project_id))));
create policy minds_work_buckets_delete on public.minds_work_buckets for delete to authenticated
  using ((select private.office_is_member()) and (user_id = (select auth.uid()) or (select private.office_leads_project(project_id))));

-- Project team: read by all; managed by the project's lead.
create policy minds_work_project_people_select on public.minds_work_project_people for select to authenticated
  using ((select private.office_is_member()));
create policy minds_work_project_people_insert on public.minds_work_project_people for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.office_leads_project(project_id))
              and exists(select 1 from public.office_members m where m.user_id = person_id and m.is_active));
create policy minds_work_project_people_delete on public.minds_work_project_people for delete to authenticated
  using ((select private.office_leads_project(project_id)));

-- Tasks: project tasks for everyone, personal tasks for their author.
create policy isabella_tasks_select on public.isabella_tasks for select to authenticated
  using ((select private.office_is_member()) and (project_id is not null or user_id = (select auth.uid())));
create policy isabella_tasks_insert on public.isabella_tasks for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.office_is_member())
              and (project_id is null or exists(select 1 from public.office_projects p where p.id = project_id and p.status = 'aktiv')));
create policy isabella_tasks_update on public.isabella_tasks for update to authenticated
  using ((select private.office_can_edit_window_task(id, user_id, assignee_person_id, project_id)))
  with check ((select private.office_can_edit_window_task(id, user_id, assignee_person_id, project_id)));
create policy isabella_tasks_delete on public.isabella_tasks for delete to authenticated
  using ((select private.office_is_member())
         and (user_id = (select auth.uid()) or (project_id is not null and (select private.office_leads_project(project_id)))));

-- Assignments and planned time: read by all; changed by whoever may change the task.
create policy minds_work_task_assignees_select on public.minds_work_task_assignees for select to authenticated
  using ((select private.office_is_member()));
create policy minds_work_task_assignees_insert on public.minds_work_task_assignees for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.office_can_edit_window_task_id(task_id))
              and exists(select 1 from public.isabella_tasks t where t.id = task_id and t.project_id = minds_work_task_assignees.project_id));
create policy minds_work_task_assignees_delete on public.minds_work_task_assignees for delete to authenticated
  using ((select private.office_can_edit_window_task_id(task_id)));

create policy minds_work_task_allocations_select on public.minds_work_task_allocations for select to authenticated
  using ((select private.office_is_member()));
create policy minds_work_task_allocations_insert on public.minds_work_task_allocations for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.office_can_edit_window_task_id(task_id)));
create policy minds_work_task_allocations_update on public.minds_work_task_allocations for update to authenticated
  using ((select private.office_can_edit_window_task_id(task_id)))
  with check ((select private.office_can_edit_window_task_id(task_id)));
create policy minds_work_task_allocations_delete on public.minds_work_task_allocations for delete to authenticated
  using ((select private.office_can_edit_window_task_id(task_id)));
