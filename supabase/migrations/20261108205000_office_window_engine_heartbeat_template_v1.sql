-- Romy · Phase 1 · heartbeat templates and disabled-by-default 15-minute cron.
-- No secret values are ever committed. A blank key refuses every trigger.
-- Claude configures the URL and runner secret after merge and review.
begin;

insert into public.isabella_runtime_secrets(key,value)
values ('heartbeat_runner',''),('heartbeat_url',''),('routine_runner','')
on conflict (key) do nothing;

-- If cron/pg_net are absent in isolated PostgreSQL, the job is not registered.
-- In Office Supabase both extensions exist. The job does nothing until both
-- independently configured values are non-empty.
do $heartbeat$
begin
  if to_regclass('cron.job') is not null
     and to_regprocedure('cron.schedule(text,text,text)') is not null
     and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
    if not exists(select 1 from cron.job where jobname='office_romy_heartbeat_15m_v1') then
      perform cron.schedule('office_romy_heartbeat_15m_v1','*/15 * * * *',
        $dispatch$
        select net.http_post(
          url:=u.value,
          headers:='{"Content-Type":"application/json"}'::jsonb,
          body:=jsonb_build_object('secret',s.value)
        )
        from public.isabella_runtime_secrets u
        join public.isabella_runtime_secrets s on s.key='heartbeat_runner'
        where u.key='heartbeat_url' and length(u.value)>0 and length(s.value)>0;
        $dispatch$);
    end if;
  end if;
end
$heartbeat$;

commit;
