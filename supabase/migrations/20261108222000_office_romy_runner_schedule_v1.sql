-- Romy · review 08.11.2026 (Claude) · the runners the shared engine needs, scheduled as in Window.
-- Phase 1 only templated the heartbeat. Without the chat runner, an informational question that the
-- engine sends to durable background execution never gets its answer written back; routines,
-- missions and generated documents would never run either. Each runner checks its own random
-- secret, generated here inside the database (never in the repository or the chat).
-- Not scheduled on purpose: delivery runner (no Office push), self-review (no Office review screen),
-- retention jobs (they delete rows; that needs Gari's OK). Nothing is deleted or overwritten:
-- only empty or missing configuration values are filled.
begin;

do $secrets$
declare k text;
begin
  foreach k in array array['heartbeat_runner','chat_runner','routine_runner','mission_runner','capability_runner','work_ingest_runner'] loop
    insert into public.isabella_runtime_secrets(key,value) values (k,'') on conflict (key) do nothing;
    update public.isabella_runtime_secrets
      set value=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','')
      where key=k and length(value)=0;
  end loop;
  insert into public.isabella_runtime_secrets(key,value) values ('heartbeat_url','') on conflict (key) do nothing;
  update public.isabella_runtime_secrets
    set value='https://ynzsbemisjvfgbqcqliq.supabase.co/functions/v1/isabella-heartbeat'
    where key='heartbeat_url' and length(value)=0;
end
$secrets$;

-- Same guard as the heartbeat template: only where pg_cron and pg_net exist (Office Supabase), never
-- twice, and each call carries its runner's secret only while that value is non-empty.
do $runners$
declare
  r record;
begin
  if to_regclass('cron.job') is null
     or to_regprocedure('cron.schedule(text,text,text)') is null
     or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return;
  end if;
  for r in select * from (values
    ('office_romy_chat_runner_v1','* * * * *','isabella-chat-runner','chat_runner'),
    ('office_romy_routine_runner_v1','* * * * *','isabella-routine-runner','routine_runner'),
    ('office_romy_mission_runner_v1','* * * * *','isabella-mission-runner','mission_runner'),
    ('office_romy_capability_runner_v1','* * * * *','isabella-capability-runner','capability_runner'),
    ('office_romy_work_ingest_runner_v1','*/5 * * * *','isabella-work-ingest-runner','work_ingest_runner')
  ) as t(jobname,schedule,fn,secret_key) loop
    if not exists(select 1 from cron.job where jobname=r.jobname) then
      perform cron.schedule(r.jobname,r.schedule,format(
        $dispatch$select net.http_post(
          url:='https://ynzsbemisjvfgbqcqliq.supabase.co/functions/v1/%s',
          headers:='{"Content-Type":"application/json"}'::jsonb,
          body:=jsonb_build_object('secret',s.value),
          timeout_milliseconds:=30000)
        from public.isabella_runtime_secrets s where s.key=%L and length(s.value)>0$dispatch$,
        r.fn,r.secret_key));
    end if;
  end loop;
end
$runners$;

commit;
