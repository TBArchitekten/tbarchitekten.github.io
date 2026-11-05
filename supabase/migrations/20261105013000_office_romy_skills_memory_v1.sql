-- Romy Skills + reviewed personal memory. Contracts follow Window Build 81:
-- Skills teach; tools act; neither grants authority. Memory is accepted only
-- after the owner reviews a proposal, not inferred from chat text.
create table public.office_romy_memories (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('fact','preference')),
 content text not null check(length(btrim(content))>0),
 source_conversation_id uuid not null,
 source_request_id uuid not null references public.office_assistant_requests(id) on delete cascade,
 provenance text not null default 'owner_reviewed_proposal'
  check(provenance='owner_reviewed_proposal'),
 status text not null default 'accepted' check(status in ('accepted','retracted')),
 created_at timestamptz not null default now(),
 retracted_at timestamptz,
 foreign key(source_conversation_id,user_id)
  references public.office_assistant_conversations(id,user_id) on delete cascade
);
create index office_romy_memories_owner_state_created_idx
 on public.office_romy_memories(user_id,status,created_at desc);
create index office_romy_memories_source_request_idx
 on public.office_romy_memories(source_request_id);
alter table public.office_romy_memories enable row level security;
revoke all on public.office_romy_memories from public,anon,authenticated;
grant select on public.office_romy_memories to authenticated;
-- Retract only. Employees cannot forge or edit an accepted memory.
grant update(status,retracted_at) on public.office_romy_memories to authenticated;
create policy office_romy_memories_owner_read
 on public.office_romy_memories for select to authenticated
 using ((select private.office_is_member()) and user_id=(select auth.uid()));
create policy office_romy_memories_owner_retract
 on public.office_romy_memories for update to authenticated
 using ((select private.office_is_member())
  and user_id=(select auth.uid()) and status='accepted')
 with check ((select private.office_is_member())
  and user_id=(select auth.uid()) and status='retracted');

alter table public.office_romy_proposals
 drop constraint office_romy_proposals_kind_check;
alter table public.office_romy_proposals
 add constraint office_romy_proposals_kind_check
 check(kind in ('create_task','create_event','remember'));

alter table public.office_assistant_requests
 add column skill_trace jsonb not null default '[]'::jsonb;
alter table public.office_assistant_requests
 add constraint office_assistant_requests_skill_trace_array
 check(jsonb_typeof(skill_trace)='array' and jsonb_array_length(skill_trace)<=4);

comment on table public.office_romy_memories is
 'Owner-confirmed memories with source conversation and request. Inference and chat text do not become memory without review.';
comment on column public.office_assistant_requests.skill_trace is
 'Versioned system skill lineage, normalized through the Window skill registry; does not convey permissions.';
