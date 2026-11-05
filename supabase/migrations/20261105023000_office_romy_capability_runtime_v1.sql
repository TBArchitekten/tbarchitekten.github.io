-- Romy / Office: adapt Window Build 79 Capability Runtime tables to
-- per-employee Office conversations. No new agent, quota or autonomy.
create table public.office_romy_capability_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 conversation_id uuid not null,
 request_id uuid not null references public.office_assistant_requests(id) on delete cascade,
 tool_call_id text not null check(length(tool_call_id) between 1 and 200),
 capability text not null default 'general_execution' check(capability='general_execution'),
 title text not null check(length(btrim(title)) between 1 and 240),
 request text not null check(length(btrim(request)) between 1 and 20000),
 status text not null default 'queued'
   check(status in ('queued','in_progress','completed','failed','cancelled','incomplete')),
 provider text not null default 'openai_responses' check(provider='openai_responses'),
 provider_response_id text unique,
 provider_container_id text,
 artifact_ids uuid[] not null default '{}',
 summary text not null default '',
 error text,
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object'),
 started_at timestamptz, completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(request_id,tool_call_id),
 foreign key(conversation_id,user_id)
   references public.office_assistant_conversations(id,user_id) on delete cascade
);
create index office_romy_capability_runs_user_status_updated_idx
 on public.office_romy_capability_runs(user_id,status,updated_at desc);
create index office_romy_capability_runs_conversation_idx
 on public.office_romy_capability_runs(conversation_id,created_at desc);
create index office_romy_capability_runs_request_idx
 on public.office_romy_capability_runs(request_id);
alter table public.office_romy_capability_runs enable row level security;
revoke all on public.office_romy_capability_runs from public,anon,authenticated;
grant select on public.office_romy_capability_runs to authenticated;
create policy office_romy_capability_runs_owner_select
 on public.office_romy_capability_runs for select to authenticated
 using (user_id=(select auth.uid()) and (select private.office_is_member()));

alter table public.office_romy_artifacts
 drop constraint if exists office_romy_artifacts_kind_check;
alter table public.office_romy_artifacts
 add constraint office_romy_artifacts_kind_check
 check(kind in ('docx','pdf','txt','csv','xlsx','pptx','zip','html','json','markdown','image'));
alter table public.office_romy_artifacts
 add column capability_run_id uuid references public.office_romy_capability_runs(id) on delete set null;
create index office_romy_artifacts_capability_run_idx
 on public.office_romy_artifacts(capability_run_id)
 where capability_run_id is not null;
comment on table public.office_romy_capability_runs is
 'Office adaptation of Window Capability Runtime. Durable run state, owner-only; server writes only, result files remain private. Never implies project truth or authorization.';
