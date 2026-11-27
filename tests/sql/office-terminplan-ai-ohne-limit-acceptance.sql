-- Abnahme · KI-Assistent des Terminplans ohne Tageslimit (Migration 20261122100000_office_ki_ohne_tageslimit.sql,
-- Entscheidung Gari, 22.11.2026). Erfundene Personen und Projekte; alles läuft in einer Transaktion, die am Ende
-- zurückgerollt wird. M = Office-Mitglied, N = angemeldet, aber kein Office-Mitglied.
-- Erwartet (Wahrheitswerte als «true»/«false»: so schreibt PL/pgSQL sie in Text):
-- M_ohne_limit=true; M_gezaehlt=0; N_kontingent=false; fremder_plan=false; anon=verweigert;
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a2000000-0000-4000-8000-00000000000a','authenticated','authenticated','tp-m@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b2000000-0000-4000-8000-00000000000b','authenticated','authenticated','tp-n@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a2000000-0000-4000-8000-00000000000a','tp-m@example.invalid','TP Mitglied','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e2000000-0000-4000-8000-0000000000e2','TP-1','KI-Test Terminplan','aktiv','a2000000-0000-4000-8000-00000000000a','a2000000-0000-4000-8000-00000000000a');
insert into public.office_terminplan_instances(id,project_id,template_version,project_number,project_name,phase,owner_id,state) values
 ('f2000000-0000-4000-8000-0000000000f2','e2000000-0000-4000-8000-0000000000e2','0.0','TP-1','KI-Test Terminplan','LPH3','a2000000-0000-4000-8000-00000000000a','{}');
do $test$
declare
  r text := ''; n int; ok boolean;
  erwartet constant text := 'M_ohne_limit=true; M_gezaehlt=0; N_kontingent=false; fremder_plan=false; anon=verweigert; ';
  t constant uuid := 'f2000000-0000-4000-8000-0000000000f2';
begin
  -- M: 30 Anfragen an einem Tag gehen alle durch; gespeichert wird seit dem 27.11.2026 keine (ohne Person).
  perform set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  for i in 1..29 loop perform public.office_ai_consume_request(t); end loop;
  select public.office_ai_consume_request(t) into ok; r := r || 'M_ohne_limit=' || ok || '; ';
  select count(*) into n from public.office_terminplan_ai_requests where plan_id=t; r := r || 'M_gezaehlt=' || n || '; ';
  execute 'reset role';
  -- N (kein Office-Mitglied): weiterhin nicht.
  perform set_config('request.jwt.claims', '{"sub":"b2000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select public.office_ai_consume_request(t) into ok; r := r || 'N_kontingent=' || ok || '; ';
  execute 'reset role';
  -- Ein Plan, den es nicht gibt: nicht.
  perform set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select public.office_ai_consume_request('f2000000-0000-4000-8000-0000000000ff') into ok; r := r || 'fremder_plan=' || ok || '; ';
  execute 'reset role';
  -- anon darf die Funktion nicht aufrufen.
  execute 'set local role anon';
  begin
    perform public.office_ai_consume_request(t);
    r := r || 'anon=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon=verweigert; ';
  end;
  execute 'reset role';
  if r <> erwartet then raise exception 'KI-Assistent Terminplan ohne Tageslimit weicht ab: % (erwartet: %)', r, erwartet; end if;
  raise notice 'KI-Assistent Terminplan ohne Tageslimit: %', r;
end
$test$;
rollback;
do $$ begin
  if exists(select 1 from public.office_terminplan_instances where id='f2000000-0000-4000-8000-0000000000f2') then
    raise exception 'Testdaten des Terminplan-Assistenten sind nach dem Zurückrollen geblieben';
  end if;
end $$;
