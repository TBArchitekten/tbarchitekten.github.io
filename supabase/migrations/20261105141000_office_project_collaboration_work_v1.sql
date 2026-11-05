-- Office collaboration is a project team, not a hierarchy or an authorization shortcut.
-- Role/tenant membership is still verified by the existing private helpers.
create table public.office_project_members(
 project_id uuid not null references public.office_projects(id) on delete cascade,
 user_id uuid not null references public.office_members(user_id) on delete cascade,
 added_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 primary key(project_id,user_id)
);
create index office_project_members_user_idx on public.office_project_members(user_id,project_id);
alter table public.office_project_members enable row level security;
grant select,insert,delete on public.office_project_members to authenticated;
create policy office_project_members_read on public.office_project_members for select to authenticated
 using ((select private.office_is_member()));
create policy office_project_members_add on public.office_project_members for insert to authenticated
 with check ((select private.office_is_member()) and added_by=(select auth.uid())
   and exists(select 1 from public.office_projects p where p.id=project_id and p.status='aktiv')
   and exists(select 1 from public.office_members m where m.user_id=office_project_members.user_id and m.is_active and not m.must_change_password));
create policy office_project_members_remove on public.office_project_members for delete to authenticated
 using ((select private.office_is_member()));

-- Team membership is descriptive and collaborative; roles remain office-wide.
-- Any signed-in active Office colleague can create an active shared project.
create policy office_projects_member_insert on public.office_projects for insert to authenticated
 with check ((select private.office_is_member()) and created_by=(select auth.uid())
   and projektleiter_id is null);

-- For compatibility a project's legacy Projektleiter remains untouched; collaboration is independent.
create table public.office_project_folders(
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.office_projects(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 160),
 parent_id uuid references public.office_project_folders(id) on delete restrict,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index office_project_folders_project_idx on public.office_project_folders(project_id,parent_id);
alter table public.office_project_folders enable row level security;
grant select,insert,update,delete on public.office_project_folders to authenticated;
create policy office_project_folders_read on public.office_project_folders for select to authenticated
 using ((select private.office_is_member()));
create policy office_project_folders_insert on public.office_project_folders for insert to authenticated
 with check ((select private.office_is_member()) and created_by=(select auth.uid())
   and exists(select 1 from public.office_projects p where p.id=project_id and p.status='aktiv'));
create policy office_project_folders_update on public.office_project_folders for update to authenticated
 using ((select private.office_is_member()))
 with check ((select private.office_is_member()));
create policy office_project_folders_delete on public.office_project_folders for delete to authenticated
 using ((select private.office_is_member()));

create table public.office_project_files(
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.office_projects(id) on delete cascade,
 folder_id uuid references public.office_project_folders(id) on delete set null,
 storage_path text not null unique check(length(storage_path) between 20 and 600),
 file_name text not null check(length(file_name) between 1 and 240),
 media_type text not null,
 bytes bigint not null check(bytes > 0 and bytes <= 25000000),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index office_project_files_project_idx on public.office_project_files(project_id,folder_id,created_at desc);
alter table public.office_project_files enable row level security;
grant select,insert,delete on public.office_project_files to authenticated;
create policy office_project_files_read on public.office_project_files for select to authenticated
 using ((select private.office_is_member()));
create policy office_project_files_insert on public.office_project_files for insert to authenticated
 with check ((select private.office_is_member()) and created_by=(select auth.uid())
   and split_part(storage_path,'/',1)=(select auth.uid())::text
   and split_part(storage_path,'/',2)=project_id::text
   and exists(select 1 from public.office_projects p where p.id=project_id and p.status='aktiv')
   and (folder_id is null or exists (select 1 from public.office_project_folders f where f.id=folder_id and f.project_id=office_project_files.project_id)));
create policy office_project_files_delete on public.office_project_files for delete to authenticated
 using ((select private.office_is_member()) and created_by=(select auth.uid()));

-- Project teammates may edit plans belonging to the project, even if they are not the former lead.
create policy office_instances_team_update on public.office_terminplan_instances for update to authenticated
 using ((select private.office_is_member()) and exists (
   select 1 from public.office_project_members pm where pm.project_id=office_terminplan_instances.project_id and pm.user_id=(select auth.uid())))
 with check ((select private.office_is_member()) and exists (
   select 1 from public.office_project_members pm where pm.project_id=office_terminplan_instances.project_id and pm.user_id=(select auth.uid())));

comment on table public.office_project_members is 'Non-hierarchical project team. Office roles and RLS remain independent.';
