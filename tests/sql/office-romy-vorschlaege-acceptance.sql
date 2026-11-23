-- Abnahme · Romys Vorschläge speichern und Heartbeat (Migration 20261123120000_office_romy_vorschlaege_v1.sql).
-- Erfundene Personen und Projekte; alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
-- A = Projektleitung und Team von P, T = Team von P, B = Mitglied ohne Bezug zu P, D = kein Office-Mitglied.
-- P ist aktiv, Q archiviert. Geprüft wird:
--  * Erinnerung, Erwartung, Ziel und Fähigkeit speichert jedes Mitglied für sich, einmal je Anfrage-Kennung;
--    ein Projektbezug geht auf jedes aktive Projekt, nie auf ein archiviertes; ohne Bestätigung nichts.
--  * Projektwissen speichert und prüft nur das Team eines aktiven Projekts; eine Prüfung durch das Team behält
--    die vorige Fassung, die Person, der der Eintrag gehört, und hinterlässt eine Quittung; ein Beleg muss eine
--    Datei desselben Projekts sein.
--  * Fremde Erinnerungen lassen sich nicht beenden; D und anon bekommen nichts.
--  * Der Heartbeat nimmt einen Fingerabdruck über 500 Zeichen an: voll in der Heartbeat-Tabelle, gekürzt und
--    stabil in Aufmerksamkeit und Kontinuität; kurze Fingerabdrücke bleiben, wie sie waren.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a4000000-0000-4000-8000-00000000000a','authenticated','authenticated','rv-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b4000000-0000-4000-8000-00000000000b','authenticated','authenticated','rv-t@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('c4000000-0000-4000-8000-00000000000c','authenticated','authenticated','rv-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('d4000000-0000-4000-8000-00000000000d','authenticated','authenticated','rv-d@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a4000000-0000-4000-8000-00000000000a','rv-a@example.invalid','RV Leitung','projektleiter',true,false),
 ('b4000000-0000-4000-8000-00000000000b','rv-t@example.invalid','RV Team','member',true,false),
 ('c4000000-0000-4000-8000-00000000000c','rv-b@example.invalid','RV Fremd','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e4000000-0000-4000-8000-0000000000e1','RV-1','Vorschlag-Test P','aktiv','a4000000-0000-4000-8000-00000000000a','a4000000-0000-4000-8000-00000000000a'),
 ('e4000000-0000-4000-8000-0000000000e2','RV-2','Vorschlag-Test Q','archiviert','a4000000-0000-4000-8000-00000000000a','a4000000-0000-4000-8000-00000000000a');
insert into public.office_project_members(project_id,user_id,added_by) values
 ('e4000000-0000-4000-8000-0000000000e1','a4000000-0000-4000-8000-00000000000a','a4000000-0000-4000-8000-00000000000a'),
 ('e4000000-0000-4000-8000-0000000000e1','b4000000-0000-4000-8000-00000000000b','a4000000-0000-4000-8000-00000000000a'),
 ('e4000000-0000-4000-8000-0000000000e2','a4000000-0000-4000-8000-00000000000a','a4000000-0000-4000-8000-00000000000a')
on conflict do nothing;
-- Eine Datei von T in P (Beleg) und eine Datei von A ohne Projekt (gehört nicht zu P).
insert into public.minds_work_files(id,user_id,project_id,name,size_bytes,storage_path) values
 ('f4000000-0000-4000-8000-0000000000f1','b4000000-0000-4000-8000-00000000000b','e4000000-0000-4000-8000-0000000000e1','Musterplan.pdf',1,
  'b4000000-0000-4000-8000-00000000000b/e4000000-0000-4000-8000-0000000000e1/musterplan.pdf'),
 ('f4000000-0000-4000-8000-0000000000f2','a4000000-0000-4000-8000-00000000000a',null,'Notiz.pdf',1,
  'a4000000-0000-4000-8000-00000000000a/office/notiz-ohne-projekt.pdf');

do $test$
declare
  r text := ''; n int; ok boolean; s text; x jsonb; y jsonb;
  erwartet constant text :=
       'erinnerung=created; nochmal=already_created; eine_zeile=1; archiviert=verweigert; unbestaetigt=verweigert; D_erinnerung=verweigert; '
    || 'quittiert=1; doppelt=0; zaehler=1; B_beendet=missing; A_beendet=cancelled; '
    || 'erwartung=created; erwartung_nochmal=already_created; B_erwartung=created; erwartung_archiv=verweigert; geprueft=reviewed; erfuellt=fulfilled; D_erwartung=verweigert; '
    || 'ziel=project; ziel_gleich=true; ereignisse=1; ziel_archiv=verweigert; ziel_ohne_projekt=verweigert; D_ziel=verweigert; '
    || 'wissen=proposed/project_source; wissen_gleich=true; belege=1; T_prueft=confirmed; gehoert_A=true; fassungen=1; geprueft_von_T=true; '
    || 'B_wissen=verweigert; wissen_archiv=verweigert; fremde_datei=verweigert; quittung_T=1; D_wissen=verweigert; '
    || 'faehigkeit=1/isabella; faehigkeit_neu=2; faehigkeit_gleich=2; fassungen_faehigkeit=2; D_faehigkeit=verweigert; anon=verweigert; '
    || 'heartbeat=true; heartbeat_nochmal=false; voll_gespeichert=true; schluessel=true; kontinuitaet=true; ein_hinweis=1; kurz_unveraendert=true; '
    || 'rechte=ok; ';
  ua constant text := '{"sub":"a4000000-0000-4000-8000-00000000000a","role":"authenticated"}';
  ut constant text := '{"sub":"b4000000-0000-4000-8000-00000000000b","role":"authenticated"}';
  ub constant text := '{"sub":"c4000000-0000-4000-8000-00000000000c","role":"authenticated"}';
  ud constant text := '{"sub":"d4000000-0000-4000-8000-00000000000d","role":"authenticated"}';
  a constant uuid := 'a4000000-0000-4000-8000-00000000000a';
  t constant uuid := 'b4000000-0000-4000-8000-00000000000b';
  p constant uuid := 'e4000000-0000-4000-8000-0000000000e1';
  q constant uuid := 'e4000000-0000-4000-8000-0000000000e2';
  datei_p constant uuid := 'f4000000-0000-4000-8000-0000000000f1';
  datei_fremd constant uuid := 'f4000000-0000-4000-8000-0000000000f2';
  erinnerung jsonb := jsonb_build_object('mode','reminder','trigger_text','Wenn die Musterfassade besprochen wird',
    'reminder_text','Die Musterprüfung ansprechen','trigger_terms',jsonb_build_array('Musterfassade'),
    'project_id','e4000000-0000-4000-8000-0000000000e1','cooldown_minutes',0,'max_triggers',2);
  faellig text := to_char((now() at time zone 'Europe/Berlin') + interval '3 days','YYYY-MM-DD');
  intent uuid; erwartung uuid; ziel uuid; wissen uuid; fp text; fn text;
begin
  -- Künftige Erinnerung von A, einmal je Anfrage-Kennung.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  x := public.minds_create_prospective_memory(erinnerung,'94000000-0000-4000-8000-000000000001',true);
  r := r || 'erinnerung=' || (x->>'status') || '; ';
  x := public.minds_create_prospective_memory(erinnerung,'94000000-0000-4000-8000-000000000001',true);
  r := r || 'nochmal=' || (x->>'status') || '; ';
  intent := (x->'item'->>'id')::uuid;
  execute 'reset role';
  select count(*) into n from public.minds_standing_intents where user_id=a and request_id='94000000-0000-4000-8000-000000000001';
  r := r || 'eine_zeile=' || n || '; ';
  execute 'set local role authenticated';
  begin perform public.minds_create_prospective_memory(erinnerung||jsonb_build_object('project_id',q),gen_random_uuid(),true);
    r := r || 'archiviert=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'archiviert=verweigert; '; end;
  begin perform public.minds_create_prospective_memory(erinnerung,gen_random_uuid(),false);
    r := r || 'unbestaetigt=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'unbestaetigt=verweigert; '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', ud, true);
  execute 'set local role authenticated';
  begin perform public.minds_create_prospective_memory(erinnerung,gen_random_uuid(),true);
    r := r || 'D_erinnerung=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'D_erinnerung=verweigert; '; end;
  execute 'reset role';

  -- Nach Romys Antwort quittiert: einmal je Lauf.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  n := public.minds_ack_standing_intents(array[intent],'lauf-1'); r := r || 'quittiert=' || n || '; ';
  n := public.minds_ack_standing_intents(array[intent],'lauf-1'); r := r || 'doppelt=' || n || '; ';
  execute 'reset role';
  select trigger_count into n from public.minds_standing_intents where id=intent; r := r || 'zaehler=' || n || '; ';

  -- B kann As Erinnerung nicht beenden; A schon.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  x := public.minds_cancel_prospective_memory(intent,true); r := r || 'B_beendet=' || (x->>'status') || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  x := public.minds_cancel_prospective_memory(intent,true); r := r || 'A_beendet=' || (x->>'status') || '; ';

  -- Erwartungen: persönlich, Projektbezug auf jedes aktive Projekt.
  y := jsonb_build_object('title','Antwort des Musterbüros','expected_event','Das Musterbüro schickt die Unterlagen',
    'due_date',faellig,'due_precision','date','timezone','Europe/Berlin','project_id',p);
  x := public.minds_create_expectation(y,'94000000-0000-4000-8000-000000000002',true);
  r := r || 'erwartung=' || (x->>'status') || '; ';
  erwartung := (x->'expectation'->>'id')::uuid;
  x := public.minds_create_expectation(y,'94000000-0000-4000-8000-000000000002',true);
  r := r || 'erwartung_nochmal=' || (x->>'status') || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  x := public.minds_create_expectation(y,'94000000-0000-4000-8000-000000000003',true);
  r := r || 'B_erwartung=' || (x->>'status') || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  begin perform public.minds_create_expectation(y||jsonb_build_object('project_id',q),gen_random_uuid(),true);
    r := r || 'erwartung_archiv=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'erwartung_archiv=verweigert; '; end;
  x := public.minds_review_expectation(erwartung,'fulfilled',null,null,null,null,null,null,'94000000-0000-4000-8000-000000000004',true);
  r := r || 'geprueft=' || (x->>'status') || '; erfuellt=' || (x->'expectation'->>'status') || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ud, true);
  execute 'set local role authenticated';
  begin perform public.minds_create_expectation(y,gen_random_uuid(),true);
    r := r || 'D_erwartung=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'D_erwartung=verweigert; '; end;
  execute 'reset role';

  -- Ziele, die Romy präsent hält.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  y := jsonb_build_object('agent','isabella','title','Musterprüfung abschließen','objective','Die Musterprüfung bis zur Abgabe abschließen',
    'scope','project','project_id',p,'source_kind','user','metadata',jsonb_build_object('source','isabella_chat'));
  x := public.minds_create_commitment(y,'94000000-0000-4000-8000-000000000005',true);
  r := r || 'ziel=' || (x->>'scope') || '; ';
  ziel := (x->>'id')::uuid;
  x := public.minds_create_commitment(y,'94000000-0000-4000-8000-000000000005',true);
  r := r || 'ziel_gleich=' || ((x->>'id')::uuid = ziel) || '; ';
  execute 'reset role';
  select count(*) into n from public.minds_commitment_events where commitment_id=ziel; r := r || 'ereignisse=' || n || '; ';
  execute 'set local role authenticated';
  begin perform public.minds_create_commitment(y||jsonb_build_object('project_id',q),gen_random_uuid(),true);
    r := r || 'ziel_archiv=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'ziel_archiv=verweigert; '; end;
  begin perform public.minds_create_commitment((y-'project_id')||jsonb_build_object('scope','project'),gen_random_uuid(),true);
    r := r || 'ziel_ohne_projekt=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'ziel_ohne_projekt=verweigert; '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', ud, true);
  execute 'set local role authenticated';
  begin perform public.minds_create_commitment(y,gen_random_uuid(),true);
    r := r || 'D_ziel=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'D_ziel=verweigert; '; end;
  execute 'reset role';

  -- Projektwissen: A schlägt vor (Beleg ist eine Datei von T in P), T prüft.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  y := jsonb_build_object('project_id',p,'statement','Die Musterwand im Erdgeschoss ist tragend.','claim_type','fact',
    'status','proposed','provenance_class','user');
  x := public.minds_save_work_claim(y,jsonb_build_array(jsonb_build_object('source_file_id',datei_p,'excerpt','Plan zeigt die Wand als tragend')),
    '94000000-0000-4000-8000-000000000006',true);
  r := r || 'wissen=' || (x->>'status') || '/' || (x->>'provenance_class') || '; ';
  wissen := (x->>'id')::uuid;
  x := public.minds_save_work_claim(y,'[]'::jsonb,'94000000-0000-4000-8000-000000000006',true);
  r := r || 'wissen_gleich=' || ((x->>'id')::uuid = wissen) || '; ';
  execute 'reset role';
  select count(*) into n from public.minds_work_evidence where claim_id=wissen; r := r || 'belege=' || n || '; ';
  perform set_config('request.jwt.claims', ut, true);
  execute 'set local role authenticated';
  x := public.minds_save_work_claim(jsonb_build_object('id',wissen,'project_id',p,'statement','Die Musterwand im Erdgeschoss ist tragend (geprüft).',
    'claim_type','fact','status','confirmed','provenance_class','project_source'),'[]'::jsonb,'94000000-0000-4000-8000-000000000007',true);
  r := r || 'T_prueft=' || (x->>'status') || '; ';
  execute 'reset role';
  select user_id=a, jsonb_array_length(metadata->'previous_versions'), (metadata->>'reviewed_by')::uuid=t
    into ok, n, s from public.minds_work_claims where id=wissen;
  r := r || 'gehoert_A=' || ok || '; fassungen=' || n || '; geprueft_von_T=' || s || '; ';
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  begin perform public.minds_save_work_claim(y,'[]'::jsonb,gen_random_uuid(),true);
    r := r || 'B_wissen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_wissen=verweigert; '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  begin perform public.minds_save_work_claim(y||jsonb_build_object('project_id',q),'[]'::jsonb,gen_random_uuid(),true);
    r := r || 'wissen_archiv=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'wissen_archiv=verweigert; '; end;
  begin perform public.minds_save_work_claim(y,jsonb_build_array(jsonb_build_object('source_file_id',datei_fremd)),gen_random_uuid(),true);
    r := r || 'fremde_datei=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'fremde_datei=verweigert; '; end;
  execute 'reset role';
  select count(*) into n from public.minds_review_receipts where user_id=t and kind='work_claim' and target_id=wissen;
  r := r || 'quittung_T=' || n || '; ';
  perform set_config('request.jwt.claims', ud, true);
  execute 'set local role authenticated';
  begin perform public.minds_save_work_claim(y,'[]'::jsonb,gen_random_uuid(),true);
    r := r || 'D_wissen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'D_wissen=verweigert; '; end;
  execute 'reset role';

  -- Fähigkeiten: im Office immer für Romy (intern «isabella»), auch wenn der Vorschlag einen anderen Namen trägt.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  y := jsonb_build_object('agent','sofia','name','Musterprüfung','description','Wie eine Musterprüfung abläuft',
    'instructions','Erst die Pläne lesen, dann den Bericht schreiben.','preferred_tools',jsonb_build_array('search'));
  x := public.minds_apply_personal_skill(y,'94000000-0000-4000-8000-000000000008',true);
  r := r || 'faehigkeit=' || (x->>'version') || '/' || (x->>'agent') || '; ';
  x := public.minds_apply_personal_skill(y,'94000000-0000-4000-8000-000000000009',true);
  r := r || 'faehigkeit_neu=' || (x->>'version') || '; ';
  x := public.minds_apply_personal_skill(y,'94000000-0000-4000-8000-000000000008',true);
  r := r || 'faehigkeit_gleich=' || (x->>'version') || '; ';
  execute 'reset role';
  select count(*) into n from public.minds_user_skill_versions v join public.minds_user_skills k on k.id=v.skill_id
   where k.user_id=a and k.slug='musterpr-fung';
  r := r || 'fassungen_faehigkeit=' || n || '; ';
  perform set_config('request.jwt.claims', ud, true);
  execute 'set local role authenticated';
  begin perform public.minds_apply_personal_skill(y,gen_random_uuid(),true);
    r := r || 'D_faehigkeit=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'D_faehigkeit=verweigert; '; end;
  execute 'reset role';
  execute 'set local role anon';
  begin perform public.minds_create_commitment(y,gen_random_uuid(),true);
    r := r || 'anon=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon=verweigert; '; end;
  execute 'reset role';

  -- Heartbeat mit dem Fingerabdruck von 18 überfälligen Aufgaben (wie am 23.11.2026 in Produktion).
  select 'overdue_digest:' || string_agg(g::text, ',' order by g::text) into fp
    from (select gen_random_uuid() g from generate_series(1,18)) z;
  y := jsonb_build_object('event_type','overdue_digest','fingerprint',fp,'severity','attention','title','18 überfällige Aufgaben',
    'body','Muster A · Muster B · Muster C · +15 weitere','source',jsonb_build_object('task_ids','[]'::jsonb),'timezone','Europe/Berlin');
  x := public.minds_publish_heartbeat(a,y); r := r || 'heartbeat=' || (x->>'created') || '; ';
  x := public.minds_publish_heartbeat(a,y); r := r || 'heartbeat_nochmal=' || (x->>'created') || '; ';
  select length(fingerprint)=length(fp) and length(fp)>500 into ok from public.minds_heartbeat_events where user_id=a and fingerprint=fp;
  r := r || 'voll_gespeichert=' || ok || '; ';
  fn := 'heartbeat:' || left(fp,80) || ':md5:' || md5(fp);
  select count(*)=1 into ok from public.minds_attention_events where user_id=a and event_key=fn;
  r := r || 'schluessel=' || ok || '; ';
  select count(*)=1 into ok from public.minds_continuity_signals where user_id=a and fingerprint=fn;
  r := r || 'kontinuitaet=' || ok || '; ';
  select count(*) into n from public.minds_attention_events where user_id=a and source_type='heartbeat' and source_id=(x->>'id');
  r := r || 'ein_hinweis=' || n || '; ';
  x := public.minds_publish_heartbeat(a,jsonb_build_object('event_type','upcoming_event','fingerprint','event_upcoming:muster:1',
    'severity','attention','title','Demnächst: Musterbesprechung','body','Beginnt um 14:00.','source',jsonb_build_object('starts_at',now()+interval '1 hour')));
  select count(*)=1 into ok from public.minds_attention_events where user_id=a and event_key='heartbeat:event_upcoming:muster:1';
  r := r || 'kurz_unveraendert=' || ok || '; ';

  -- Rechte: aufrufen dürfen nur angemeldete Personen.
  select bool_and(not has_function_privilege('anon',f,'EXECUTE') and has_function_privilege('authenticated',f,'EXECUTE'))
    into ok
    from unnest(array[
      'public.minds_create_prospective_memory(jsonb,uuid,boolean)','public.minds_ack_standing_intents(uuid[],text)',
      'public.minds_cancel_prospective_memory(uuid,boolean)','public.minds_create_expectation(jsonb,uuid,boolean)',
      'public.minds_review_expectation(uuid,text,text,timestamptz,text,text,text,text,uuid,boolean)',
      'public.minds_create_commitment(jsonb,uuid,boolean)','public.minds_save_work_claim(jsonb,jsonb,uuid,boolean)',
      'public.minds_apply_personal_skill(jsonb,uuid,boolean)']) f;
  select ok and not has_function_privilege('authenticated','public.minds_publish_heartbeat(uuid,jsonb)','EXECUTE')
     and not has_function_privilege('anon','public.minds_publish_heartbeat(uuid,jsonb)','EXECUTE') into ok;
  r := r || 'rechte=' || case when ok then 'ok' else 'FEHLER' end || '; ';

  if r <> erwartet then raise exception 'Romys Vorschläge weichen ab: % (erwartet: %)', r, erwartet; end if;
  raise notice 'Romys Vorschläge: %', r;
end
$test$;
rollback;
do $$ begin
  if exists(select 1 from public.office_projects where id='e4000000-0000-4000-8000-0000000000e1') then
    raise exception 'Testdaten der Vorschläge sind nach dem Zurückrollen geblieben';
  end if;
end $$;
