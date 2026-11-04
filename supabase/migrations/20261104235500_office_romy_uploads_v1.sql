-- Romy · Window-compatible per-employee chat attachments.
-- Binary documents stay in private Office Supabase Storage, never GitHub.
-- A user may see or delete only files under their own /chat/ prefix.
insert into storage.buckets (id,name,public,file_size_limit)
values ('office-romy-uploads','office-romy-uploads',false,12582912);

create policy office_romy_uploads_read on storage.objects
 for select to authenticated using (
  bucket_id='office-romy-uploads'
  and (select private.office_is_member())
  and (storage.foldername(objects.name))[1]=(select auth.uid())::text
  and (storage.foldername(objects.name))[2]='chat'
);
create policy office_romy_uploads_insert on storage.objects
 for insert to authenticated with check (
  bucket_id='office-romy-uploads'
  and (select private.office_is_member())
  and (storage.foldername(objects.name))[1]=(select auth.uid())::text
  and (storage.foldername(objects.name))[2]='chat'
);
create policy office_romy_uploads_delete on storage.objects
 for delete to authenticated using (
  bucket_id='office-romy-uploads'
  and (select private.office_is_member())
  and (storage.foldername(objects.name))[1]=(select auth.uid())::text
  and (storage.foldername(objects.name))[2]='chat'
);

alter table public.office_assistant_messages
 add column attachments jsonb not null default '[]'::jsonb;
alter table public.office_assistant_messages
 add constraint office_assistant_messages_attachments_array
 check (jsonb_typeof(attachments)='array');

-- Window also allows an attachment-only turn. Preserve the user's actual
-- empty text instead of inserting invented prose into their private history.
alter table public.office_assistant_messages
 drop constraint office_assistant_messages_content_check;
alter table public.office_assistant_messages
 add constraint office_assistant_messages_content_check
 check (
  (role='assistant' and length(btrim(content))>=1)
  or (role='user' and (length(btrim(content))>=1 or jsonb_array_length(attachments)>0))
 );
