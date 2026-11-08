-- Office · Verantwortliche speichern (09.11.2026). Fictitious people, ephemeral database only, rolled back.
begin;
insert into auth.users (id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values
('61111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ta1@fixture.invalid','',now(),now()),
('62222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ta2@fixture.invalid','',now(),now()),
('63333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ta3@fixture.invalid','',now(),now())
on conflict (id) do nothing;
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password)
values
('61111111-1111-4111-8111-111111111111','ta1@fixture.invalid','Alex Beispiel','member',true,false),
('62222222-2222-4222-8222-222222222222','ta2@fixture.invalid','Mara Muster','member',true,false),
('63333333-3333-4333-8333-333333333333','ta3@fixture.invalid','Nico Außen','member',true,false)
on conflict (user_id) do nothing;
insert into public.office_projects(id,number,name,created_by,status)
values ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TMP-T','Project T (fictional)','61111111-1111-4111-8111-111111111111','aktiv')
on conflict (id) do nothing;
insert into public.office_project_members(project_id,user_id,added_by)
values
('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','61111111-1111-4111-8111-111111111111','61111111-1111-4111-8111-111111111111'),
('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','62222222-2222-4222-8222-222222222222','61111111-1111-4111-8111-111111111111')
on conflict do nothing;
insert into public.isabella_tasks(id,user_id,title,project_id)
values ('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','61111111-1111-4111-8111-111111111111','Fixture-Aufgabe','6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

set local role authenticated;
select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
do $test$
declare v_rev timestamptz; v_ids uuid[]; v_denied boolean;
begin
  select updated_at into v_rev from public.isabella_tasks where id='6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_ids:=public.minds_work_set_task_assignees('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    array['62222222-2222-4222-8222-222222222222','61111111-1111-4111-8111-111111111111','62222222-2222-4222-8222-222222222222']::uuid[],v_rev);
  if v_ids<>array['62222222-2222-4222-8222-222222222222','61111111-1111-4111-8111-111111111111']::uuid[] then
    raise exception 'assignees not saved in order without duplicates: %',v_ids; end if;
  if (select count(*) from public.minds_work_task_assignees where task_id='6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>2 then
    raise exception 'assignee rows missing'; end if;
  if not exists(select 1 from public.isabella_tasks where id='6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and assignee_person_id='62222222-2222-4222-8222-222222222222' and assignee='Mara Muster') then
    raise exception 'first responsible not projected on the task'; end if;
  -- A stale sheet must not overwrite a newer change.
  v_denied:=false;
  begin perform public.minds_work_set_task_assignees('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',array[]::uuid[],v_rev);
  exception when others then v_denied:=true; end;
  if not v_denied then raise exception 'stale revision accepted'; end if;
  -- Only members of the project team.
  select updated_at into v_rev from public.isabella_tasks where id='6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_denied:=false;
  begin perform public.minds_work_set_task_assignees('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',array['63333333-3333-4333-8333-333333333333']::uuid[],v_rev);
  exception when others then v_denied:=true; end;
  if not v_denied then raise exception 'person outside the team assigned'; end if;
  -- Clearing works and leaves no responsable.
  v_ids:=public.minds_work_set_task_assignees('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',array[]::uuid[],v_rev);
  if cardinality(v_ids)<>0 or exists(select 1 from public.minds_work_task_assignees where task_id='6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then
    raise exception 'clearing failed'; end if;
end $test$;

-- Someone outside the project team cannot change who carries the task.
select set_config('request.jwt.claim.sub','63333333-3333-4333-8333-333333333333',true);
do $test$
declare v_rev timestamptz:=now(); v_denied boolean:=false;
begin
  begin perform public.minds_work_set_task_assignees('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',array['61111111-1111-4111-8111-111111111111']::uuid[],v_rev);
  exception when others then v_denied:=true; end;
  if not v_denied then raise exception 'non-team member changed responsables'; end if;
end $test$;
reset role;
rollback;
