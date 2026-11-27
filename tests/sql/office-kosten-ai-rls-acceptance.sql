-- Abnahme RLS · KI-Assistent der Kostenberechnung (Migrationen 20261121180000_office_kosten_ai_v1.sql und
-- 20261122100000_office_ki_ohne_tageslimit.sql: kein Tageslimit, jede Anfrage wird gezählt), 21./22.11.2026.
-- Seit 23.11.2026 (20261123100100_office_kosten_lesen_office.sql) darf jedes Office-Mitglied fragen; jede Person liest nur ihren eigenen Verlauf.
-- Erfundene Personen und Projekte; alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
-- A = Projektleitung von P, B = Team von P, C = Mitglied ohne Bezug zu P, D = kein Office-Mitglied.
-- Erwartet (Wahrheitswerte als «true»/«false»: so schreibt PL/pgSQL sie in Text):
-- B_schreibt=ok; B_liest=1; B_kontingent=true; A_liest_B=0; A_schreibt=ok; C_schreibt=ok; C_kontingent=true; C_liest=1;
-- B_fremd=verweigert; D_kontingent=false; anon=verweigert; B_ohne_limit=true; B_gezaehlt=0;
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a1000000-0000-4000-8000-00000000000a','authenticated','authenticated','ka-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b1000000-0000-4000-8000-00000000000b','authenticated','authenticated','ka-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('c1000000-0000-4000-8000-00000000000c','authenticated','authenticated','ka-c@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('d1000000-0000-4000-8000-00000000000d','authenticated','authenticated','ka-d@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a1000000-0000-4000-8000-00000000000a','ka-a@example.invalid','KA Leitung','projektleiter',true,false),
 ('b1000000-0000-4000-8000-00000000000b','ka-b@example.invalid','KA Team','member',true,false),
 ('c1000000-0000-4000-8000-00000000000c','ka-c@example.invalid','KA Fremd','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e1000000-0000-4000-8000-0000000000e1','KA-1','KI-Test P','aktiv','a1000000-0000-4000-8000-00000000000a','a1000000-0000-4000-8000-00000000000a');
insert into public.office_project_members(project_id,user_id,added_by) values
 ('e1000000-0000-4000-8000-0000000000e1','b1000000-0000-4000-8000-00000000000b','a1000000-0000-4000-8000-00000000000a');
insert into public.office_kosten_instances(id,project_id,template_version,project_number,project_name,owner_id,state) values
 ('f1000000-0000-4000-8000-0000000000f1','e1000000-0000-4000-8000-0000000000e1','0.0','KA-1','KI-Test P','b1000000-0000-4000-8000-00000000000b','{"v":1}');
do $test$
declare
  r text := ''; n int; ok boolean;
  erwartet constant text := 'B_schreibt=ok; B_liest=1; B_kontingent=true; A_liest_B=0; A_schreibt=ok; C_schreibt=ok; C_kontingent=true; C_liest=1; '
    || 'B_fremd=verweigert; D_kontingent=false; anon=verweigert; B_ohne_limit=true; B_gezaehlt=0; ';
  k constant uuid := 'f1000000-0000-4000-8000-0000000000f1';
begin
  -- B (Team, Ersteller): schreibt und liest den eigenen Verlauf, verbraucht Kontingent.
  perform set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  insert into public.office_kosten_dialogue_messages(instance_id,user_id,role,body,event_kind) values (k,'b1000000-0000-4000-8000-00000000000b','user','Was fehlt noch?','question');
  r := r || 'B_schreibt=ok; ';
  select count(*) into n from public.office_kosten_dialogue_messages where instance_id=k; r := r || 'B_liest=' || n || '; ';
  select public.office_kosten_ai_consume_request(k) into ok; r := r || 'B_kontingent=' || ok || '; ';
  execute 'reset role';
  -- A (Projektleitung): sieht den Verlauf von B nicht, schreibt aber einen eigenen.
  perform set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_kosten_dialogue_messages where instance_id=k; r := r || 'A_liest_B=' || n || '; ';
  insert into public.office_kosten_dialogue_messages(instance_id,user_id,role,body) values (k,'a1000000-0000-4000-8000-00000000000a','user','Frage');
  r := r || 'A_schreibt=ok; ';
  execute 'reset role';
  -- C (Mitglied ohne Bezug): fragt wie jedes Office-Mitglied, liest nur die eigene Nachricht.
  perform set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin
    insert into public.office_kosten_dialogue_messages(instance_id,user_id,role,body) values (k,'c1000000-0000-4000-8000-00000000000c','user','x');
    r := r || 'C_schreibt=ok; ';
  exception when others then r := r || 'C_schreibt=verweigert; ';
  end;
  select public.office_kosten_ai_consume_request(k) into ok; r := r || 'C_kontingent=' || ok || '; ';
  select count(*) into n from public.office_kosten_dialogue_messages; r := r || 'C_liest=' || n || '; ';
  execute 'reset role';
  -- B darf nicht im Namen von A schreiben.
  perform set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin
    insert into public.office_kosten_dialogue_messages(instance_id,user_id,role,body) values (k,'a1000000-0000-4000-8000-00000000000a','user','x');
    r := r || 'B_fremd=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_fremd=verweigert; ';
  end;
  execute 'reset role';
  -- D (kein Office-Mitglied): kein Kontingent.
  perform set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select public.office_kosten_ai_consume_request(k) into ok; r := r || 'D_kontingent=' || ok || '; ';
  execute 'reset role';
  -- anon hat keinen Zugriff.
  execute 'set local role anon';
  begin
    select count(*) into n from public.office_kosten_dialogue_messages;
    r := r || 'anon=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon=verweigert; ';
  end;
  execute 'reset role';
  -- Kein Tageslimit (Entscheidung Gari, 22.11.2026): auch nach 29 weiteren Anfragen geht es. Seit dem 27.11.2026 wird
  -- keine Anfrage mit Person gespeichert (OK von Gari): die Tabelle bleibt leer.
  perform set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  for i in 1..29 loop perform public.office_kosten_ai_consume_request(k); end loop;
  select public.office_kosten_ai_consume_request(k) into ok; r := r || 'B_ohne_limit=' || ok || '; ';
  select count(*) into n from public.office_kosten_ai_requests where instance_id=k; r := r || 'B_gezaehlt=' || n || '; ';
  execute 'reset role';
  if r <> erwartet then raise exception 'RLS KI-Assistent Kostenberechnung weicht ab: % (erwartet: %)', r, erwartet; end if;
  raise notice 'RLS KI-Assistent Kostenberechnung: %', r;
end
$test$;
rollback;
do $$ begin
  if exists(select 1 from public.office_kosten_instances where id='f1000000-0000-4000-8000-0000000000f1') then
    raise exception 'Testdaten des KI-Assistenten sind nach dem Zurückrollen geblieben';
  end if;
end $$;
