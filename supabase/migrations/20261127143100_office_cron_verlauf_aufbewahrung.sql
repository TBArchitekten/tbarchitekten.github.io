-- TBA Office · Verlauf der Zeitpläne (pg_cron) 7 Tage (27.11.2026, Claude; OK von Gari am 27.11.2026 für genau diese
-- Änderung). cron.job_run_details hält jeden Lauf jedes Zeitplans; vier Läufe von Romy jede Minute machen etwa 6 000
-- Zeilen und 5 MB am Tag (am 27.11.2026 113 der 148 MB der Datenbank). Jede Nacht um 03:23 UTC löscht ein Zeitplan, was
-- vor mehr als 7 Tagen begann; der Systemstatus liest ohnehin nur die letzten 7 Tage. Einmal sofort. Der frei gewordene
-- Platz wird von der Datenbank wiederverwendet. Nur dort, wo pg_cron besteht (Office-Supabase), und nie doppelt.

create or replace function private.office_cron_verlauf_aufraeumen()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from cron.job_run_details where start_time < now() - interval '7 days';
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

revoke all on function private.office_cron_verlauf_aufraeumen() from public, anon, authenticated, service_role;

do $zeitplan$
begin
  if to_regclass('cron.job_run_details') is null or to_regprocedure('cron.schedule(text,text,text)') is null then
    return;
  end if;
  if not exists (select 1 from cron.job where jobname = 'office_cron_verlauf_aufraeumen_v1') then
    perform cron.schedule('office_cron_verlauf_aufraeumen_v1', '23 3 * * *',
      'select private.office_cron_verlauf_aufraeumen()');
  end if;
  perform private.office_cron_verlauf_aufraeumen();
end
$zeitplan$;
