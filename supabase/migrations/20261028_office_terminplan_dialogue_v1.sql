-- TBA Office only: per-user plan-local conversation history.
-- No Isabella/MINDS foreign keys, credentials, tables or cross-product identity.
create table if not exists public.office_terminplan_dialogue_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.office_terminplan_instances(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role text not null check (role in ('user','assistant','system_receipt')),
  body text not null check (char_length(body) between 1 and 4000),
  event_kind text not null default 'answer' check (event_kind in ('question','answer','proposal','approval','receipt','warning')),
  request_id text check (request_id is null or char_length(request_id) <= 96),
  event_data jsonb not null default '{}'::jsonb check (jsonb_typeof(event_data) = 'object' and pg_column_size(event_data) <= 16000),
  created_at timestamptz not null default now()
);
alter table public.office_terminplan_dialogue_messages enable row level security;
revoke all on public.office_terminplan_dialogue_messages from public, anon;
grant select,insert on public.office_terminplan_dialogue_messages to authenticated;

create index if not exists office_dialogue_owner_plan_created_idx
  on public.office_terminplan_dialogue_messages(user_id,plan_id,created_at desc);

drop policy if exists office_dialogue_user_read on public.office_terminplan_dialogue_messages;
create policy office_dialogue_user_read
on public.office_terminplan_dialogue_messages for select to authenticated
using (
  user_id = (select auth.uid())
  and exists(select 1 from public.office_members m where m.user_id=(select auth.uid()) and m.is_active)
  and exists(select 1 from public.office_terminplan_instances p where p.id=plan_id)
);

drop policy if exists office_dialogue_user_insert on public.office_terminplan_dialogue_messages;
create policy office_dialogue_user_insert
on public.office_terminplan_dialogue_messages for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists(select 1 from public.office_members m where m.user_id=(select auth.uid()) and m.is_active)
  and exists(select 1 from public.office_terminplan_instances p where p.id=plan_id)
);
comment on table public.office_terminplan_dialogue_messages is
  'User-scoped Office conversation display history. Client-origin events are not trusted execution receipts.';
