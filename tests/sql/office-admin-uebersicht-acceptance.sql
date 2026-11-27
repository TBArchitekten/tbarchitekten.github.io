-- Abnahme · Übersicht für Administratoren (Migration office_admin_uebersicht). Erfundene Personen und ein erfundenes
-- Projekt; alles in einer Transaktion, die am Ende zurückgerollt wird. A ist Administratorin, B Mitarbeiter, C war
-- Administratorin und ist nicht mehr aktiv. Geprüft wird: nur aktive Administratoren rufen die drei Funktionen auf;
-- das Guthaben wird geprüft und gerundet, «warnen ab» bleibt; die KI-Nutzung trennt vor und nach dem Guthaben, lange
-- Anfragen, Office und Romy, und nennt nie eine Person; der Systemstatus liefert jede Prüfung.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('f9300000-0000-4000-8000-00000000000a','authenticated','authenticated','uebersicht-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('f9300000-0000-4000-8000-00000000000b','authenticated','authenticated','uebersicht-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('f9300000-0000-4000-8000-00000000000c','authenticated','authenticated','uebersicht-c@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('f9300000-0000-4000-8000-00000000000a','uebersicht-a@example.invalid','Übersicht A','admin',true,false),
 ('f9300000-0000-4000-8000-00000000000b','uebersicht-b@example.invalid','Übersicht B','member',true,false),
 ('f9300000-0000-4000-8000-00000000000c','uebersicht-c@example.invalid','Übersicht C','admin',false,false);
insert into public.office_projects(id, number, name) values ('f9300000-0000-4000-8000-0000000000b1', 'T-9301', 'Testprojekt Übersicht');
-- Verbrauch vor dem Guthaben-Eintrag: zwei Aufrufe, einer davon lang. Die Aufrufe danach kommen im Test.
insert into public.office_ki_verbrauch(funktion, modell, input_tokens, cached_input_tokens, output_tokens, total_tokens, project_id, details, created_at) values
 ('kosten', 'gpt-6.1-terra', 1000, 100, 200, 1200, 'f9300000-0000-4000-8000-0000000000b1', '{"websuchen":2}', now() - interval '1 hour'),
 ('kosten', 'gpt-6.1-terra', 300000, 0, 1000, 301000, 'f9300000-0000-4000-8000-0000000000b1', '{}', now() - interval '1 hour');

do $test$
declare
  r text := ''; n int; j jsonb; t text;
  ua constant text := '{"sub":"f9300000-0000-4000-8000-00000000000a","role":"authenticated"}';
  ub constant text := '{"sub":"f9300000-0000-4000-8000-00000000000b","role":"authenticated"}';
  uc constant text := '{"sub":"f9300000-0000-4000-8000-00000000000c","role":"authenticated"}';
  erwartet constant text :=
       'B_nutzung=verweigert; B_status=verweigert; B_guthaben=verweigert; C_nutzung=verweigert; anon=verweigert; '
    || 'A_direkt=verweigert; negativ=abgewiesen; betrag=25.46; warnen=7; warnen_neu=10; warnen_bleibt=10; '
    || 'gruppen=5; vor=2; nach=3; lang=1; romy=1; websuchen=2; container=1; ohne_person=ja; projekte=1; '
    || 'bereiche=browserfehler,heartbeat,ki,netz,push,zeitplaene; ';
begin
  -- B (Mitarbeiter) und C (nicht mehr aktiv) dürfen nichts davon; anon schon gar nicht.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  begin perform public.office_ki_nutzung(); r := r || 'B_nutzung=erlaubt; ';
  exception when insufficient_privilege then r := r || 'B_nutzung=verweigert; '; end;
  begin perform public.office_systemstatus(); r := r || 'B_status=erlaubt; ';
  exception when insufficient_privilege then r := r || 'B_status=verweigert; '; end;
  begin perform public.office_ki_guthaben_eintragen(10); r := r || 'B_guthaben=erlaubt; ';
  exception when insufficient_privilege then r := r || 'B_guthaben=verweigert; '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', uc, true);
  execute 'set local role authenticated';
  begin perform public.office_ki_nutzung(); r := r || 'C_nutzung=erlaubt; ';
  exception when insufficient_privilege then r := r || 'C_nutzung=verweigert; '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin perform public.office_ki_nutzung(); r := r || 'anon=erlaubt; ';
  exception when insufficient_privilege then r := r || 'anon=verweigert; '; end;
  execute 'reset role';

  -- A trägt das Guthaben ein: geprüft, gerundet, «warnen ab» bleibt, bis es neu angegeben wird.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  begin perform 1 from public.office_ki_guthaben; r := r || 'A_direkt=erlaubt; ';
  exception when insufficient_privilege then r := r || 'A_direkt=verweigert; '; end;
  begin perform public.office_ki_guthaben_eintragen(-1); r := r || 'negativ=angenommen; ';
  exception when invalid_parameter_value then r := r || 'negativ=abgewiesen; '; end;
  j := public.office_ki_guthaben_eintragen(25.456);
  r := r || 'betrag=' || (j->>'betrag_usd') || '; warnen=' || (j->>'warnen_ab_tage') || '; ';
  j := public.office_ki_guthaben_eintragen(30, 10);
  r := r || 'warnen_neu=' || (j->>'warnen_ab_tage') || '; ';
  j := public.office_ki_guthaben_eintragen(31);
  r := r || 'warnen_bleibt=' || (j->>'warnen_ab_tage') || '; ';
  execute 'reset role';

  -- Nach dem Eintrag: zwei Aufrufe im Office und einer aus Romys Motor von B.
  insert into public.office_ki_verbrauch(funktion, modell, input_tokens, cached_input_tokens, output_tokens, total_tokens, project_id, details, created_at) values
   ('kosten', 'gpt-6.1-terra', 3000, 0, 500, 3500, 'f9300000-0000-4000-8000-0000000000b1', '{}', clock_timestamp()),
   ('produkte', 'gpt-6.1-terra', 2000, 0, 300, 2300, null, '{"container":1}', clock_timestamp());
  insert into public.minds_ai_usage(user_id, feature, model, input_tokens, cached_input_tokens, output_tokens, total_tokens, created_at) values
   ('f9300000-0000-4000-8000-00000000000b', 'isabella_chat', 'gpt-5.6-luna', 500, 0, 50, 550, clock_timestamp());
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';

  -- Die KI-Nutzung: Gruppen vor und nach dem Guthaben, lange Anfrage, Romy, Websuchen und Container; keine Person.
  j := public.office_ki_nutzung();
  r := r || 'gruppen=' || jsonb_array_length(j->'zeilen') || '; ';
  select count(*) into n from jsonb_array_elements(j->'zeilen') z where (z->>'nach_stand')::boolean = false;
  r := r || 'vor=' || n || '; ';
  select count(*) into n from jsonb_array_elements(j->'zeilen') z where (z->>'nach_stand')::boolean;
  r := r || 'nach=' || n || '; ';
  select count(*) into n from jsonb_array_elements(j->'zeilen') z where (z->>'lang')::boolean;
  r := r || 'lang=' || n || '; ';
  select count(*) into n from jsonb_array_elements(j->'zeilen') z where z->>'quelle' = 'romy' and z->>'projekt_id' is null;
  r := r || 'romy=' || n || '; ';
  select coalesce(sum((z->>'websuchen')::int), 0) into n from jsonb_array_elements(j->'zeilen') z;
  r := r || 'websuchen=' || n || '; ';
  select coalesce(sum((z->>'container')::int), 0) into n from jsonb_array_elements(j->'zeilen') z;
  r := r || 'container=' || n || '; ';
  t := j::text;
  r := r || 'ohne_person=' || case when t like '%f9300000-0000-4000-8000-00000000000b%' or t like '%user_id%' then 'nein' else 'ja' end || '; ';
  r := r || 'projekte=' || jsonb_array_length(j->'projekte') || '; ';

  -- Der Systemstatus liefert jede Prüfung (ohne Läufe im Test ist die nächtliche Pflege nicht dabei).
  j := public.office_systemstatus();
  select string_agg(p->>'bereich', ',' order by p->>'bereich') into t from jsonb_array_elements(j->'pruefungen') p;
  r := r || 'bereiche=' || t || '; ';
  execute 'reset role';

  if r <> erwartet then
    raise exception 'office_admin_uebersicht: erwartet [%] bekommen [%]', erwartet, r;
  end if;
  raise notice 'office_admin_uebersicht acceptance ok';
end
$test$;
rollback;
