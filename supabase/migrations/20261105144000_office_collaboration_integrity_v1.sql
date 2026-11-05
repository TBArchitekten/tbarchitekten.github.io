-- Collaborative team members can snapshot the full previous Terminplan
-- before explicitly approving a complete structural reconstruction.
create policy office_versions_team_insert on public.office_terminplan_versions
for insert to authenticated
with check(
  created_by=(select auth.uid())
  and (select private.office_is_member())
  and exists(
    select 1 from public.office_terminplan_instances p
    join public.office_project_members m on m.project_id=p.project_id
    where p.id=office_terminplan_versions.instance_id
      and m.user_id=(select auth.uid())
  )
);

-- Ensure nested folders cannot point across project boundaries.
alter policy office_project_folders_insert on public.office_project_folders
with check (
  (select private.office_is_member())
  and created_by=(select auth.uid())
  and exists(select 1 from public.office_projects p
    where p.id=project_id and p.status='aktiv')
  and (parent_id is null or exists(
    select 1 from public.office_project_folders parent
    where parent.id=office_project_folders.parent_id
      and parent.project_id=office_project_folders.project_id
  ))
);
alter policy office_project_folders_update on public.office_project_folders
with check (
  (select private.office_is_member())
  and exists(select 1 from public.office_projects p
    where p.id=project_id and p.status='aktiv')
  and (parent_id is null or exists(
    select 1 from public.office_project_folders parent
    where parent.id=office_project_folders.parent_id
      and parent.project_id=office_project_folders.project_id
  ))
);
create index if not exists office_project_files_folder_idx on public.office_project_files(folder_id);
create index if not exists office_project_files_created_by_idx on public.office_project_files(created_by);
create index if not exists office_project_folders_parent_idx on public.office_project_folders(parent_id);
create index if not exists office_project_folders_created_by_idx on public.office_project_folders(created_by);
create index if not exists office_terminplan_sources_plan_idx on public.office_terminplan_sources(plan_id);
