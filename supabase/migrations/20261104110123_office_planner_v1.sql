-- TBA Office · Planner and Kalender (stage 2 of bringing Window to the office).
-- Project tasks live in buckets on the project's Planner and are visible to the whole office;
-- personal tasks (no project) belong to one person only. Abgaben are tasks of kind 'abgabe'.
-- Every person's Kalender shows the tasks and Abgaben assigned to them (Termine stay in Outlook).

-- ── Buckets: the columns of a project's Planner ────────────────────────────
create table public.office_task_buckets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.office_projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  position integer not null default 0,
  is_archived boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index office_task_buckets_project_idx on public.office_task_buckets(project_id, position);
create index office_task_buckets_created_by_idx on public.office_task_buckets(created_by);

-- ── Tasks and Abgaben ─────────────────────────────────────────────────────
create table public.office_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.office_projects(id) on delete cascade,
  bucket_id uuid references public.office_task_buckets(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  kind text not null default 'aufgabe' check (kind in ('aufgabe','abgabe')),
  notes text not null default '' check (char_length(notes) <= 4000),
  start_date date,
  due_date date,
  assignee_id uuid references auth.users(id) on delete set null,
  priority text not null default 'normal' check (priority in ('niedrig','normal','hoch')),
  checklist jsonb not null default '[]'::jsonb
    check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 40),
  position integer not null default 0,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or due_date is null or start_date <= due_date)
);
create index office_tasks_project_idx on public.office_tasks(project_id, bucket_id, position);
create index office_tasks_bucket_idx on public.office_tasks(bucket_id);
create index office_tasks_assignee_due_idx on public.office_tasks(assignee_id, due_date);
create index office_tasks_created_by_idx on public.office_tasks(created_by);

-- Who may change a task: its author, the person it is assigned to, or the project's lead (admins included).
create function private.office_can_edit_task(p_created_by uuid, p_assignee uuid, p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.office_is_member())
     and (p_created_by = (select auth.uid())
          or p_assignee = (select auth.uid())
          or (p_project is not null and (select private.office_leads_project(p_project))))
$$;
revoke all on function private.office_can_edit_task(uuid, uuid, uuid) from public, anon;
grant execute on function private.office_can_edit_task(uuid, uuid, uuid) to authenticated;

-- Rules the policies cannot express: the bucket belongs to the task's project, a personal task
-- stays with its author, the assignee is an active member, the author never changes and the
-- completion time comes from the server.
create function public.office_tasks_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.title := btrim(new.title);
  if new.project_id is null then
    if new.bucket_id is not null then
      raise exception 'personal_task_without_bucket' using errcode = '23514';
    end if;
    if new.assignee_id is not null and new.assignee_id <> new.created_by then
      raise exception 'personal_task_is_own' using errcode = '23514';
    end if;
  elsif new.bucket_id is not null and not exists(
      select 1 from public.office_task_buckets b where b.id = new.bucket_id and b.project_id = new.project_id) then
    raise exception 'bucket_of_other_project' using errcode = '23514';
  end if;
  if new.assignee_id is not null and not exists(
      select 1 from public.office_members m where m.user_id = new.assignee_id and m.is_active) then
    raise exception 'assignee_not_member' using errcode = '23514';
  end if;
  if new.completed_at is not null and (tg_op = 'INSERT' or old.completed_at is null) then
    new.completed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.office_tasks_guard() from public, anon, authenticated;
create trigger office_tasks_guard before insert or update on public.office_tasks
  for each row execute function public.office_tasks_guard();

create function public.office_buckets_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.project_id := old.project_id;
  end if;
  new.name := btrim(new.name);
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.office_buckets_guard() from public, anon, authenticated;
create trigger office_buckets_guard before insert or update on public.office_task_buckets
  for each row execute function public.office_buckets_guard();

-- ── Row level security ────────────────────────────────────────────────────
alter table public.office_task_buckets enable row level security;
alter table public.office_tasks enable row level security;
revoke all on public.office_task_buckets, public.office_tasks from public, anon, authenticated;
grant select, insert, update, delete on public.office_task_buckets, public.office_tasks to authenticated;

create policy office_buckets_member_select on public.office_task_buckets
  for select to authenticated using ((select private.office_is_member()));
create policy office_buckets_member_insert on public.office_task_buckets
  for insert to authenticated
  with check (
    created_by = (select auth.uid()) and (select private.office_is_member())
    and exists(select 1 from public.office_projects p where p.id = project_id and p.status = 'aktiv')
  );
create policy office_buckets_owner_update on public.office_task_buckets
  for update to authenticated
  using ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_leads_project(project_id))))
  with check ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_leads_project(project_id))));
create policy office_buckets_owner_delete on public.office_task_buckets
  for delete to authenticated
  using ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_leads_project(project_id))));

-- Project tasks: the whole office. Personal tasks: only their author.
create policy office_tasks_member_select on public.office_tasks
  for select to authenticated
  using ((select private.office_is_member())
         and (project_id is not null or created_by = (select auth.uid()) or assignee_id = (select auth.uid())));
create policy office_tasks_member_insert on public.office_tasks
  for insert to authenticated
  with check (
    created_by = (select auth.uid()) and (select private.office_is_member())
    and (project_id is null or exists(select 1 from public.office_projects p where p.id = project_id and p.status = 'aktiv'))
  );
create policy office_tasks_editor_update on public.office_tasks
  for update to authenticated
  using ((select private.office_can_edit_task(created_by, assignee_id, project_id)))
  with check (
    (select private.office_can_edit_task(created_by, assignee_id, project_id))
    and (project_id is null or exists(select 1 from public.office_projects p where p.id = project_id))
  );
create policy office_tasks_owner_delete on public.office_tasks
  for delete to authenticated
  using ((select private.office_is_member())
         and (created_by = (select auth.uid()) or (project_id is not null and (select private.office_leads_project(project_id)))));
