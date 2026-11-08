-- Office · 09.11.2026 (Claude) · Verantwortliche einer Aufgabe speichern.
-- The task sheet (task-detail.js, task-team.js) calls minds_work_set_task_assignees, copied from Window,
-- but the function was never created in Office: choosing responsables failed with "function not found".
-- Same contract as Window (atomic, revision check, at most 16, first person = assignee_person_id, no
-- silent loss of planned days), adapted to Office: the people are active members of the project team
-- (office_project_members) and anyone who may edit the task may change who carries it. Security
-- invoker: the existing RLS on isabella_tasks and minds_work_task_assignees still decides.
-- Nothing is dropped or overwritten.
begin;

create or replace function public.minds_work_set_task_assignees(
  p_task_id uuid, p_person_ids uuid[], p_expected_updated_at timestamptz
) returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_me uuid := auth.uid();
  v_task record;
  v_ids uuid[];
  v_count integer;
begin
  if v_me is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.';
  end if;
  select t.id, t.user_id, t.assignee_person_id, t.project_id, t.updated_at into v_task
  from public.isabella_tasks t where t.id = p_task_id for update;
  if not found then raise exception 'Aufgabe nicht verfügbar.'; end if;
  if not (select private.office_can_edit_window_task(v_task.id, v_task.user_id, v_task.assignee_person_id, v_task.project_id)) then
    raise exception 'Keine Berechtigung für diese Aufgabe.';
  end if;
  if v_task.project_id is null then
    raise exception 'Verantwortliche gibt es nur bei Projektaufgaben.';
  end if;
  if v_task.updated_at is distinct from p_expected_updated_at then
    raise exception 'Die Aufgabe wurde inzwischen geändert. Bitte neu öffnen.';
  end if;
  select coalesce(array_agg(person_id order by first_pos), array[]::uuid[]) into v_ids
  from (
    select p.person_id, min(p.ord) as first_pos
    from unnest(coalesce(p_person_ids, array[]::uuid[])) with ordinality p(person_id, ord)
    where p.person_id is not null
    group by p.person_id
  ) selected;
  if cardinality(v_ids) > 16 then raise exception 'Höchstens 16 Verantwortliche.'; end if;
  select count(*) into v_count
  from public.office_project_members m
  join public.office_members o on o.user_id = m.user_id and o.is_active
  where m.project_id = v_task.project_id and m.user_id = any(v_ids);
  if v_count <> cardinality(v_ids) then
    raise exception 'Nur Mitglieder des Projektteams können verantwortlich sein.';
  end if;
  if exists(
    select 1 from public.minds_work_task_allocations a
    where a.task_id = p_task_id and not (a.person_id = any(v_ids))
  ) then
    raise exception 'Bitte zuerst die geplanten Tage dieser Person entfernen.';
  end if;
  delete from public.minds_work_task_assignees
   where task_id = p_task_id and not (person_id = any(v_ids));
  insert into public.minds_work_task_assignees(task_id, person_id, project_id, user_id)
   select p_task_id, p, v_task.project_id, v_me from unnest(v_ids) p
   on conflict (task_id, person_id) do nothing;
  update public.isabella_tasks
     set assignee_person_id = v_ids[1],
         assignee = (select o.display_name from public.office_members o where o.user_id = v_ids[1]),
         updated_at = clock_timestamp()
   where id = p_task_id;
  return v_ids;
end
$function$;

revoke all on function public.minds_work_set_task_assignees(uuid, uuid[], timestamptz) from public, anon;
grant execute on function public.minds_work_set_task_assignees(uuid, uuid[], timestamptz) to authenticated;

commit;
