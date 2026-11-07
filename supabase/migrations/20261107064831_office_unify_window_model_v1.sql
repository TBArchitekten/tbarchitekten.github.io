-- TBA Office · one data model (decision of Gari, 07.11.2026).
-- Work, Heute, Kalender, the task card and Romy all use Window's tables (isabella_tasks,
-- minds_work_buckets, minds_work_task_assignees, minds_work_folders, minds_work_files).
-- The project team is office_project_members: collaborative, chosen in Projekte.
-- The Office-only tables from PR #37/#38 (office_tasks, office_task_buckets, office_task_assignees,
-- office_project_folders, office_project_files) are copied here and stay untouched (dropping them
-- needs Gari's explicit OK).

-- ── 1. Assignments point at the project team in office_project_members ─────
alter table public.isabella_tasks drop constraint isabella_tasks_project_id_assignee_person_id_fkey;
alter table public.isabella_tasks add constraint isabella_tasks_project_assignee_team_fkey
  foreign key (project_id, assignee_person_id) references public.office_project_members(project_id, user_id)
  on delete set null (assignee_person_id);
alter table public.minds_work_task_assignees drop constraint minds_work_task_assignees_project_id_person_id_fkey;
alter table public.minds_work_task_assignees add constraint minds_work_task_assignees_team_fkey
  foreign key (project_id, person_id) references public.office_project_members(project_id, user_id)
  on delete cascade;

-- ── 2. The project team may change its project's tasks and buckets ─────────
create function private.office_in_project_team(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_project is not null and exists(
    select 1 from public.office_project_members m
    where m.project_id = p_project and m.user_id = (select auth.uid()))
$$;
revoke all on function private.office_in_project_team(uuid) from public, anon;
grant execute on function private.office_in_project_team(uuid) to authenticated;

create or replace function private.office_can_edit_window_task(p_task uuid, p_user uuid, p_assignee uuid, p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.office_is_member())
     and (p_user = (select auth.uid())
          or p_assignee = (select auth.uid())
          or (p_project is not null and (select private.office_leads_project(p_project)))
          or (p_project is not null and (select private.office_in_project_team(p_project)))
          or exists(select 1 from public.minds_work_task_assignees a
                    where a.task_id = p_task and a.person_id = (select auth.uid())))
$$;

alter policy isabella_tasks_delete on public.isabella_tasks
  using ((select private.office_is_member())
         and (user_id = (select auth.uid())
              or (project_id is not null and (select private.office_leads_project(project_id)))
              or (project_id is not null and (select private.office_in_project_team(project_id)))));
alter policy minds_work_buckets_update on public.minds_work_buckets
  using ((select private.office_is_member())
         and (user_id = (select auth.uid()) or (select private.office_leads_project(project_id))
              or (select private.office_in_project_team(project_id))))
  with check ((select private.office_is_member())
         and (user_id = (select auth.uid()) or (select private.office_leads_project(project_id))
              or (select private.office_in_project_team(project_id))));
alter policy minds_work_buckets_delete on public.minds_work_buckets
  using ((select private.office_is_member())
         and (user_id = (select auth.uid()) or (select private.office_leads_project(project_id))
              or (select private.office_in_project_team(project_id))));

-- ── 3. Copy what was created in the Office-only tables ──────────────────────
insert into public.minds_work_buckets(id, user_id, project_id, name, sort_order, archived, created_at, updated_at)
select b.id, b.created_by, b.project_id, b.name, b.position, b.is_archived, b.created_at, b.updated_at
from public.office_task_buckets b
on conflict (id) do nothing;

insert into public.isabella_tasks(id, user_id, title, due_date, completed_at, project_id, notes, metadata,
  created_at, updated_at, client_key, work_bucket_id, work_status, priority, start_date, labels, checklist,
  work_sort_order, assignee_person_id)
select t.id, t.created_by, t.title, t.due_date, t.completed_at, t.project_id, t.notes,
  jsonb_strip_nulls(jsonb_build_object(
    'planning', case when t.estimated_minutes is null then null
                     else jsonb_build_object('estimated_minutes', t.estimated_minutes) end,
    'migrated_from', 'office_tasks')),
  t.created_at, t.updated_at, t.id::text,
  case when t.project_id is null then null else t.bucket_id end,
  t.work_status,
  case t.priority when 'niedrig' then 'low' when 'hoch' then 'important' else 'normal' end,
  t.start_date,
  to_jsonb(case when t.kind = 'abgabe' then array_prepend('Abgabe', t.labels) else t.labels end),
  t.checklist, t.position,
  case when exists(select 1 from public.office_project_members m
                   where m.project_id = t.project_id and m.user_id = t.assignee_id)
       then t.assignee_id end
from public.office_tasks t
on conflict (id) do nothing;

insert into public.minds_work_task_assignees(task_id, person_id, project_id, user_id)
select a.task_id, a.user_id, a.project_id, a.assigned_by
from public.office_task_assignees a
join public.isabella_tasks t on t.id = a.task_id and t.project_id = a.project_id
on conflict do nothing;

-- Folders: parents before children.
with recursive tree as (
  select f.*, 0 as depth from public.office_project_folders f where f.parent_id is null
  union all
  select c.*, tree.depth + 1 from public.office_project_folders c join tree on c.parent_id = tree.id
)
insert into public.minds_work_folders(id, user_id, project_id, parent_id, name, created_at, updated_at)
select id, created_by, project_id, parent_id, name, created_at, updated_at from tree order by depth
on conflict (id) do nothing;

insert into public.minds_work_files(id, user_id, project_id, folder_id, name, mime_type, size_bytes, storage_path, created_at)
select f.id, f.created_by, f.project_id, f.folder_id, f.file_name, f.media_type, f.bytes, f.storage_path, f.created_at
from public.office_project_files f
on conflict (id) do nothing;

comment on table public.office_tasks is 'Obsolete since 07.11.2026: copied to isabella_tasks. Keep until Gari approves dropping it.';
comment on table public.office_task_buckets is 'Obsolete since 07.11.2026: copied to minds_work_buckets.';
comment on table public.office_task_assignees is 'Obsolete since 07.11.2026: copied to minds_work_task_assignees.';
comment on table public.office_project_folders is 'Obsolete since 07.11.2026: copied to minds_work_folders.';
comment on table public.office_project_files is 'Obsolete since 07.11.2026: copied to minds_work_files.';
comment on table public.minds_work_project_people is 'Unused since 07.11.2026: the project team is office_project_members.';
