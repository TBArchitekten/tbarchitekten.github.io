-- Office AI budget guard: at most 25 model requests per Office user per UTC day.
-- No prompts, model responses, or API keys are stored in this table.
create table if not exists public.office_terminplan_ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.office_terminplan_instances(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists office_terminplan_ai_requests_user_day_idx
  on public.office_terminplan_ai_requests(user_id,created_at desc);
alter table public.office_terminplan_ai_requests enable row level security;
revoke all on public.office_terminplan_ai_requests from public,anon;
grant select,insert on public.office_terminplan_ai_requests to authenticated;

create policy office_ai_requests_self_read
  on public.office_terminplan_ai_requests for select to authenticated
  using (user_id=(select auth.uid()));
create policy office_ai_requests_self_insert
  on public.office_terminplan_ai_requests for insert to authenticated
  with check (
    user_id=(select auth.uid()) and
    exists(select 1 from public.office_members m where m.user_id=(select auth.uid()) and m.is_active)
    and exists(select 1 from public.office_terminplan_instances p where p.id=plan_id)
  );

create or replace function public.office_ai_consume_request(p_plan_id uuid)
returns boolean
language plpgsql
security invoker
set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  used integer;
begin
  if uid is null then return false; end if;
  if not exists(select 1 from public.office_members m where m.user_id=uid and m.is_active) then return false; end if;
  if not exists(select 1 from public.office_terminplan_instances p where p.id=p_plan_id) then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('office-ai-quota:'||uid::text)::bigint);
  select count(*) into used from public.office_terminplan_ai_requests
    where user_id=uid and created_at >= (pg_catalog.date_trunc('day', now() at time zone 'UTC') at time zone 'UTC');
  if used >= 25 then return false; end if;
  insert into public.office_terminplan_ai_requests(user_id,plan_id) values(uid,p_plan_id);
  return true;
end;
$$;
revoke all on function public.office_ai_consume_request(uuid) from public,anon;
grant execute on function public.office_ai_consume_request(uuid) to authenticated;

comment on function public.office_ai_consume_request(uuid) is
  'Atomic per-user daily quota for Office model requests; authenticated invoker under RLS, at most 25 per UTC day.';
