-- TBA Office · Optimistic concurrency for Projektterminpläne.
-- Backward compatible: templates, Bernried project tables and existing JSON are untouched.
-- Every UPDATE increments server_revision, even for legacy editors. Clients must
-- update with id AND expected server_revision to prevent lost updates.
alter table public.office_terminplan_instances
  add column if not exists server_revision bigint not null default 1
  constraint office_terminplan_instances_revision_positive check (server_revision > 0);

create or replace function public.office_terminplan_advance_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.server_revision := old.server_revision + 1;
  return new;
end;
$$;

revoke all on function public.office_terminplan_advance_revision() from public;
revoke all on function public.office_terminplan_advance_revision() from anon;
revoke all on function public.office_terminplan_advance_revision() from authenticated;

drop trigger if exists office_terminplan_revision_update on public.office_terminplan_instances;
create trigger office_terminplan_revision_update
before update on public.office_terminplan_instances
for each row
execute function public.office_terminplan_advance_revision();

comment on column public.office_terminplan_instances.server_revision is
'Monotonic revision for conditional PostgREST updates; client must filter on expected revision.';
