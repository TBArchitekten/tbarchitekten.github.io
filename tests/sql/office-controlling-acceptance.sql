-- Abnahme · Controlling (Migration 20261125100000_office_controlling_v1.sql).
-- Erfundene Personen, Projekte und Beträge; alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
-- A und A2 = Admins, B = Mitglied im Projektteam, C = Mitglied außerhalb des Teams. Geprüft wird: Pakete, Stände und
-- Zahlungen liest das Projekt (B), nicht C und nicht anon; Stunden je Person, Sätze und Einstellungen nur Admins;
-- schreiben nur Admins, und ein Admin ändert auch, was der andere eingetragen hat; Pakete, Stände und Stunden bleiben
-- an ihrem Platz; je Stand eine Zeile je Person; die Summen: Stunden mit Fortschreibung, Wert zum Satz ab Stichtag
-- (ein späterer Satz bewertet frühere Stunden nicht neu), Wert zum Gehalt nur für Admins und nur vollständig.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a7000000-0000-4000-8000-00000000000a','authenticated','authenticated','ct-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('a7000000-0000-4000-8000-0000000000a2','authenticated','authenticated','ct-a2@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b7000000-0000-4000-8000-00000000000b','authenticated','authenticated','ct-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('c7000000-0000-4000-8000-00000000000c','authenticated','authenticated','ct-c@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a7000000-0000-4000-8000-00000000000a','ct-a@example.invalid','CT Admin A','admin',true,false),
 ('a7000000-0000-4000-8000-0000000000a2','ct-a2@example.invalid','CT Admin A2','admin',true,false),
 ('b7000000-0000-4000-8000-00000000000b','ct-b@example.invalid','CT Mitglied B','member',true,false),
 ('c7000000-0000-4000-8000-00000000000c','ct-c@example.invalid','CT Mitglied C','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e7000000-0000-4000-8000-0000000000e1','CT-1','Controlling-Test','aktiv',null,'a7000000-0000-4000-8000-00000000000a');
insert into public.office_project_members(project_id,user_id,added_by) values
 ('e7000000-0000-4000-8000-0000000000e1','b7000000-0000-4000-8000-00000000000b','a7000000-0000-4000-8000-00000000000a');

do $test$
declare
  r text := ''; n int; pk uuid; s1 uuid; s2 uuid; s3 uuid; h uuid; z uuid; x record;
  erwartet constant text :=
       'A_paket=ok; B_pakete=1; B_staende=3; B_zahlungen=1; B_stunden=0; B_saetze=0; B_einstellungen=0; '
    || 'B_summen=3; B_s2=50.00/5100.00/null; B_s3=55.00/5525.00; C_pakete=0; C_summen=0; anon=verweigert; anon_summen=verweigert; '
    || 'B_paket_anlegen=verweigert; B_zahlung_aendern=0; A_s1_gehalt=363.00; A_s2_gehalt=null; '
    || 'A2_aendert_A=1; projekt_fest=verweigert; urheber_fest=verweigert; doppelt=verweigert; A_einstellungen=1; ';
  ua constant text := '{"sub":"a7000000-0000-4000-8000-00000000000a","role":"authenticated"}';
  ua2 constant text := '{"sub":"a7000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
  ub constant text := '{"sub":"b7000000-0000-4000-8000-00000000000b","role":"authenticated"}';
  uc constant text := '{"sub":"c7000000-0000-4000-8000-00000000000c","role":"authenticated"}';
  p constant uuid := 'e7000000-0000-4000-8000-0000000000e1';
  a constant uuid := 'a7000000-0000-4000-8000-00000000000a';
  b constant uuid := 'b7000000-0000-4000-8000-00000000000b';
begin
  -- A legt Paket, drei Stände, Stunden, Sätze und eine Zahlung an.
  -- A: 10 h, dann 30 h; B: erst im zweiten Stand 20 h, dann 25 h; im dritten Stand fehlt A (30 h gelten weiter).
  -- Satz A: 100 €/h ab 01.01., 120 €/h ab 15.11.; B ohne Satz (Paket: 85 €/h); Gehalt nur für A (4.000 €/Monat).
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  insert into public.office_controlling_pakete(project_id,bezeichnung,honorar_netto,nebenkosten_prozent,kalkulationssatz)
  values (p,'LPH 3',10000,5,85) returning id into pk;
  r := r || 'A_paket=ok; ';
  insert into public.office_controlling_staende(paket_id,stichtag,leistungsstand) values (pk,'2026-11-01',20) returning id into s1;
  insert into public.office_controlling_staende(paket_id,stichtag,leistungsstand) values (pk,'2026-11-20',50) returning id into s2;
  insert into public.office_controlling_staende(paket_id,stichtag,leistungsstand) values (pk,'2026-11-25',60) returning id into s3;
  insert into public.office_controlling_stunden(stand_id,person_id,stunden) values (s1,a,10) returning id into h;
  insert into public.office_controlling_stunden(stand_id,person_id,stunden) values (s2,a,30),(s2,b,20),(s3,b,25);
  insert into public.office_controlling_saetze(person_id,gueltig_ab,kalkulationssatz,monatsgehalt) values
    (a,'2026-01-01',100,4000),(a,'2026-11-15',120,4000);
  insert into public.office_controlling_zahlungen(paket_id,datum,bezeichnung,netto,mwst,status)
  values (pk,'2026-11-10','1. Abschlag',2100,399,'bezahlt') returning id into z;
  execute 'reset role';

  -- B (Projektteam) liest Pakete, Stände, Zahlungen und Summen, aber keine Personen, Sätze oder Einstellungen.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_controlling_pakete; r := r || 'B_pakete=' || n || '; ';
  select count(*) into n from public.office_controlling_staende; r := r || 'B_staende=' || n || '; ';
  select count(*) into n from public.office_controlling_zahlungen; r := r || 'B_zahlungen=' || n || '; ';
  select count(*) into n from public.office_controlling_stunden; r := r || 'B_stunden=' || n || '; ';
  select count(*) into n from public.office_controlling_saetze; r := r || 'B_saetze=' || n || '; ';
  select count(*) into n from public.office_controlling_einstellungen; r := r || 'B_einstellungen=' || n || '; ';
  select count(*) into n from public.office_controlling_summen(p); r := r || 'B_summen=' || n || '; ';
  select * into x from public.office_controlling_summen(p) where stand_id = s2;
  r := r || 'B_s2=' || x.stunden || '/' || x.wert_kalkulation || '/' || coalesce(x.wert_gehalt::text,'null') || '; ';
  select * into x from public.office_controlling_summen(p) where stand_id = s3;
  r := r || 'B_s3=' || x.stunden || '/' || x.wert_kalkulation || '; ';
  execute 'reset role';

  -- C (nicht im Team) und anon: nichts.
  perform set_config('request.jwt.claims', uc, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_controlling_pakete; r := r || 'C_pakete=' || n || '; ';
  select count(*) into n from public.office_controlling_summen(p); r := r || 'C_summen=' || n || '; ';
  execute 'reset role';
  execute 'set local role anon';
  begin perform 1 from public.office_controlling_pakete limit 1; r := r || 'anon=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon=verweigert; '; end;
  begin perform 1 from public.office_controlling_summen(p) limit 1; r := r || 'anon_summen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon_summen=verweigert; '; end;
  execute 'reset role';

  -- B schreibt nichts.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  begin insert into public.office_controlling_pakete(project_id,bezeichnung,honorar_netto) values (p,'Fremd',1);
    r := r || 'B_paket_anlegen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_paket_anlegen=verweigert; '; end;
  update public.office_controlling_zahlungen set netto = 1 where id = z;
  get diagnostics n = row_count; r := r || 'B_zahlung_aendern=' || n || '; ';
  execute 'reset role';

  -- A sieht den Wert zum Gehalt: Stand 1 vollständig (10 h × 4.000 × 12 × 1,21 / 1.600 = 363,00 €),
  -- Stand 2 nicht (B ohne Gehalt).
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  select * into x from public.office_controlling_summen(p) where stand_id = s1;
  r := r || 'A_s1_gehalt=' || coalesce(x.wert_gehalt::text,'null') || '; ';
  select * into x from public.office_controlling_summen(p) where stand_id = s2;
  r := r || 'A_s2_gehalt=' || coalesce(x.wert_gehalt::text,'null') || '; ';
  execute 'reset role';

  -- A2 ändert, was A eingetragen hat; was festliegt, bleibt; je Stand eine Zeile je Person.
  perform set_config('request.jwt.claims', ua2, true);
  execute 'set local role authenticated';
  update public.office_controlling_stunden set stunden = 11 where id = h;
  get diagnostics n = row_count; r := r || 'A2_aendert_A=' || n || '; ';
  begin update public.office_controlling_pakete set project_id = gen_random_uuid() where id = pk; r := r || 'projekt_fest=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'projekt_fest=verweigert; '; end;
  begin update public.office_controlling_zahlungen set created_by = 'a7000000-0000-4000-8000-0000000000a2' where id = z; r := r || 'urheber_fest=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'urheber_fest=verweigert; '; end;
  begin insert into public.office_controlling_stunden(stand_id,person_id,stunden) values (s1,a,5); r := r || 'doppelt=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'doppelt=verweigert; '; end;
  update public.office_controlling_einstellungen set jahresstunden = 1650;
  get diagnostics n = row_count; r := r || 'A_einstellungen=' || n || '; ';
  execute 'reset role';

  if r <> erwartet then raise exception 'Controlling weicht ab: % (erwartet: %)', r, erwartet; end if;
  raise notice 'Controlling: %', r;
end
$test$;
rollback;
do $$ begin
  if exists(select 1 from public.office_projects where id='e7000000-0000-4000-8000-0000000000e1') then
    raise exception 'Testdaten des Controllings sind nach dem Zurückrollen geblieben';
  end if;
end $$;
