-- Abnahme · weitere Listen der Projektdokumente (Migration 20261128074445_office_projektdokumente_weitere_listen.sql), 28.11.2026.
-- Erfundene Personen und Projekte; alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
-- Geprüft: die neuen Arten (Fachplanerbedarf, Schnittstellen, Fragenliste, Eingang und die der nächsten Schritte) lassen
-- sich anlegen, eine unbekannte Art nicht; mehrere Zeilen auf einmal (Anlegen mit der Bürovorlage) bekommen ihre
-- Nummern in der Reihenfolge der Anweisung; wer nicht im Projekt ist, sieht nichts davon.
-- A = Projektleitung von P, B = Team von P, C = Mitglied ohne Bezug zu P.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a0000000-0000-4000-8000-0000000000a2','authenticated','authenticated','pl-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b0000000-0000-4000-8000-0000000000b2','authenticated','authenticated','pl-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('c0000000-0000-4000-8000-0000000000c2','authenticated','authenticated','pl-c@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a0000000-0000-4000-8000-0000000000a2','pl-a@example.invalid','PL Leitung','projektleiter',true,false),
 ('b0000000-0000-4000-8000-0000000000b2','pl-b@example.invalid','PL Team','member',true,false),
 ('c0000000-0000-4000-8000-0000000000c2','pl-c@example.invalid','PL Fremd','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e0000000-0000-4000-8000-0000000000f3','PL-1','Listentest P','aktiv','a0000000-0000-4000-8000-0000000000a2','a0000000-0000-4000-8000-0000000000a2');
insert into public.office_project_members(project_id,user_id,added_by) values
 ('e0000000-0000-4000-8000-0000000000f3','b0000000-0000-4000-8000-0000000000b2','a0000000-0000-4000-8000-0000000000a2');
do $test$
declare
  r text := ''; n int; a text; fra uuid; nrs text;
  erwartet constant text := 'fachplanerbedarf=ok; schnittstellen=ok; fragenliste=ok; eingang=ok; planliste=ok; dokumente=ok; ausgaben=ok; '
    || 'verteiler=ok; austausch=ok; ablage=ok; projektstartvermerk=ok; kickoff=ok; unbekannt=verweigert; '
    || 'B_vorlage=1,2,3; B_codes=ALLE-01,ALLE-02,TWP-01; B_verlauf=3; C_sieht=0; C_zeilen=0; ';
  p_projekt constant uuid := 'e0000000-0000-4000-8000-0000000000f3';
  b_id constant uuid := 'b0000000-0000-4000-8000-0000000000b2';
begin
  perform set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
  execute 'set local role authenticated';
  foreach a in array array['fachplanerbedarf','schnittstellen','fragenliste','eingang','planliste','dokumente','ausgaben','verteiler',
                           'austausch','ablage','projektstartvermerk','kickoff','unbekannt'] loop
    begin
      insert into public.office_projektdokumente(project_id,art,owner_id) values (p_projekt,a,b_id);
      r := r || a || '=' || case when a = 'unbekannt' then 'ERLAUBT(FEHLER)' else 'ok' end || '; ';
    exception when others then r := r || a || '=' || case when a = 'unbekannt' then 'verweigert' else 'FEHLER(' || sqlerrm || ')' end || '; ';
    end;
  end loop;
  -- Anlegen mit der Bürovorlage: alle Zeilen in einer Anweisung, die Nummern in dieser Reihenfolge.
  select id into fra from public.office_projektdokumente where project_id = p_projekt and art = 'fragenliste';
  insert into public.office_projektdokument_zeilen(dokument_id,daten)
    select fra, x from jsonb_array_elements('[{"code":"ALLE-01","status":"offen"},{"code":"ALLE-02","status":"offen"},{"code":"TWP-01","status":"offen"}]'::jsonb) x;
  select string_agg(nr::text, ',' order by nr), string_agg(daten->>'code', ',' order by nr) into nrs, a
    from public.office_projektdokument_zeilen where dokument_id = fra;
  r := r || 'B_vorlage=' || nrs || '; B_codes=' || a || '; ';
  select count(*) into n from public.office_projektdokument_aenderungen where dokument_id = fra and vorgang = 'angelegt';
  r := r || 'B_verlauf=' || n || '; ';
  execute 'reset role';

  -- C ist im Office, aber nicht im Projekt.
  perform set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-0000000000c2","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_projektdokumente where project_id = p_projekt; r := r || 'C_sieht=' || n || '; ';
  select count(*) into n from public.office_projektdokument_zeilen where dokument_id = fra; r := r || 'C_zeilen=' || n || '; ';
  execute 'reset role';
  if r <> erwartet then
    raise exception 'Weitere Listen weichen ab. Erwartet: % Erhalten: %', erwartet, r;
  end if;
  raise notice 'Weitere Listen: %', r;
end $test$;
rollback;
-- Nichts davon darf bleiben.
do $test$ begin
  if exists(select 1 from public.office_projects where id = 'e0000000-0000-4000-8000-0000000000f3')
     or exists(select 1 from public.office_projektdokumente where project_id = 'e0000000-0000-4000-8000-0000000000f3') then
    raise exception 'Testdaten der weiteren Listen sind nach dem Zurückrollen geblieben';
  end if;
end $test$;
