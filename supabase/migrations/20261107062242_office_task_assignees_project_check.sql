-- TBA Office · office_task_assignees: compare the assignment's project with the task's project.
-- Inside the subqueries an unqualified project_id resolved to t.project_id, so the check compared the
-- task with itself and an assignment could name a different project than its task.
alter policy office_task_assignees_read on public.office_task_assignees
  using ((select private.office_is_member())
    and exists(select 1 from public.office_tasks t
               where t.id=office_task_assignees.task_id and t.project_id=office_task_assignees.project_id));
alter policy office_task_assignees_insert on public.office_task_assignees
  with check((select private.office_is_member()) and assigned_by=(select auth.uid())
    and exists(select 1 from public.office_tasks t
               where t.id=office_task_assignees.task_id and t.project_id=office_task_assignees.project_id)
    and exists(select 1 from public.office_project_members p
               where p.project_id=office_task_assignees.project_id and p.user_id=(select auth.uid()))
    and exists(select 1 from public.office_project_members p
               where p.project_id=office_task_assignees.project_id and p.user_id=office_task_assignees.user_id));
