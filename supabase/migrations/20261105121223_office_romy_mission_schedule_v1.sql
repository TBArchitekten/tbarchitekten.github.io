-- A private random bearer protects the non-JWT scheduled worker. It is never sent to the client.
create table private.office_romy_runner_config(
  name text primary key,
  secret text not null check(secret ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
revoke all on private.office_romy_runner_config from public,anon,authenticated,service_role;
insert into private.office_romy_runner_config(name,secret)
 values('primary',encode(extensions.gen_random_bytes(32),'hex'));

create function public.office_romy_runner_authorized(p_secret text)
returns boolean language sql stable security definer
set search_path=pg_catalog,private as $$
 select exists(select 1 from private.office_romy_runner_config
  where name='primary' and secret=p_secret and length(p_secret)=64);
$$;
revoke all on function public.office_romy_runner_authorized(text) from public,anon,authenticated;
grant execute on function public.office_romy_runner_authorized(text) to service_role;

-- Only the database cron worker triggers the authenticated private mission runner.
-- This schedule can be disabled without losing any mission state.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'office-romy-mission-runner',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url:='https://ynzsbemisjvfgbqcqliq.supabase.co/functions/v1/office-romy-mission-runner',
    headers:=jsonb_build_object(
       'Content-Type','application/json',
       'x-romy-runner-secret',(select secret from private.office_romy_runner_config where name='primary')
    ),
    body:='{}'::jsonb,
    timeout_milliseconds:=3000
  );
  $job$
);
