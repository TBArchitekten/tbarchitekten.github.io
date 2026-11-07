-- TBA Office · the Kalender is the calendar of your projects (decision of Gari, 07.11.2026).
-- Termine linked to a project are read by that project's team; only their author changes them
-- (the existing policy isabella_events_own stays the only one that allows writing).
-- Termine without a project stay private to their author.
create policy isabella_events_project_team_select on public.isabella_events
  for select to authenticated
  using ((select private.office_is_member())
         and project_id is not null
         and (select private.office_in_project_team(project_id)));
