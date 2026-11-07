-- TBA Office / Romy: scoped document artifacts, adapting Window's
-- isabella-artifact + minds-artifacts contract. No shared user data.
-- System generation uses a verified member JWT and service-side writer.
create table public.office_romy_artifacts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null,
 request_id uuid not null references public.office_assistant_requests(id) on delete cascade,
 kind text not null check(kind in ('docx','pdf','txt','csv')),
 title text not null check(length(btrim(title)) between 1 and 180),
 mime_type text not null,
 storage_path text not null unique,
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=25000000),
 content_sha256 text not null check(content_sha256~'^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 foreign key(conversation_id,user_id)
 references public.office_assistant_conversations(id,user_id) on delete cascade
);
create index office_romy_artifacts_owner_created_idx
 on public.office_romy_artifacts(user_id,created_at desc);
create index office_romy_artifacts_request_idx
 on public.office_romy_artifacts(request_id);
alter table public.office_romy_artifacts enable row level security;
revoke all on public.office_romy_artifacts from public,anon,authenticated;
grant select on public.office_romy_artifacts to authenticated;
create policy office_romy_artifacts_owner_read
 on public.office_romy_artifacts for select to authenticated
 using ((select private.office_is_member()) and user_id=(select auth.uid()));

-- Persist reference to actual generated files in the existing conversation.
alter table public.office_assistant_messages
 add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.office_assistant_messages
 add constraint office_assistant_messages_metadata_object
 check (jsonb_typeof(metadata)='object');

insert into storage.buckets(id,name,public,file_size_limit)
values ('office-romy-artifacts','office-romy-artifacts',false,25000000)
on conflict(id) do update set public=false,file_size_limit=25000000;

-- Browser may download only its own generated files. Upload and deletion
-- happen on the server after JWT verification, never via an anonymous client.
create policy office_romy_artifacts_private_read on storage.objects
 for select to authenticated
 using (bucket_id='office-romy-artifacts'
   and (storage.foldername(objects.name))[1]=(select auth.uid())::text
   and (select private.office_is_member()));

comment on table public.office_romy_artifacts is
 'Romy deliverables: private per-employee output with source conversation and request, independent from Window/Isabella.';
