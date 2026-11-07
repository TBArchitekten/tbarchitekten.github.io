-- Fix: unqualified 'name' in a correlated EXISTS was bound to office_projects.name
-- instead of the outer storage.objects.name. Explicitly qualify the outer row.
-- Restores shared read/upload/delete in project UUID directories.
drop policy if exists office_work_storage_read on storage.objects;
create policy office_work_storage_read on storage.objects
for select to authenticated using (
 bucket_id='minds-work' and (select private.office_is_member())
 and (
   (storage.foldername(objects.name))[2]='office'
   or ((storage.foldername(objects.name))[2]='personal'
        and (storage.foldername(objects.name))[1]=(select auth.uid())::text)
   or exists (
     select 1 from public.office_projects p
     where p.id::text=(storage.foldername(objects.name))[2]
   )
 )
);
drop policy if exists office_work_storage_insert on storage.objects;
create policy office_work_storage_insert on storage.objects
for insert to authenticated with check (
 bucket_id='minds-work' and (select private.office_is_member())
 and (storage.foldername(objects.name))[1]=(select auth.uid())::text
 and (
    (storage.foldername(objects.name))[2] in ('office','personal')
    or exists(
      select 1 from public.office_projects p
      where p.id::text=(storage.foldername(objects.name))[2]
        and p.status='aktiv'
    )
 )
);
drop policy if exists office_work_storage_delete on storage.objects;
create policy office_work_storage_delete on storage.objects
for delete to authenticated using (
 bucket_id='minds-work' and (select private.office_is_member())
 and (
   ((storage.foldername(objects.name))[2]='personal'
      and (storage.foldername(objects.name))[1]=(select auth.uid())::text)
   or (storage.foldername(objects.name))[2]='office'
   or exists (
      select 1 from public.office_projects p
      where p.id::text=(storage.foldername(objects.name))[2]
   )
 )
);
