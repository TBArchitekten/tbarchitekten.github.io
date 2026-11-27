-- Abnahme · Produktbibliothek (Migration 20261123180000_office_produktbibliothek_v1.sql).
-- Erfundene Personen und Projekte; alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
-- A = Projektleitung von P, T = Team von P, B = Mitglied ohne Bezug zu P, D = kein Office-Mitglied.
-- Geprüft wird: die Bibliothek gehört dem Office (lesen, anlegen, verbessern jedes Mitglied; nichts löschen);
-- «geprüft» stempelt die Datenbank; Dokumente nur unter dem eigenen Pfad, entfernen nur wer hochgeladen hat;
-- Preise ändert nur, wer sie eingetragen hat; die Verwendung im Projekt ändern nur Team und Projektleitung;
-- jede Anfrage an den Datenblatt-Leser wird gezählt, außer für Nicht-Mitglieder; D und anon bekommen nichts.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a5000000-0000-4000-8000-00000000000a','authenticated','authenticated','pb-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b5000000-0000-4000-8000-00000000000b','authenticated','authenticated','pb-t@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('c5000000-0000-4000-8000-00000000000c','authenticated','authenticated','pb-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('d5000000-0000-4000-8000-00000000000d','authenticated','authenticated','pb-d@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a5000000-0000-4000-8000-00000000000a','pb-a@example.invalid','PB Leitung','projektleiter',true,false),
 ('b5000000-0000-4000-8000-00000000000b','pb-t@example.invalid','PB Team','member',true,false),
 ('c5000000-0000-4000-8000-00000000000c','pb-b@example.invalid','PB Fremd','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e5000000-0000-4000-8000-0000000000e1','PB-1','Bibliothek-Test P','aktiv','a5000000-0000-4000-8000-00000000000a','a5000000-0000-4000-8000-00000000000a');
insert into public.office_project_members(project_id,user_id,added_by) values
 ('e5000000-0000-4000-8000-0000000000e1','a5000000-0000-4000-8000-00000000000a','a5000000-0000-4000-8000-00000000000a'),
 ('e5000000-0000-4000-8000-0000000000e1','b5000000-0000-4000-8000-00000000000b','a5000000-0000-4000-8000-00000000000a')
on conflict do nothing;

do $test$
declare
  r text := ''; n int; ok boolean; s text; x uuid; preis uuid; dok uuid;
  erwartet constant text :=
       'B_anlegen=ok; gestempelt=true; D_lesen=0; D_anlegen=verweigert; anon=verweigert; T_verbessert=1; urheber_fest=verweigert; '
    || 'loeschen=verweigert; entwurf_leert=true; T_prueft=true; B_dokument=ok; fremder_pfad=verweigert; pfad_fest=verweigert; '
    || 'T_entfernt_fremdes=0; B_entfernt=1; T_preis=ok; B_aendert_fremden_preis=0; T_aendert_eigenen=1; '
    || 'B_verwendung=verweigert; T_verwendung=ok; A_status=1; B_status=0; doppelter_code=verweigert; projekt_fest=verweigert; '
    || 'B_zaehlt=true; D_zaehlt=false; gezaehlt=0; ';
  ua constant text := '{"sub":"a5000000-0000-4000-8000-00000000000a","role":"authenticated"}';
  ut constant text := '{"sub":"b5000000-0000-4000-8000-00000000000b","role":"authenticated"}';
  ub constant text := '{"sub":"c5000000-0000-4000-8000-00000000000c","role":"authenticated"}';
  ud constant text := '{"sub":"d5000000-0000-4000-8000-00000000000d","role":"authenticated"}';
  p constant uuid := 'e5000000-0000-4000-8000-0000000000e1';
  b constant uuid := 'c5000000-0000-4000-8000-00000000000c';
  t constant uuid := 'b5000000-0000-4000-8000-00000000000b';
begin
  -- B legt ein geprüftes Produkt an; die Datenbank stempelt, wer geprüft hat.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  insert into public.office_produkte(typ,kategorie,name,hersteller,familie,status,merkmale)
  values ('produkt','bodenbelag','Musterdiele Eiche 15 mm','Hersteller Muster','Parkett, vollflächig geklebt','geprueft',
          '[{"feld":"Format","wert":"1900 × 190 mm","seite":2}]'::jsonb)
  returning id into x;
  r := r || 'B_anlegen=ok; ';
  execute 'reset role';
  select geprueft_von = b and geprueft_am is not null into ok from public.office_produkte where id = x;
  r := r || 'gestempelt=' || ok || '; ';

  -- D (kein Mitglied) und anon: nichts.
  perform set_config('request.jwt.claims', ud, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_produkte; r := r || 'D_lesen=' || n || '; ';
  begin insert into public.office_produkte(kategorie,name) values ('bodenbelag','Fremd'); r := r || 'D_anlegen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'D_anlegen=verweigert; '; end;
  execute 'reset role';
  execute 'set local role anon';
  begin perform 1 from public.office_produkte limit 1; r := r || 'anon=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon=verweigert; '; end;
  execute 'reset role';

  -- T verbessert den Eintrag von B (gemeinsamer Katalog), kann aber den Urheber nicht ändern und nichts löschen.
  perform set_config('request.jwt.claims', ut, true);
  execute 'set local role authenticated';
  update public.office_produkte set serie = 'Serie Muster' where id = x; get diagnostics n = row_count;
  r := r || 'T_verbessert=' || n || '; ';
  begin update public.office_produkte set created_by = t where id = x; r := r || 'urheber_fest=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'urheber_fest=verweigert; '; end;
  begin delete from public.office_produkte where id = x; r := r || 'loeschen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'loeschen=verweigert; '; end;
  update public.office_produkte set status = 'entwurf' where id = x;
  execute 'reset role';
  select geprueft_von is null and geprueft_am is null into ok from public.office_produkte where id = x;
  r := r || 'entwurf_leert=' || ok || '; ';
  perform set_config('request.jwt.claims', ut, true);
  execute 'set local role authenticated';
  update public.office_produkte set status = 'geprueft' where id = x;
  execute 'reset role';
  select geprueft_von = t into ok from public.office_produkte where id = x;
  r := r || 'T_prueft=' || ok || '; ';

  -- Dokumente nur unter dem eigenen Pfad; der Pfad bleibt; entfernen nur, wer hochgeladen hat.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  insert into public.office_produkt_dokumente(produkt_id,art,name,storage_path,mime_type,size_bytes,seiten)
  values (x,'datenblatt','Datenblatt.pdf', b::text || '/' || x::text || '/0f000000-0000-4000-8000-000000000001.pdf','application/pdf',1200,4)
  returning id into dok;
  r := r || 'B_dokument=ok; ';
  begin
    insert into public.office_produkt_dokumente(produkt_id,art,name,storage_path,mime_type,size_bytes)
    values (x,'datenblatt','Fremd.pdf', t::text || '/' || x::text || '/0f000000-0000-4000-8000-000000000002.pdf','application/pdf',1200);
    r := r || 'fremder_pfad=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'fremder_pfad=verweigert; '; end;
  begin update public.office_produkt_dokumente set storage_path = storage_path || 'x' where id = dok; r := r || 'pfad_fest=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'pfad_fest=verweigert; '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', ut, true);
  execute 'set local role authenticated';
  delete from public.office_produkt_dokumente where id = dok; get diagnostics n = row_count;
  r := r || 'T_entfernt_fremdes=' || n || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  delete from public.office_produkt_dokumente where id = dok; get diagnostics n = row_count;
  r := r || 'B_entfernt=' || n || '; ';
  execute 'reset role';

  -- Preise: eintragen jedes Mitglied; ändern nur, wer ihn eingetragen hat.
  perform set_config('request.jwt.claims', ut, true);
  execute 'set local role authenticated';
  insert into public.office_produkt_preise(produkt_id,art,betrag,einheit,stand,quelle,projekt_bezeichnung,kg,menge)
  values (x,'ansatz_kobe',180,'m²','2026-10-30','Kostenfortschreibung','2505','353',196.94) returning id into preis;
  r := r || 'T_preis=ok; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  update public.office_produkt_preise set betrag = 1 where id = preis; get diagnostics n = row_count;
  r := r || 'B_aendert_fremden_preis=' || n || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ut, true);
  execute 'set local role authenticated';
  update public.office_produkt_preise set kommentar = 'geprüft' where id = preis; get diagnostics n = row_count;
  r := r || 'T_aendert_eigenen=' || n || '; ';
  execute 'reset role';

  -- Verwendung im Projekt: nur Team und Projektleitung; ein Code je Projekt einmal.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  begin insert into public.office_produkt_verwendungen(produkt_id,projekt_id,code) values (x,p,'BO-01'); r := r || 'B_verwendung=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_verwendung=verweigert; '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', ut, true);
  execute 'set local role authenticated';
  insert into public.office_produkt_verwendungen(produkt_id,projekt_id,code,raeume,menge,einheit) values (x,p,'BO-01','EG, OG',196.9,'m²');
  r := r || 'T_verwendung=ok; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  update public.office_produkt_verwendungen set status = 'bemustert' where projekt_id = p and code = 'BO-01'; get diagnostics n = row_count;
  r := r || 'A_status=' || n || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  update public.office_produkt_verwendungen set status = 'freigegeben' where projekt_id = p and code = 'BO-01'; get diagnostics n = row_count;
  r := r || 'B_status=' || n || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ut, true);
  execute 'set local role authenticated';
  begin insert into public.office_produkt_verwendungen(produkt_id,projekt_id,code) values (x,p,'BO-01'); r := r || 'doppelter_code=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'doppelter_code=verweigert; '; end;
  begin update public.office_produkt_verwendungen set projekt_id = gen_random_uuid() where projekt_id = p and code = 'BO-01';
    r := r || 'projekt_fest=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'projekt_fest=verweigert; '; end;
  execute 'reset role';

  -- Jede Anfrage an den Datenblatt-Leser wird geprüft (gespeichert wird seit dem 27.11.2026 nichts); ein Nicht-Mitglied bekommt keine.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  select public.office_produkt_ai_consume_request() into ok; r := r || 'B_zaehlt=' || ok || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ud, true);
  execute 'set local role authenticated';
  select public.office_produkt_ai_consume_request() into ok; r := r || 'D_zaehlt=' || ok || '; ';
  execute 'reset role';
  select count(*) into n from public.office_produkt_ai_requests where user_id in (b, 'd5000000-0000-4000-8000-00000000000d');
  r := r || 'gezaehlt=' || n || '; ';

  if r <> erwartet then raise exception 'Produktbibliothek weicht ab: % (erwartet: %)', r, erwartet; end if;
  raise notice 'Produktbibliothek: %', r;
end
$test$;
rollback;
do $$ begin
  if exists(select 1 from public.office_projects where id='e5000000-0000-4000-8000-0000000000e1') then
    raise exception 'Testdaten der Produktbibliothek sind nach dem Zurückrollen geblieben';
  end if;
end $$;
