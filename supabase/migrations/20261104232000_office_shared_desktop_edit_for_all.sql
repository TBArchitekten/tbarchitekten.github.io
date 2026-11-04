-- TBA Office: document access follows the shared Windows server model.
-- Every ACTIVE office member can rename, move or delete shared Office/project
-- files and folders, independent of uploader. No access to other users'
-- personal task attachments. Folder cycles and cross-project moves remain
-- blocked by the existing guards; destructive actions still confirm in UI.
drop policy if exists office_folders_update on public.minds_work_folders;
create policy office_folders_update on public.minds_work_folders
for update to authenticated using ((select private.office_is_member()))
with check ((select private.office_is_member()));
drop policy if exists office_folders_delete on public.minds_work_folders;
create policy office_folders_delete on public.minds_work_folders
for delete to authenticated using ((select private.office_is_member()));

drop policy if exists office_files_update on public.minds_work_files;
create policy office_files_update on public.minds_work_files
for update to authenticated using ((select private.office_is_member()))
with check ((select private.office_is_member()));
drop policy if exists office_files_delete on public.minds_work_files;
create policy office_files_delete on public.minds_work_files
for delete to authenticated using ((select private.office_is_member()));

drop policy if exists office_work_storage_delete on storage.objects;
create policy office_work_storage_delete on storage.objects
for delete to authenticated using (
 bucket_id='minds-work' and (select private.office_is_member())
 and (
   ((storage.foldername(name))[2]='personal'
      and (storage.foldername(name))[1]=(select auth.uid())::text)
   or (storage.foldername(name))[2]='office'
   or exists (
      select 1 from public.office_projects p
      where p.id::text=(storage.foldername(name))[2]
   )
 )
);
