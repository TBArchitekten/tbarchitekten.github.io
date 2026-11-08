-- Phase 1, isolated PostgreSQL/Supabase CLI. All identities and names are invented.
-- Runs only on an ephemeral local database. Transaction rolls back synthetic rows.
begin;

-- Three fictional users: two distinct project teams and an admin with no team.
insert into auth.users (id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u1@fixture.invalid','',now(),now()),
('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u2@fixture.invalid','',now(),now()),
('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u3@fixture.invalid','',now(),now())
on conflict (id) do nothing;
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password)
values
('11111111-1111-4111-8111-111111111111','u1@fixture.invalid','Fixture Alpha','member',true,false),
('22222222-2222-4222-8222-222222222222','u2@fixture.invalid','Fixture Beta','member',true,false),
('33333333-3333-4333-8333-333333333333','u3@fixture.invalid','Fixture Admin','admin',true,false)
on conflict (user_id) do nothing;
insert into public.office_projects(id,number,name,created_by,status)
values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TMP-P','Project P (fictional)','11111111-1111-4111-8111-111111111111','aktiv'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','TMP-Q','Project Q (fictional)','22222222-2222-4222-8222-222222222222','aktiv')
on conflict (id) do nothing;
insert into public.office_project_members(project_id,user_id,added_by)
values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222')
on conflict do nothing;

insert into public.minds_agent_runs(user_id,feature)
values ('11111111-1111-4111-8111-111111111111','fixture_one'),
       ('22222222-2222-4222-8222-222222222222','fixture_two');
insert into public.conversations(id,user_id,app_scope)
values ('44444444-4444-4444-8444-444444444441','11111111-1111-4111-8111-111111111111','isabella'),
       ('44444444-4444-4444-8444-444444444442','22222222-2222-4222-8222-222222222222','isabella');
insert into public.conversation_messages(user_id,conversation_id,role,content,client_key)
values ('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444441','user','Synthetic turn A','fixture-a'),
       ('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444442','user','Synthetic turn B','fixture-b');
insert into public.minds_work_claims(user_id,project_id,statement)
values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic project claim P'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic project claim Q');
insert into public.minds_work_files(user_id,project_id,name,storage_path)
values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fixture-p.pdf','11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/fixture-p.pdf'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','fixture-q.pdf','22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/fixture-q.pdf');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);

do $test$
begin
  if (select count(*) from public.minds_agent_runs where feature like 'fixture_%')<>1 then
    raise exception 'owner A must not read user B runtime records';
  end if;
  if (select count(*) from public.conversations where id::text like '44444444-%')<>1 then
    raise exception 'owner A must not read user B conversations';
  end if;
  if (select count(*) from public.conversation_messages where content like 'Synthetic%')<>1 then
    raise exception 'owner A must not read user B conversation text';
  end if;
  if not (select private.office_project_team_has_access('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)) then
    raise exception 'member A must be authorized in project P';
  end if;
  if (select private.office_project_team_has_access('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) then
    raise exception 'member A must not be authorized in project Q';
  end if;
  if (select count(*) from public.minds_work_claims where statement like 'Synthetic%')<>1 then
    raise exception 'Akte P must not expose Akte Q';
  end if;
  if (select count(*) from public.minds_work_files where name like 'fixture-%')<>1 then
    raise exception 'project file metadata must require team membership';
  end if;
  if has_table_privilege('authenticated','public.isabella_runtime_secrets','SELECT') then
    raise exception 'no authenticated user may read runtime secrets';
  end if;
  if has_table_privilege('authenticated','public.minds_calendar_action_receipts','INSERT') then
    raise exception 'owners may not forge action receipts';
  end if;
  if has_table_privilege('authenticated','public.minds_work_claims','INSERT') then
    raise exception 'Akte review rules cannot be bypassed by direct REST writes';
  end if;
end
$test$;

-- A user's current message may be inserted; an assistant or app notice cannot be forged.
insert into public.conversation_messages(user_id,conversation_id,role,content,client_key,provenance_class)
values ('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444441','user','Synthetic owner turn','fixture-client','owner');
do $negative$
begin
  begin
    insert into public.conversation_messages(user_id,conversation_id,role,content,client_key)
    values ('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444441','assistant','Forged result','fixture-forgery');
    raise exception 'unauthorized assistant insertion succeeded';
  exception when insufficient_privilege then null;
  end;
end
$negative$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $test$
begin
  if (select count(*) from public.minds_agent_runs where feature like 'fixture_%')<>1 then
    raise exception 'owner B must not read user A runtime records';
  end if;
  if (select count(*) from public.minds_work_claims where statement like 'Synthetic%')<>1 then
    raise exception 'B can read Q, not P';
  end if;
  if (select count(*) from public.conversation_messages where content like 'Synthetic%')<>1 then
    raise exception 'B must not read user A conversation';
  end if;
end
$test$;

-- An administrator who is not part of either team has no implicit personal/Akte visibility.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $test$
begin
  if (select count(*) from public.minds_agent_runs where feature like 'fixture_%')<>0 then
    raise exception 'admin must not read other users personal state';
  end if;
  if (select count(*) from public.minds_work_claims where statement like 'Synthetic%')<>0 then
    raise exception 'admin must not read unassigned Akte';
  end if;
end
$test$;

reset role;
rollback;
