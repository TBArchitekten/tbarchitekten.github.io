-- Romy · Phase 2 · explicit decision D1: direct creation of dictated tasks/events.
-- New Office members default to direct; D2 still uses review. No existing
-- preference is overwritten, so an explicit 'review' choice remains authoritative.
-- Every direct create still requires exact owner evidence, an audited DB receipt,
-- server readback and a bounded Undo RPC. No records are deleted.
begin;
alter table public.minds_calendar_execution_preferences
  alter column create_mode set default 'direct';

create or replace function private.office_romy_default_calendar_create_mode()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
begin
  if new.is_active is true then
    insert into public.minds_calendar_execution_preferences(user_id,create_mode)
    values (new.user_id,'direct')
    on conflict (user_id) do nothing;
  end if;
  return new;
end $fn$;

revoke all on function private.office_romy_default_calendar_create_mode()
  from public, anon, authenticated;

do $guard$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.office_members'::regclass
      and tgname='office_romy_calendar_create_default_v1'
  ) then
    create trigger office_romy_calendar_create_default_v1
      after insert or update on public.office_members
      for each row execute function private.office_romy_default_calendar_create_mode();
  end if;
end $guard$;

insert into public.minds_calendar_execution_preferences(user_id,create_mode)
select user_id,'direct' from public.office_members where is_active is true
on conflict(user_id) do nothing;

commit;
