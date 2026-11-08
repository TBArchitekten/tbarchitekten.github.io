-- Phase 1: Office Storage contract of the Window engine, metadata only.
-- New private buckets; no existing policies or buckets are removed.
begin;
insert into storage.buckets (id,name,public,file_size_limit) values
  ('isabella-uploads','isabella-uploads',false,12582912),
  ('minds-artifacts','minds-artifacts',false,25000000)
on conflict (id) do nothing;

create policy office_romy_upload_read on storage.objects for select to authenticated
using (bucket_id='isabella-uploads' and (select private.office_is_member())
  and (storage.foldername(objects.name))[1]=(select auth.uid())::text);
create policy office_romy_upload_insert on storage.objects for insert to authenticated
with check (bucket_id='isabella-uploads' and (select private.office_is_member())
  and (storage.foldername(objects.name))[1]=(select auth.uid())::text);
create policy office_romy_upload_delete on storage.objects for delete to authenticated
using (bucket_id='isabella-uploads' and (select private.office_is_member())
  and (storage.foldername(objects.name))[1]=(select auth.uid())::text);

create policy office_romy_artifact_read on storage.objects for select to authenticated
using (bucket_id='minds-artifacts' and (select private.office_is_member())
  and (storage.foldername(objects.name))[1]=(select auth.uid())::text);
create policy office_romy_artifact_insert on storage.objects for insert to authenticated
with check (bucket_id='minds-artifacts' and (select private.office_is_member())
  and (storage.foldername(objects.name))[1]=(select auth.uid())::text);
create policy office_romy_artifact_delete on storage.objects for delete to authenticated
using (bucket_id='minds-artifacts' and (select private.office_is_member())
  and (storage.foldername(objects.name))[1]=(select auth.uid())::text);

-- A restrictive policy is combined (AND) with existing permissive Office
-- policies; no policy is replaced. Project folders require explicit team membership.
create policy office_romy_work_storage_read_guard on storage.objects as restrictive for select to authenticated
using (bucket_id<>'minds-work' or
  ((select private.office_is_member()) and (
    (storage.foldername(objects.name))[2]='office'
    or ((storage.foldername(objects.name))[2]='personal' and (storage.foldername(objects.name))[1]=(select auth.uid())::text)
    or exists (select 1 from public.office_projects p
      where p.id::text=(storage.foldername(objects.name))[2]
        and (select private.office_project_team_has_access(p.id)))
  )));
create policy office_romy_work_storage_insert_guard on storage.objects as restrictive for insert to authenticated
with check (bucket_id<>'minds-work' or
  ((select private.office_is_member())
    and (storage.foldername(objects.name))[1]=(select auth.uid())::text
    and ((storage.foldername(objects.name))[2] in ('office','personal')
      or exists (select 1 from public.office_projects p
        where p.id::text=(storage.foldername(objects.name))[2]
          and (select private.office_project_team_has_access(p.id)))
  )));
create policy office_romy_work_storage_delete_guard on storage.objects as restrictive for delete to authenticated
using (bucket_id<>'minds-work' or
  ((select private.office_is_member())
    and (storage.foldername(objects.name))[1]=(select auth.uid())::text
    and ((storage.foldername(objects.name))[2] in ('office','personal')
      or exists (select 1 from public.office_projects p
        where p.id::text=(storage.foldername(objects.name))[2]
          and (select private.office_project_team_has_access(p.id)))
  )));

-- Existing Office file/folder policies remain. This narrows project reads,
-- while unprojected Office-wide folders continue to work.
create policy office_romy_work_files_team_guard on public.minds_work_files as restrictive for select to authenticated
using (project_id is null or (select private.office_project_team_has_access(project_id)));
create policy office_romy_work_folders_team_guard on public.minds_work_folders as restrictive for select to authenticated
using (project_id is null or (select private.office_project_team_has_access(project_id)));
commit;
