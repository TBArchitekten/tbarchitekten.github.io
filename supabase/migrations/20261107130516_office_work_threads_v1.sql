-- TBA Office · private project Threads in Work (decision of Gari, 07.11.2026: private, like Window).
-- A Thread is a Romy conversation bound to one project. Only its owner sees it; no admin can read it.
-- Romy's own chat list leaves Thread conversations out (work_thread = true).

alter table public.office_assistant_conversations
  add column work_thread boolean not null default false;

create table public.minds_work_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.office_projects(id) on delete cascade,
  conversation_id uuid unique,
  title text not null check (length(btrim(title)) between 1 and 160),
  summary text check (summary is null or length(summary) <= 4000),
  status text not null default 'active' check (status in ('active','archived')),
  capability_profile text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The conversation must belong to the same person.
  foreign key (conversation_id, user_id)
    references public.office_assistant_conversations(id, user_id) on delete set null (conversation_id)
);
create unique index minds_work_threads_active_title
  on public.minds_work_threads(user_id, project_id, lower(btrim(title))) where status = 'active';
create index minds_work_threads_project_idx
  on public.minds_work_threads(user_id, project_id, status, sort_order, updated_at desc);

alter table public.minds_work_threads enable row level security;
revoke all on public.minds_work_threads from public, anon, authenticated;
grant select, insert, update, delete on public.minds_work_threads to authenticated;

create policy minds_work_threads_select on public.minds_work_threads
  for select to authenticated using ((select private.office_is_member()) and user_id = (select auth.uid()));
create policy minds_work_threads_insert on public.minds_work_threads
  for insert to authenticated with check ((select private.office_is_member()) and user_id = (select auth.uid()));
create policy minds_work_threads_update on public.minds_work_threads
  for update to authenticated
  using ((select private.office_is_member()) and user_id = (select auth.uid()))
  with check ((select private.office_is_member()) and user_id = (select auth.uid()));
create policy minds_work_threads_delete on public.minds_work_threads
  for delete to authenticated using ((select private.office_is_member()) and user_id = (select auth.uid()));

-- The same small RPCs as Window's Work uses; they run as the caller, so RLS still applies.
create function public.minds_ensure_work_thread_conversation(p_thread_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_title text;
  v_conversation uuid;
begin
  select title, conversation_id into v_title, v_conversation
    from public.minds_work_threads where id = p_thread_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'thread_not_found' using errcode = 'P0002'; end if;
  if v_conversation is not null then return v_conversation; end if;
  insert into public.office_assistant_conversations(user_id, title, work_thread)
    values ((select auth.uid()), left(v_title, 140), true) returning id into v_conversation;
  update public.minds_work_threads set conversation_id = v_conversation, updated_at = now() where id = p_thread_id;
  return v_conversation;
end $$;

create function public.minds_rename_work_thread(p_thread_id uuid, p_title text) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_conversation uuid;
begin
  update public.minds_work_threads set title = btrim(p_title), updated_at = now()
    where id = p_thread_id and user_id = (select auth.uid()) returning conversation_id into v_conversation;
  if not found then raise exception 'thread_not_found' using errcode = 'P0002'; end if;
  if v_conversation is not null then
    update public.office_assistant_conversations set title = left(btrim(p_title), 140), updated_at = now()
      where id = v_conversation and user_id = (select auth.uid());
  end if;
end $$;

create function public.minds_set_work_thread_status(p_thread_id uuid, p_status text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_status not in ('active', 'archived') then raise exception 'invalid_status' using errcode = '22023'; end if;
  update public.minds_work_threads set status = p_status, updated_at = now()
    where id = p_thread_id and user_id = (select auth.uid());
  if not found then raise exception 'thread_not_found' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.minds_ensure_work_thread_conversation(uuid) from public, anon;
revoke all on function public.minds_rename_work_thread(uuid, text) from public, anon;
revoke all on function public.minds_set_work_thread_status(uuid, text) from public, anon;
grant execute on function public.minds_ensure_work_thread_conversation(uuid) to authenticated;
grant execute on function public.minds_rename_work_thread(uuid, text) to authenticated;
grant execute on function public.minds_set_work_thread_status(uuid, text) to authenticated;
