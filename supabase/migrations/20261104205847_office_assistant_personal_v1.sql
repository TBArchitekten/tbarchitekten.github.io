-- Office personal assistant v1 (NOT Window/Isabella).
-- Every office member has private, durable conversations and an independent daily quota.
-- No chat data is stored in the public repository; no cross-user assistant access.

create table public.office_assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Neues Gespräch' check (length(btrim(title)) between 1 and 140),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,user_id)
);
create index office_assistant_conversations_user_idx
  on public.office_assistant_conversations(user_id,updated_at desc);

create table public.office_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null check (length(btrim(content)) between 1 and 24000),
  created_at timestamptz not null default now(),
  unique (user_id,request_id,role),
  foreign key (conversation_id,user_id)
    references public.office_assistant_conversations(id,user_id) on delete cascade
);
create index office_assistant_messages_order_idx
  on public.office_assistant_messages(conversation_id,created_at,id);

create table public.office_assistant_requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  mode text not null check (mode in ('standard','gruendlich')),
  created_at timestamptz not null default now(),
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  model text,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  foreign key (conversation_id,user_id)
    references public.office_assistant_conversations(id,user_id) on delete cascade
);
create index office_assistant_requests_daily_idx
  on public.office_assistant_requests(user_id,created_at desc);

alter table public.office_assistant_conversations enable row level security;
alter table public.office_assistant_messages enable row level security;
alter table public.office_assistant_requests enable row level security;

revoke all on public.office_assistant_conversations,
  public.office_assistant_messages, public.office_assistant_requests
  from public,anon,authenticated;
grant select,insert,update,delete on public.office_assistant_conversations to authenticated;
grant select on public.office_assistant_messages,public.office_assistant_requests to authenticated;
grant insert on public.office_assistant_requests to authenticated;

-- No office administrator may read a colleague's private conversation through RLS.
create policy office_assistant_conversations_select on public.office_assistant_conversations
  for select to authenticated using
  ((select private.office_is_member()) and user_id=(select auth.uid()));
create policy office_assistant_conversations_insert on public.office_assistant_conversations
  for insert to authenticated with check
  ((select private.office_is_member()) and user_id=(select auth.uid()));
create policy office_assistant_conversations_update on public.office_assistant_conversations
  for update to authenticated
  using ((select private.office_is_member()) and user_id=(select auth.uid()))
  with check ((select private.office_is_member()) and user_id=(select auth.uid()));
create policy office_assistant_conversations_delete on public.office_assistant_conversations
  for delete to authenticated using
  ((select private.office_is_member()) and user_id=(select auth.uid()));

create policy office_assistant_messages_select on public.office_assistant_messages
  for select to authenticated using
  ((select private.office_is_member()) and user_id=(select auth.uid()));
-- No client INSERT/UPDATE/DELETE grants on messages: only the authenticated,
-- owner-checked server function can persist genuine assistant output.

create policy office_assistant_requests_select on public.office_assistant_requests
  for select to authenticated using
  ((select private.office_is_member()) and user_id=(select auth.uid()));
create policy office_assistant_requests_insert on public.office_assistant_requests
  for insert to authenticated with check
  ((select private.office_is_member()) and user_id=(select auth.uid()));

-- A single atomic reservation per user and UTC day. This limits paid calls
-- to 15 per member/day until Gari decides a monthly budget; count all attempts.
-- Request IDs are caller-supplied UUIDs, strictly unique, preventing charged retries.
create function public.office_assistant_reserve(
  p_request_id uuid, p_conversation_id uuid, p_mode text
) returns text
language plpgsql security invoker set search_path='' as $$
declare
  uid uuid := (select auth.uid());
  used integer;
begin
  if uid is null or p_request_id is null or p_conversation_id is null
    or p_mode not in ('standard','gruendlich') then return 'invalid'; end if;
  if not (select private.office_is_member()) then return 'forbidden'; end if;
  if not exists(select 1 from public.office_members m
    where m.user_id=uid and m.is_active and not m.must_change_password) then
    return 'forbidden';
  end if;
  if not exists(select 1 from public.office_assistant_conversations c
    where c.id=p_conversation_id and c.user_id=uid) then return 'not_found'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('office-personal-chat:'||uid::text)::bigint);
  if exists(select 1 from public.office_assistant_requests r
    where r.id=p_request_id) then return 'duplicate'; end if;

  select count(*) into used from public.office_assistant_requests r
    where r.user_id=uid
      and r.created_at>=pg_catalog.date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if used>=15 then return 'daily_limit'; end if;
  insert into public.office_assistant_requests(id,user_id,conversation_id,mode)
    values(p_request_id,uid,p_conversation_id,p_mode);
  return 'reserved';
end;
$$;
revoke all on function public.office_assistant_reserve(uuid,uuid,text) from public,anon;
grant execute on function public.office_assistant_reserve(uuid,uuid,text) to authenticated;

comment on table public.office_assistant_messages is
  'Private personal chat history; server-written, owner-read only. Not project/team discussions.';
comment on function public.office_assistant_reserve(uuid,uuid,text) is
  'Atomic 15-per-UTC-day model-call reservations per active office employee. No silent shared budget.';
