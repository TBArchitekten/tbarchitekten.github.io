// Aufräumen mit Garis OK vom 27.11.2026: KI-Anfragen ohne Person (die vier Werkzeuge prüfen weiter den Zugang,
// speichern aber nichts mehr; die gespeicherten Anfragen werden gelöscht) und der Verlauf der Zeitpläne nur 7 Tage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('KI-Anfragen: Zugang geprüft, nichts mit Person gespeichert, Bestand gelöscht',()=>{
  const sql=read('supabase/migrations/20261127145319_office_ki_anfragen_ohne_person.sql');
  const fns=[['office_ai_consume_request(p_plan_id uuid)','office_terminplan_instances'],['office_kosten_ai_consume_request(p_instance_id uuid)','office_kosten_instances'],
    ['office_produkt_ai_consume_request()',null],['office_projektdokument_ai_consume_request()',null]];
  for(const [fn,sicht] of fns){
    const i=sql.indexOf('create or replace function public.'+fn);
    assert.ok(i>=0,'fehlt: '+fn);
    const body=sql.slice(i,sql.indexOf('$$;',i));
    assert.match(body,/returns boolean\s*language plpgsql security invoker set search_path = ''/);
    assert.match(body,/private\.office_is_member\(\)/);
    assert.match(body,/auth\.uid\(\)/);
    assert.doesNotMatch(body,/insert|update|user_id/i,'speichert nichts: '+fn);
    if(sicht)assert.ok(body.includes('from public.'+sicht),'Sichtbarkeit: '+fn);
  }
  for(const t of ['office_terminplan_ai_requests','office_kosten_ai_requests','office_produkt_ai_requests','office_projektdokument_ai_requests'])
    assert.ok(sql.includes('delete from public.'+t+';'),'gelöscht: '+t);
  assert.doesNotMatch(sql,/drop |revoke |alter table/i,'Tabellen, Rechte und Policies bleiben');
  // Die Funktionen rufen die Werkzeuge weiter vor dem Modell auf.
  for(const [f,rpc] of [['office-terminplan-ai','office_ai_consume_request'],['office-kosten-ai','office_kosten_ai_consume_request'],
    ['office-produkt-ai','office_produkt_ai_consume_request'],['office-dokumente-ai','office_projektdokument_ai_consume_request']]){
    const ts=read('supabase/functions/'+f+'/index.ts');
    assert.ok(ts.indexOf(rpc)>0&&ts.indexOf(rpc)<ts.indexOf('api.openai.com'),f);
  }
});

test('Verlauf der Zeitpläne: 7 Tage, jede Nacht, nur die Datenbank selbst',()=>{
  const sql=read('supabase/migrations/20261127145327_office_cron_verlauf_aufbewahrung.sql');
  assert.match(sql,/create or replace function private\.office_cron_verlauf_aufraeumen\(\)\s*returns integer\s*language plpgsql\s*security definer\s*set search_path = ''/);
  assert.match(sql,/delete from cron\.job_run_details where start_time < now\(\) - interval '7 days';/);
  assert.match(sql,/revoke all on function private\.office_cron_verlauf_aufraeumen\(\) from public, anon, authenticated, service_role;/);
  assert.match(sql,/if not exists \(select 1 from cron\.job where jobname = 'office_cron_verlauf_aufraeumen_v1'\) then\s*perform cron\.schedule\('office_cron_verlauf_aufraeumen_v1', '23 3 \* \* \*',/);
  assert.match(sql,/to_regclass\('cron\.job_run_details'\) is null/,'nur wo pg_cron besteht');
  // Der Systemstatus liest ohnehin nur 7 Tage.
  assert.match(read('supabase/migrations/20261127102635_office_admin_uebersicht.sql'),/where d\.start_time > now\(\) - interval '7 days'/);
});
