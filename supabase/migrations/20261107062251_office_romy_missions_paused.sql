-- TBA Office · Romy missions are hidden until they can work with real Office data (Gari, 07.11.2026).
-- The cron job is paused, not removed; tables, functions and the runner stay for later.
select cron.alter_job(job_id := (select jobid from cron.job where jobname='office-romy-mission-runner'), active := false);
