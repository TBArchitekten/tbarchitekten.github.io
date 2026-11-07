-- Office Work parity with Window's real task model: no shadow tasks, no Window database.
alter table public.office_tasks add column work_status text not null default 'not_started'
 check (work_status in ('not_started','in_progress','waiting','completed'));
alter table public.office_tasks add column labels text[] not null default '{}'
 check (cardinality(labels)<=30);
alter table public.office_tasks add column estimated_minutes integer
 check (estimated_minutes between 0 and 100000);
update public.office_tasks set work_status='completed' where completed_at is not null;
create policy office_tasks_team_delete on public.office_tasks for delete to authenticated
 using ((select private.office_is_member()) and exists(
  select 1 from public.office_project_members p
  where p.project_id=office_tasks.project_id and p.user_id=(select auth.uid())
 ));

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


-- Work file tiles expose Window's rename, relocate and delete actions.
-- Project membership, not global Office authentication, authorizes file edits.
-- Preserve the immutable storage identity when the display name or folder changes.
create policy office_project_files_team_update on public.office_project_files
for update to authenticated
using ((select private.office_is_member())
  and exists(select 1 from public.office_project_members pm
    where pm.project_id=office_project_files.project_id
      and pm.user_id=(select auth.uid())))
with check ((select private.office_is_member())
  and exists(select 1 from public.office_project_members pm
    where pm.project_id=office_project_files.project_id
      and pm.user_id=(select auth.uid()))
  and exists(select 1 from public.office_projects p
    where p.id=office_project_files.project_id and p.status='aktiv')
  and split_part(storage_path,'/',2)=project_id::text
  and (folder_id is null or exists(
    select 1 from public.office_project_folders f
    where f.id=office_project_files.folder_id and f.project_id=office_project_files.project_id)));

create policy office_project_files_team_delete on public.office_project_files
for delete to authenticated
using ((select private.office_is_member())
  and exists(select 1 from public.office_project_members pm
    where pm.project_id=office_project_files.project_id
      and pm.user_id=(select auth.uid())));

create or replace function private.office_file_identity_guard()
returns trigger language plpgsql security invoker set search_path=''
as $guard$
begin
  if current_user='authenticated' and
    (new.project_id,new.storage_path,new.created_by,new.bytes,new.media_type)
    is distinct from
    (old.project_id,old.storage_path,old.created_by,old.bytes,old.media_type)
  then
    raise exception 'immutable_office_file_identity' using errcode='23514';
  end if;
  return new;
end;
$guard$;
revoke all on function private.office_file_identity_guard() from public,anon;
create trigger office_file_identity_guard before update on public.office_project_files
for each row execute function private.office_file_identity_guard();
