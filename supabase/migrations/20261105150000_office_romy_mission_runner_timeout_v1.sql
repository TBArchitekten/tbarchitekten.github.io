-- The HTTP request must outlive a bounded 70s model checkpoint (rather than 3s).
-- Do not change the worker secret or the ownership model when updating cadence.
select cron.unschedule(jobid) from cron.job where jobname='office-romy-mission-runner';
select cron.schedule(
  'office-romy-mission-runner','*/5 * * * *',
  $job$
  select net.http_post(
    url:='https://ynzsbemisjvfgbqcqliq.supabase.co/functions/v1/office-romy-mission-runner',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-romy-runner-secret',(select secret from private.office_romy_runner_config where name='primary')
    ),
    body:='{}'::jsonb,
    timeout_milliseconds:=110000
  );
  $job$
);
