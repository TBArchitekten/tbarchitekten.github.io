-- Abnahme RLS · Projektdokumente v1 (Migration 20261124090000_office_projektdokumente_v1.sql), 24.11.2026.
-- Erfundene Personen und Projekte; alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
-- Läuft im CI auf der frisch migrierten Datenbank (verify.yml) und lässt sich ebenso gegen jede Datenbank
-- mit der Migration ausführen: gezählt wird nur, was diese Datei selbst anlegt.
-- A = Projektleitung von P und Q, B = Team von P und Q, C = Mitglied ohne Bezug zu P, D = kein Office-Mitglied.
-- Q ist archiviert. Geprüft werden Zugang, Nummernvergabe, Verlauf, Serverrevision, die Regeln der
-- Entscheidungsliste (nie «entschieden» ohne Datum, Entscheider und Entscheidung, nie aus einem Vorschlag von Romy),
-- unveränderliche Stände und das Zählen der Anfragen an Romy.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a0000000-0000-4000-8000-0000000000a1','authenticated','authenticated','pd-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b0000000-0000-4000-8000-0000000000b1','authenticated','authenticated','pd-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('c0000000-0000-4000-8000-0000000000c1','authenticated','authenticated','pd-c@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('d0000000-0000-4000-8000-0000000000d1','authenticated','authenticated','pd-d@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a0000000-0000-4000-8000-0000000000a1','pd-a@example.invalid','PD Leitung','projektleiter',true,false),
 ('b0000000-0000-4000-8000-0000000000b1','pd-b@example.invalid','PD Team','member',true,false),
 ('c0000000-0000-4000-8000-0000000000c1','pd-c@example.invalid','PD Fremd','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e0000000-0000-4000-8000-0000000000f1','PD-1','Dokumenttest P','aktiv','a0000000-0000-4000-8000-0000000000a1','a0000000-0000-4000-8000-0000000000a1'),
 ('e0000000-0000-4000-8000-0000000000f2','PD-2','Dokumenttest Q','archiviert','a0000000-0000-4000-8000-0000000000a1','a0000000-0000-4000-8000-0000000000a1');
insert into public.office_project_members(project_id,user_id,added_by) values
 ('e0000000-0000-4000-8000-0000000000f1','b0000000-0000-4000-8000-0000000000b1','a0000000-0000-4000-8000-0000000000a1'),
 ('e0000000-0000-4000-8000-0000000000f2','b0000000-0000-4000-8000-0000000000b1','a0000000-0000-4000-8000-0000000000a1');
do $test$
declare
  r text := ''; n int; t text; ok boolean;
  kla uuid; ent uuid; z1 uuid; z2 uuid; e1 uuid; v1 uuid; v2 uuid;
  erwartet constant text := 'B_dok=ok; B_doppelt=verweigert; B_archiv=verweigert; B_nr1=1; B_nr2=2; B_update=1; B_alt=0; B_verlauf=3; '
    || 'B_verlauf_schreiben=verweigert; B_owner=verweigert; B_dok_loeschen=verweigert; '
    || 'C_sieht=0; C_zeile=verweigert; C_update=0; C_verlauf=0; C_dok=verweigert; '
    || 'A_sieht=2; A_update=1; A_delete=1; A_verlauf=5; A_geloescht_nr=2; '
    || 'B_ent=ok; B_ohne_entscheider=verweigert; B_vorschlag_entscheidung=verweigert; B_romy_quelle=romy; B_vorschlag=uebernommen; '
    || 'B_vorschlag_zweimal=verweigert; B_fremder_vorschlag=verweigert; B_romy_entscheidung=verweigert; B_entschieden=1; B_hand=hand; '
    || 'B_vorschlag_daten=verweigert; C_vorschlaege=0; B_stand=ok; B_stand_aendern=verweigert; B_stand_loeschen=verweigert; B_ki=ja; '
    || 'C_staende=0; D_ki=nein; D_sieht=0; anon=verweigert; ';
  p_projekt constant uuid := 'e0000000-0000-4000-8000-0000000000f1';
  q_projekt constant uuid := 'e0000000-0000-4000-8000-0000000000f2';
  a_id constant uuid := 'a0000000-0000-4000-8000-0000000000a1';
  b_id constant uuid := 'b0000000-0000-4000-8000-0000000000b1';
begin
  -- B (Team von P) legt die Klärungsliste an; doppelt und im archivierten Projekt geht es nicht.
  perform set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
  execute 'set local role authenticated';
  insert into public.office_projektdokumente(project_id,art,owner_id) values (p_projekt,'klaerungsliste',b_id) returning id into kla;
  r := r || 'B_dok=ok; ';
  begin
    insert into public.office_projektdokumente(project_id,art,owner_id) values (p_projekt,'klaerungsliste',b_id);
    r := r || 'B_doppelt=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_doppelt=verweigert; ';
  end;
  begin
    insert into public.office_projektdokumente(project_id,art,owner_id) values (q_projekt,'klaerungsliste',b_id);
    r := r || 'B_archiv=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_archiv=verweigert; ';
  end;
  -- Die Nummer vergibt die Datenbank, auch wenn der Client eine mitschickt.
  insert into public.office_projektdokument_zeilen(dokument_id,daten) values (kla,'{"sachverhalt":"S1","status":"offen"}') returning id, nr into z1, n;
  r := r || 'B_nr1=' || n || '; ';
  insert into public.office_projektdokument_zeilen(dokument_id,nr,daten) values (kla,7,'{"sachverhalt":"S2","status":"offen"}') returning id, nr into z2, n;
  r := r || 'B_nr2=' || n || '; ';
  update public.office_projektdokument_zeilen set daten = daten || '{"status":"in Klärung"}' where id = z1 and server_revision = 1;
  get diagnostics n = row_count; r := r || 'B_update=' || n || '; ';
  update public.office_projektdokument_zeilen set daten = daten || '{"status":"gelöst"}' where id = z1 and server_revision = 1;
  get diagnostics n = row_count; r := r || 'B_alt=' || n || '; ';
  select count(*) into n from public.office_projektdokument_aenderungen where dokument_id = kla; r := r || 'B_verlauf=' || n || '; ';
  begin
    insert into public.office_projektdokument_aenderungen(dokument_id,nr,vorgang) values (kla,1,'geaendert');
    r := r || 'B_verlauf_schreiben=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_verlauf_schreiben=verweigert; ';
  end;
  begin
    update public.office_projektdokumente set owner_id = a_id where id = kla;
    r := r || 'B_owner=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_owner=verweigert; ';
  end;
  begin
    delete from public.office_projektdokumente where id = kla;
    r := r || 'B_dok_loeschen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_dok_loeschen=verweigert; ';
  end;
  execute 'reset role';

  -- C (Mitglied ohne Bezug) sieht nichts und ändert nichts.
  perform set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_projektdokumente where project_id = p_projekt; r := r || 'C_sieht=' || n || '; ';
  begin
    insert into public.office_projektdokument_zeilen(dokument_id,daten) values (kla,'{"sachverhalt":"fremd"}');
    r := r || 'C_zeile=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_zeile=verweigert; ';
  end;
  update public.office_projektdokument_zeilen set daten = '{}' where dokument_id = kla;
  get diagnostics n = row_count; r := r || 'C_update=' || n || '; ';
  select count(*) into n from public.office_projektdokument_aenderungen where dokument_id = kla; r := r || 'C_verlauf=' || n || '; ';
  begin
    insert into public.office_projektdokumente(project_id,art,owner_id) values (p_projekt,'entscheidungsvorlagen','c0000000-0000-4000-8000-0000000000c1');
    r := r || 'C_dok=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_dok=verweigert; ';
  end;
  execute 'reset role';

  -- A (Projektleitung) sieht, ändert und löscht; der Verlauf behält die gelöschte Zeile.
  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_projektdokument_zeilen where dokument_id = kla; r := r || 'A_sieht=' || n || '; ';
  update public.office_projektdokument_zeilen set daten = daten || '{"status":"gelöst"}' where id = z1;
  get diagnostics n = row_count; r := r || 'A_update=' || n || '; ';
  delete from public.office_projektdokument_zeilen where id = z2;
  get diagnostics n = row_count; r := r || 'A_delete=' || n || '; ';
  select count(*) into n from public.office_projektdokument_aenderungen where dokument_id = kla; r := r || 'A_verlauf=' || n || '; ';
  select a.nr into n from public.office_projektdokument_aenderungen a where a.dokument_id = kla and a.vorgang = 'geloescht' and a.user_id = a_id;
  r := r || 'A_geloescht_nr=' || coalesce(n::text, 'fehlt') || '; ';
  execute 'reset role';

  -- Entscheidungsliste: «entschieden» nur mit Datum, Entscheider und Entscheidung, nie aus einem Vorschlag.
  perform set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
  execute 'set local role authenticated';
  insert into public.office_projektdokumente(project_id,art,owner_id) values (p_projekt,'entscheidungsliste',b_id) returning id into ent;
  r := r || 'B_ent=ok; ';
  begin
    insert into public.office_projektdokument_zeilen(dokument_id,daten) values (ent,'{"status":"entschieden","entschieden_am":"2026-11-20"}');
    r := r || 'B_ohne_entscheider=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_ohne_entscheider=verweigert; ';
  end;
  insert into public.office_projektdokument_zeilen(dokument_id,daten) values (ent,'{"status":"vorgelegt","thema":"T"}') returning id into e1;
  begin
    insert into public.office_projektdokument_vorschlaege(dokument_id,zeile_id,art,daten,fundstelle)
      values (ent,e1,'aenderung','{"status":"entschieden"}','Protokoll S. 1');
    r := r || 'B_vorschlag_entscheidung=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_vorschlag_entscheidung=verweigert; ';
  end;
  insert into public.office_projektdokument_vorschlaege(dokument_id,zeile_id,art,daten,fundstelle)
    values (ent,e1,'aenderung','{"empfehlung":"B"}','Protokoll S. 2') returning id into v1;
  update public.office_projektdokument_zeilen set daten = daten || '{"empfehlung":"B"}', vorschlag_id = v1 where id = e1;
  select a.quelle into t from public.office_projektdokument_aenderungen a where a.zeile_id = e1 and a.feld = 'empfehlung' order by a.id desc limit 1;
  r := r || 'B_romy_quelle=' || coalesce(t, 'fehlt') || '; ';
  update public.office_projektdokument_vorschlaege set status = 'uebernommen' where id = v1;
  select case when v.entschieden_von = b_id and v.entschieden_am is not null then v.status else 'falsch' end into t
    from public.office_projektdokument_vorschlaege v where v.id = v1;
  r := r || 'B_vorschlag=' || coalesce(t, 'fehlt') || '; ';
  begin
    update public.office_projektdokument_vorschlaege set status = 'verworfen' where id = v1;
    r := r || 'B_vorschlag_zweimal=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_vorschlag_zweimal=verweigert; ';
  end;
  insert into public.office_projektdokument_vorschlaege(dokument_id,zeile_id,art,daten,fundstelle)
    values (ent,e1,'aenderung','{"thema":"T2"}','Protokoll S. 3') returning id into v2;
  begin
    insert into public.office_projektdokument_zeilen(dokument_id,daten,vorschlag_id) values (kla,'{"sachverhalt":"S3"}',v2);
    r := r || 'B_fremder_vorschlag=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_fremder_vorschlag=verweigert; ';
  end;
  begin
    update public.office_projektdokument_zeilen set daten = daten || '{"entschieden_am":"2026-11-20"}', vorschlag_id = v2 where id = e1;
    r := r || 'B_romy_entscheidung=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_romy_entscheidung=verweigert; ';
  end;
  update public.office_projektdokument_zeilen
     set daten = daten || '{"status":"entschieden","entschieden_am":"2026-11-20","entscheider":"Auftraggeber","entscheidung":"B"}'
   where id = e1;
  get diagnostics n = row_count; r := r || 'B_entschieden=' || n || '; ';
  select a.quelle into t from public.office_projektdokument_aenderungen a where a.zeile_id = e1 and a.feld = 'status' order by a.id desc limit 1;
  r := r || 'B_hand=' || coalesce(t, 'fehlt') || '; ';
  begin
    update public.office_projektdokument_vorschlaege set daten = '{"thema":"anders"}' where id = v2;
    r := r || 'B_vorschlag_daten=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_vorschlag_daten=verweigert; ';
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_projektdokument_vorschlaege where dokument_id = ent; r := r || 'C_vorschlaege=' || n || '; ';
  execute 'reset role';

  -- Stände bleiben, wie sie festgehalten wurden.
  perform set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
  execute 'set local role authenticated';
  insert into public.office_projektdokument_staende(dokument_id,zeile_id,bezeichnung,inhalt) values (ent,e1,'Vorlage 01 · vorgelegt','{"v":1}');
  r := r || 'B_stand=ok; ';
  begin
    update public.office_projektdokument_staende set bezeichnung = 'anders' where dokument_id = ent;
    r := r || 'B_stand_aendern=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_stand_aendern=verweigert; ';
  end;
  begin
    delete from public.office_projektdokument_staende where dokument_id = ent;
    r := r || 'B_stand_loeschen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_stand_loeschen=verweigert; ';
  end;
  select public.office_projektdokument_ai_consume_request() into ok; r := r || 'B_ki=' || case when ok then 'ja' else 'nein' end || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_projektdokument_staende where dokument_id = ent; r := r || 'C_staende=' || n || '; ';
  execute 'reset role';

  -- D ist kein Mitglied, anon hat keinen Zugriff.
  perform set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select public.office_projektdokument_ai_consume_request() into ok; r := r || 'D_ki=' || case when ok then 'ja' else 'nein' end || '; ';
  select count(*) into n from public.office_projektdokumente where project_id = p_projekt; r := r || 'D_sieht=' || n || '; ';
  execute 'reset role';
  execute 'set local role anon';
  begin
    select count(*) into n from public.office_projektdokumente; r := r || 'anon=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon=verweigert; ';
  end;
  execute 'reset role';
  if r <> erwartet then
    raise exception 'RLS Projektdokumente weicht ab. Erwartet: % Erhalten: %', erwartet, r;
  end if;
  raise notice 'RLS Projektdokumente: %', r;
end $test$;
rollback;
-- Nichts davon darf bleiben.
do $test$ begin
  if exists(select 1 from public.office_projects where id in ('e0000000-0000-4000-8000-0000000000f1','e0000000-0000-4000-8000-0000000000f2'))
     or exists(select 1 from public.office_projektdokumente where project_id in ('e0000000-0000-4000-8000-0000000000f1','e0000000-0000-4000-8000-0000000000f2')) then
    raise exception 'Testdaten der Projektdokumente sind nach dem Zurückrollen geblieben';
  end if;
end $test$;
