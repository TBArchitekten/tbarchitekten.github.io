-- TBA Office · KI-Assistent der Kostenberechnung (21.11.2026, Claude; Auftrag Gari: ein KI-Assistent wie beim
-- Terminplan, aber für die Kosten). Wie beim Terminplan: Gesprächsverlauf je Person und ein Tageskontingent.
-- Der Assistent schreibt nie selbst in eine Kostenberechnung; Vorschläge übernimmt der Client erst nach
-- «Prüfen und übernehmen», mit derselben Revisionsprüfung wie jede andere Änderung. Nichts Destruktives.

create table public.office_kosten_dialogue_messages (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.office_kosten_instances(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role text not null check (role in ('user','assistant')),
  body text not null check (char_length(body) between 1 and 4000),
  event_kind text not null default 'answer' check (event_kind in ('question','answer','proposal','receipt','warning')),
  event_data jsonb not null default '{}'::jsonb check (jsonb_typeof(event_data) = 'object' and pg_column_size(event_data) <= 16000),
  created_at timestamptz not null default now()
);
create index office_kosten_dialogue_lookup_idx on public.office_kosten_dialogue_messages(instance_id, user_id, created_at desc);
create index office_kosten_dialogue_user_idx on public.office_kosten_dialogue_messages(user_id);
comment on table public.office_kosten_dialogue_messages is
  'Gespräch mit dem KI-Assistenten der Kostenberechnung, je Person und Kostenberechnung; nur die Person selbst sieht es.';

create table public.office_kosten_ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  instance_id uuid not null references public.office_kosten_instances(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index office_kosten_ai_requests_user_day_idx on public.office_kosten_ai_requests(user_id, created_at desc);
create index office_kosten_ai_requests_instance_idx on public.office_kosten_ai_requests(instance_id);

alter table public.office_kosten_dialogue_messages enable row level security;
alter table public.office_kosten_ai_requests enable row level security;
revoke all on public.office_kosten_dialogue_messages, public.office_kosten_ai_requests from public, anon, authenticated;
grant select, insert on public.office_kosten_dialogue_messages to authenticated;
grant select, insert on public.office_kosten_ai_requests to authenticated;

-- Nur die eigenen Zeilen, und nur zu einer Kostenberechnung, die die Person sehen darf.
create policy office_kosten_dialogue_self_read on public.office_kosten_dialogue_messages
  for select to authenticated
  using (user_id = (select auth.uid())
         and exists(select 1 from public.office_kosten_instances i
                    where i.id = instance_id and (select private.office_can_read_kosten(i.owner_id, i.project_id))));
create policy office_kosten_dialogue_self_insert on public.office_kosten_dialogue_messages
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists(select 1 from public.office_kosten_instances i
                         where i.id = instance_id and (select private.office_can_read_kosten(i.owner_id, i.project_id))));
create policy office_kosten_ai_requests_self_read on public.office_kosten_ai_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy office_kosten_ai_requests_self_insert on public.office_kosten_ai_requests
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists(select 1 from public.office_kosten_instances i
                         where i.id = instance_id and (select private.office_can_read_kosten(i.owner_id, i.project_id))));

-- Tageskontingent vor jedem bezahlten Modellaufruf, wie office_ai_consume_request beim Terminplan.
create function public.office_kosten_ai_consume_request(p_instance_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  used integer;
begin
  if uid is null then return false; end if;
  if not (select private.office_is_member()) then return false; end if;
  if not exists(select 1 from public.office_kosten_instances i where i.id = p_instance_id) then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('office-kosten-ai-quota:' || uid::text)::bigint);
  select count(*) into used from public.office_kosten_ai_requests
    where user_id = uid and created_at >= (pg_catalog.date_trunc('day', now() at time zone 'UTC') at time zone 'UTC');
  if used >= 25 then return false; end if;
  insert into public.office_kosten_ai_requests(user_id, instance_id) values (uid, p_instance_id);
  return true;
end;
$$;
revoke all on function public.office_kosten_ai_consume_request(uuid) from public, anon;
grant execute on function public.office_kosten_ai_consume_request(uuid) to authenticated;
comment on function public.office_kosten_ai_consume_request(uuid) is
  'Tageskontingent je Person für den KI-Assistenten der Kostenberechnung: höchstens 25 Anfragen je UTC-Tag, nur für sichtbare Kostenberechnungen.';
