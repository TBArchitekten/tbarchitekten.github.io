-- Romy per member: owner-scoped proposals requiring explicit review before write.
-- No autonomous actions; all applied changes are checked again through user JWT
-- and existing isabella_tasks / isabella_events RLS.
create table public.office_romy_proposals (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.office_assistant_requests(id) on delete cascade,
 conversation_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('create_task','create_event')),
 payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','applying','applied','rejected')),
 result_id uuid,
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 foreign key (conversation_id,user_id) references
   public.office_assistant_conversations(id,user_id) on delete cascade
);
create index office_romy_proposals_owner_idx
 on public.office_romy_proposals(user_id,conversation_id,created_at desc);
alter table public.office_romy_proposals enable row level security;
revoke all on public.office_romy_proposals from public,anon,authenticated;
grant select on public.office_romy_proposals to authenticated;
create policy office_romy_proposals_owner_read
 on public.office_romy_proposals for select to authenticated using (
  (select private.office_is_member()) and user_id=(select auth.uid())
 );
-- Only the authenticated Romy Edge Function can create or transition proposals.
-- Clients cannot fabricate a review receipt by inserting/updating this table.

-- Do not impose an unagreed maximum character count on a user's messages.
-- Data model still requires nonempty text; OpenAI's actual context is model-dependent.
alter table public.office_assistant_messages
 drop constraint if exists office_assistant_messages_content_check;
alter table public.office_assistant_messages
 add constraint office_assistant_messages_content_check
 check(length(btrim(content))>=1);
