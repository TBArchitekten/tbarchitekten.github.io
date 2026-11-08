-- Phase 1, isolated PostgreSQL/Supabase CLI. All identities and names are invented.
-- Runs only on an ephemeral local database. Transaction rolls back synthetic rows.
begin;

-- Verify that every expected new table exists and RLS is actually enabled.
-- A CREATE POLICY statement without ENABLE ROW LEVEL SECURITY is ineffective.
do $rls$
declare unprotected text[];
begin
  with expected(name) as (values
    ('conversation_messages'),
    ('conversations'),
    ('isabella_activity_log'),
    ('isabella_embeddings'),
    ('isabella_entities'),
    ('isabella_entity_links'),
    ('isabella_followups'),
    ('isabella_memories'),
    ('isabella_model_claims'),
    ('isabella_proposal_feedback'),
    ('isabella_return_queue'),
    ('isabella_routines'),
    ('isabella_runtime_secrets'),
    ('isabella_skill_runs'),
    ('isabella_skills'),
    ('isabella_task_reminders'),
    ('minds_action_policies'),
    ('minds_agent_runs'),
    ('minds_ai_usage'),
    ('minds_artifact_intake'),
    ('minds_artifacts'),
    ('minds_attention_events'),
    ('minds_autonomy_executions'),
    ('minds_calendar_action_receipts'),
    ('minds_calendar_execution_preferences'),
    ('minds_capability_runs'),
    ('minds_chat_jobs'),
    ('minds_chat_stream_delivery_receipts'),
    ('minds_commitment_events'),
    ('minds_commitment_signal_links'),
    ('minds_commitment_workspace_items'),
    ('minds_commitment_workspaces'),
    ('minds_commitments'),
    ('minds_contextual_permissions'),
    ('minds_continuity_signals'),
    ('minds_delivery_attempts'),
    ('minds_delivery_intents'),
    ('minds_expectation_reviews'),
    ('minds_expectations'),
    ('minds_exposure_receipts'),
    ('minds_heartbeat_events'),
    ('minds_intent_deliveries'),
    ('minds_memory_flushes'),
    ('minds_memory_forget_tombstones'),
    ('minds_memory_lineage'),
    ('minds_mission_run_events'),
    ('minds_mission_runs'),
    ('minds_mission_runtime_events'),
    ('minds_mission_runtime_executions'),
    ('minds_model_claim_reviews'),
    ('minds_model_independence_runs'),
    ('minds_operating_model_evidence'),
    ('minds_operating_model_hypotheses'),
    ('minds_operating_model_observations'),
    ('minds_operating_model_reviews'),
    ('minds_outcome_feedback'),
    ('minds_permission_reviews'),
    ('minds_post_action_feedback_candidates'),
    ('minds_push_subscriptions'),
    ('minds_review_admission_events'),
    ('minds_review_receipts'),
    ('minds_routine_action_receipts'),
    ('minds_routine_deliveries'),
    ('minds_runtime_capability_grants'),
    ('minds_self_review_proposals'),
    ('minds_self_review_reports'),
    ('minds_self_review_settings'),
    ('minds_shadow_decisions'),
    ('minds_skill_proposals'),
    ('minds_standing_intents'),
    ('minds_user_skill_versions'),
    ('minds_user_skills'),
    ('minds_watch_channels'),
    ('minds_watch_checks'),
    ('minds_project_model_elements'),
    ('minds_project_model_revisions'),
    ('minds_project_model_variants'),
    ('minds_project_perimeter'),
    ('minds_project_referents'),
    ('minds_project_source_comparison_items'),
    ('minds_project_source_comparisons'),
    ('minds_project_source_ingestions'),
    ('minds_work_claim_relations'),
    ('minds_work_claims'),
    ('minds_work_docling_page_chunks'),
    ('minds_work_evidence'),
    ('minds_work_ingest_queue'),
    ('minds_work_memory'),
    ('minds_work_source_segments'),
    ('minds_work_source_text_receipts')
  )
  select array_agg(e.name) into unprotected
  from expected e
  left join pg_class c on c.relname=e.name and c.relnamespace='public'::regnamespace and c.relkind in ('r','p')
  where c.oid is null or not c.relrowsecurity;
  if cardinality(unprotected)>0 then
    raise exception 'missing or unprotected Romy tables: %',unprotected;
  end if;
end
$rls$;


-- Three fictional users: two distinct project teams and an admin with no team.
insert into auth.users (id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u1@fixture.invalid','',now(),now()),
('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u2@fixture.invalid','',now(),now()),
('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u3@fixture.invalid','',now(),now()),
('55555555-5555-4555-8555-555555555555','00000000-0000-0000-0000-000000000000','authenticated','authenticated','u4@fixture.invalid','',now(),now())
on conflict (id) do nothing;
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password)
values
('11111111-1111-4111-8111-111111111111','u1@fixture.invalid','Fixture Alpha','member',true,false),
('22222222-2222-4222-8222-222222222222','u2@fixture.invalid','Fixture Beta','member',true,false),
('33333333-3333-4333-8333-333333333333','u3@fixture.invalid','Fixture Admin','admin',true,false),
('55555555-5555-4555-8555-555555555555','u4@fixture.invalid','Fixture Member','member',true,false)
on conflict (user_id) do nothing;
insert into public.office_projects(id,number,name,created_by,status)
values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TMP-P','Project P (fictional)','11111111-1111-4111-8111-111111111111','aktiv'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','TMP-Q','Project Q (fictional)','22222222-2222-4222-8222-222222222222','aktiv')
on conflict (id) do nothing;
insert into public.office_project_members(project_id,user_id,added_by)
values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111')
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
insert into public.minds_work_files(user_id,project_id,name,size_bytes,storage_path)
values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','fixture-p.pdf',1024,'11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/fixture-p.pdf'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','fixture-q.pdf',1024,'22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/fixture-q.pdf');

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

-- Another member of project P must see the Akte written by member A,
-- but not A's personal conversation or any Akte of project Q.
select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',true);
do $team$
declare snapshot jsonb;
begin
  if (select count(*) from public.minds_work_claims where statement like 'Synthetic%')<>1 then
    raise exception 'project teammate must read P regardless of claim author';
  end if;
  if (select count(*) from public.minds_work_files where name like 'fixture-%')<>1 then
    raise exception 'project teammate must read P files regardless of uploader';
  end if;
  snapshot:=public.minds_project_model_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);
  if snapshot is null or not coalesce(snapshot->'claims' @> '[{"statement":"Synthetic project claim P"}]'::jsonb,false) then
    raise exception 'project snapshot must include fellow member claim via Office team RLS';
  end if;
  if (select count(*) from public.conversation_messages where content like 'Synthetic%')<>0 then
    raise exception 'project teammate may not read A or B personal chat';
  end if;
end
$team$;

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
  begin
    perform public.minds_project_model_snapshot('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid);
    raise exception 'admin must not obtain an unassigned project snapshot';
  exception when sqlstate 'P0002' then null;
  end;
end
$test$;

-- RPC parity / authority: an authenticated member may inspect only their Watch channels;
-- worker mutation functions cannot be invoked through the browser Data API.
do $rpc$
begin
  if to_regprocedure('public.claim_due_isabella_routines(integer)') is null
    or to_regprocedure('public.minds_record_watch_check(uuid,uuid,uuid,jsonb)') is null
    or to_regprocedure('public.minds_finalize_watch_fire(uuid,uuid,uuid,jsonb)') is null
    or to_regprocedure('public.minds_watch_capabilities()') is null
  then raise exception 'required Office background/watch RPC is absent'; end if;
  if has_function_privilege('authenticated','public.claim_due_isabella_routines(integer)','EXECUTE')
    or has_function_privilege('authenticated','public.minds_record_watch_check(uuid,uuid,uuid,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.minds_finalize_watch_fire(uuid,uuid,uuid,jsonb)','EXECUTE')
  then raise exception 'worker RPC exposed to authenticated browser'; end if;
  if not has_function_privilege('authenticated','public.minds_watch_capabilities()','EXECUTE')
  then raise exception 'owner Watch catalog read unavailable'; end if;
  if to_regprocedure('public.minds_store_vapid_pair_if_absent(text,text)') is not null
  then raise exception 'Office must not install VAPID private-key generator'; end if;
end $rpc$;

reset role;
rollback;
