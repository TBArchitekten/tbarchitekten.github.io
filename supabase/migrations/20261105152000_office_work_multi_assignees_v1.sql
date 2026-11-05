-- TBA Office: normalized multi-assignee team assignments for Work, matching Window's visual task model.
-- The original assignee_id remains a backwards-compatible primary assignment.
create table public.office_task_assignees(
 task_id uuid not null references public.office_tasks(id) on delete cascade,
 project_id uuid not null references public.office_projects(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 assigned_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(task_id,user_id)
);
create index office_task_assignees_project_idx on public.office_task_assignees(project_id);
create index office_task_assignees_user_idx on public.office_task_assignees(user_id);
create index office_task_assignees_assigned_by_idx on public.office_task_assignees(assigned_by);
alter table public.office_task_assignees enable row level security;
grant select,insert,delete on public.office_task_assignees to authenticated;

create policy office_task_assignees_read on public.office_task_assignees for select to authenticated
 using ((select private.office_is_member())
   and exists(select 1 from public.office_tasks t where t.id=task_id and t.project_id=project_id));

create policy office_task_assignees_insert on public.office_task_assignees for insert to authenticated
 with check(
   (select private.office_is_member()) and assigned_by=(select auth.uid())
   and exists(select 1 from public.office_tasks t where t.id=task_id and t.project_id=project_id)
   and exists(select 1 from public.office_project_members p where p.project_id=office_task_assignees.project_id and p.user_id=(select auth.uid()))
   and exists(select 1 from public.office_project_members p where p.project_id=office_task_assignees.project_id and p.user_id=office_task_assignees.user_id)
 );
create policy office_task_assignees_delete on public.office_task_assignees for delete to authenticated
 using ((select private.office_is_member())
   and exists(select 1 from public.office_project_members p where p.project_id=office_task_assignees.project_id and p.user_id=(select auth.uid())));

insert into public.office_task_assignees(task_id,project_id,user_id,assigned_by)
select t.id,t.project_id,t.assignee_id,coalesce(t.created_by,t.assignee_id)
from public.office_tasks t
join public.office_project_members m on m.project_id=t.project_id and m.user_id=t.assignee_id
where t.project_id is not null and t.assignee_id is not null
on conflict(task_id,user_id) do nothing;
