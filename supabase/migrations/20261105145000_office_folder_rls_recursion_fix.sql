-- Follow-up to office_collaboration_integrity_v1.
-- Same-table RLS subqueries are recursive. Check ancestry using a private,
-- audited SECURITY DEFINER helper rather than querying the folder under its own policy.
create or replace function private.office_folder_parent_in_project(p_parent uuid,p_project uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
 select (p_parent is null) or exists (
   select 1 from public.office_project_folders f
   where f.id=p_parent and f.project_id=p_project
 );
$$;
revoke all on function private.office_folder_parent_in_project(uuid,uuid) from public,anon;
grant execute on function private.office_folder_parent_in_project(uuid,uuid) to authenticated;
alter policy office_project_folders_insert on public.office_project_folders
with check (
  (select private.office_is_member())
  and created_by=(select auth.uid())
  and exists(select 1 from public.office_projects p
    where p.id=project_id and p.status='aktiv')
  and (select private.office_folder_parent_in_project(parent_id,project_id))
);
alter policy office_project_folders_update on public.office_project_folders
with check (
  (select private.office_is_member())
  and exists(select 1 from public.office_projects p
    where p.id=project_id and p.status='aktiv')
  and (select private.office_folder_parent_in_project(parent_id,project_id))
);
