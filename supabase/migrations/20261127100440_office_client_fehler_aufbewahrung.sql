-- TBA Office · Aufbewahrung der Fehler aus dem Browser: 30 Tage (Garis OK vom 27.11.2026).
-- Gelöscht wird, was zuletzt vor mehr als 30 Tagen auftrat. Jede Zeile gilt für einen Tag; ein Fehler, der weiter
-- auftritt, bekommt jeden Tag eine neue Zeile und bleibt so sichtbar. Täglich 03:17 UTC per Cron, nur dort, wo pg_cron
-- besteht (Office-Supabase), und nie doppelt.

create or replace function private.office_client_fehler_aufraeumen()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.office_client_fehler where letztes_mal < now() - interval '30 days';
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

revoke all on function private.office_client_fehler_aufraeumen() from public, anon, authenticated, service_role;

do $zeitplan$
begin
  if to_regclass('cron.job') is null or to_regprocedure('cron.schedule(text,text,text)') is null then
    return;
  end if;
  if not exists (select 1 from cron.job where jobname = 'office_client_fehler_aufraeumen_v1') then
    perform cron.schedule('office_client_fehler_aufraeumen_v1', '17 3 * * *',
      'select private.office_client_fehler_aufraeumen()');
  end if;
end
$zeitplan$;
