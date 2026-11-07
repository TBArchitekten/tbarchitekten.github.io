-- TBA Office · Assistent individual: remove unapproved application quota.
-- Gari did not authorize a numeric daily request limit. This supersedes the
-- hard-coded 15/day rule introduced by the assistant in v1.
-- Retain authentication, office-membership checks, conversation ownership,
-- atomic request deduplication and usage records; no new numerical cap.
-- This does NOT modify the separate Terminplan AI quota.

create or replace function public.office_assistant_reserve(
  p_request_id uuid, p_conversation_id uuid, p_mode text
) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or p_request_id is null or p_conversation_id is null
     or p_mode not in ('standard','gruendlich') then
    return 'invalid';
  end if;
  if not (select private.office_is_member()) then
    return 'forbidden';
  end if;
  if not exists (
    select 1 from public.office_members m
    where m.user_id=uid and m.is_active and not m.must_change_password
  ) then
    return 'forbidden';
  end if;
  if not exists (
    select 1 from public.office_assistant_conversations c
    where c.id=p_conversation_id and c.user_id=uid
  ) then
    return 'not_found';
  end if;

  -- Prevent concurrent duplicate reservations, not user activity.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('office-personal-chat:' || uid::text)::bigint
  );
  if exists (
    select 1 from public.office_assistant_requests r
    where r.id=p_request_id
  ) then
    return 'duplicate';
  end if;

  insert into public.office_assistant_requests (
    id,user_id,conversation_id,mode
  ) values (p_request_id,uid,p_conversation_id,p_mode);
  return 'reserved';
end;
$$;

revoke all on function public.office_assistant_reserve(uuid,uuid,text) from public,anon;
grant execute on function public.office_assistant_reserve(uuid,uuid,text) to authenticated;

comment on function public.office_assistant_reserve(uuid,uuid,text) is
  'Authenticate and deduplicate each personal assistant request; log usage without imposing an unapproved request quota. Budget policy pending office decision.';
