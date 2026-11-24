-- Abnahme · Herstellerkatalog (Migration 20261124162311_office_herstellerkatalog_v1.sql).
-- Erfundene Personen und Projekte; alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
-- B und T = Mitglieder, D = kein Office-Mitglied. Geprüft wird: der Katalog gehört dem Office (lesen, anlegen,
-- verbessern jedes Mitglied; keine Firma löschen; eine Firma nur einmal); Kontakte ändert und entfernt nur, wer sie
-- eingetragen hat; ein Kontakt bleibt an seiner Firma; ein Produkt hängt an seiner Firma; die Import-Schlüssel liest
-- niemand außer dem Server; D und anon bekommen nichts.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a6000000-0000-4000-8000-00000000000a','authenticated','authenticated','hk-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b6000000-0000-4000-8000-00000000000b','authenticated','authenticated','hk-t@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('d6000000-0000-4000-8000-00000000000d','authenticated','authenticated','hk-d@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a6000000-0000-4000-8000-00000000000a','hk-b@example.invalid','HK Mitglied B','member',true,false),
 ('b6000000-0000-4000-8000-00000000000b','hk-t@example.invalid','HK Mitglied T','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e6000000-0000-4000-8000-0000000000e1','HK-1','Katalog-Test P','aktiv','a6000000-0000-4000-8000-00000000000a','a6000000-0000-4000-8000-00000000000a');
insert into public.office_import_tokens(token_sha256,zweck,gueltig_bis)
values (repeat('ab',32),'Abnahme',now() + interval '1 hour');

do $test$
declare
  r text := ''; n int; ok boolean; f uuid; k uuid; produkt uuid;
  erwartet constant text :=
       'B_anlegen=ok; D_lesen=0; D_anlegen=verweigert; anon=verweigert; T_verbessert=1; urheber_fest=verweigert; '
    || 'loeschen=verweigert; doppelt=verweigert; archiviert_frei=ok; B_kontakt=ok; T_aendert_fremden=0; firma_fest=verweigert; '
    || 'T_entfernt_fremden=0; B_entfernt=1; ohne_projekt=verweigert; produkt_verknuepft=1; '
    || 'B_schluessel=verweigert; anon_schluessel=verweigert; ';
  ub constant text := '{"sub":"a6000000-0000-4000-8000-00000000000a","role":"authenticated"}';
  ut constant text := '{"sub":"b6000000-0000-4000-8000-00000000000b","role":"authenticated"}';
  ud constant text := '{"sub":"d6000000-0000-4000-8000-00000000000d","role":"authenticated"}';
  p constant uuid := 'e6000000-0000-4000-8000-0000000000e1';
begin
  -- B legt eine Firma an.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  insert into public.office_hersteller(firma,typ,kategorien,telefon) values ('Muster Terrazzo GmbH','ausfuehrender',array['bodenbelag'],'+49 000 1')
  returning id into f;
  r := r || 'B_anlegen=ok; ';
  execute 'reset role';

  -- D (kein Mitglied) und anon: nichts.
  perform set_config('request.jwt.claims', ud, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_hersteller; r := r || 'D_lesen=' || n || '; ';
  begin insert into public.office_hersteller(firma) values ('Fremd'); r := r || 'D_anlegen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'D_anlegen=verweigert; '; end;
  execute 'reset role';
  execute 'set local role anon';
  begin perform 1 from public.office_hersteller limit 1; r := r || 'anon=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon=verweigert; '; end;
  execute 'reset role';

  -- T verbessert die Firma von B; Urheber bleibt; löschen geht nicht.
  perform set_config('request.jwt.claims', ut, true);
  execute 'set local role authenticated';
  update public.office_hersteller set email = 'info@terrazzo.invalid' where id = f;
  get diagnostics n = row_count; r := r || 'T_verbessert=' || n || '; ';
  begin update public.office_hersteller set created_by = 'b6000000-0000-4000-8000-00000000000b' where id = f; r := r || 'urheber_fest=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'urheber_fest=verweigert; '; end;
  begin delete from public.office_hersteller where id = f; r := r || 'loeschen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'loeschen=verweigert; '; end;
  -- Dieselbe Firma (andere Schreibweise) nicht zweimal; archiviert gibt den Namen frei.
  begin insert into public.office_hersteller(firma) values (' muster terrazzo gmbh'); r := r || 'doppelt=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'doppelt=verweigert; '; end;
  insert into public.office_hersteller(firma,archiviert) values ('Muster Terrazzo GmbH',true);
  r := r || 'archiviert_frei=ok; ';
  execute 'reset role';

  -- Kontakte: B trägt ein; T ändert und entfernt fremde nicht; ein Kontakt bleibt an seiner Firma; B entfernt seinen.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  insert into public.office_hersteller_kontakte(hersteller_id,projekt_id,person_id,art,datum,notiz)
  values (f,p,'a6000000-0000-4000-8000-00000000000a','angebot','2026-11-08','Richtpreis') returning id into k;
  r := r || 'B_kontakt=ok; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ut, true);
  execute 'set local role authenticated';
  update public.office_hersteller_kontakte set notiz = 'fremd geändert' where id = k;
  get diagnostics n = row_count; r := r || 'T_aendert_fremden=' || n || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  begin update public.office_hersteller_kontakte set hersteller_id = (select id from public.office_hersteller where archiviert limit 1) where id = k;
    r := r || 'firma_fest=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'firma_fest=verweigert; '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', ut, true);
  execute 'set local role authenticated';
  delete from public.office_hersteller_kontakte where id = k;
  get diagnostics n = row_count; r := r || 'T_entfernt_fremden=' || n || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  delete from public.office_hersteller_kontakte where id = k;
  get diagnostics n = row_count; r := r || 'B_entfernt=' || n || '; ';
  begin insert into public.office_hersteller_kontakte(hersteller_id,art) values (f,'recherche'); r := r || 'ohne_projekt=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'ohne_projekt=verweigert; '; end;
  -- Ein Produkt der Bibliothek hängt an seiner Firma.
  insert into public.office_produkte(kategorie,name,hersteller) values ('bodenbelag','Musterterrazzo','Muster Terrazzo GmbH') returning id into produkt;
  update public.office_produkte set hersteller_id = f where id = produkt;
  get diagnostics n = row_count; r := r || 'produkt_verknuepft=' || n || '; ';
  -- Import-Schlüssel: kein Mitglied liest sie, anon auch nicht.
  begin perform 1 from public.office_import_tokens limit 1; r := r || 'B_schluessel=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_schluessel=verweigert; '; end;
  execute 'reset role';
  execute 'set local role anon';
  begin perform 1 from public.office_import_tokens limit 1; r := r || 'anon_schluessel=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon_schluessel=verweigert; '; end;
  execute 'reset role';

  if r <> erwartet then raise exception 'Herstellerkatalog weicht ab: % (erwartet: %)', r, erwartet; end if;
  raise notice 'Herstellerkatalog: %', r;
end
$test$;
rollback;
do $$ begin
  if exists(select 1 from public.office_projects where id='e6000000-0000-4000-8000-0000000000e1') then
    raise exception 'Testdaten des Herstellerkatalogs sind nach dem Zurückrollen geblieben';
  end if;
end $$;
