-- Abnahme · Projektwissen (Migration office_projektwissen). Erfundene Personen und Projekte; alles läuft in einer
-- Transaktion, die am Ende zurückgerollt wird. A leitet das Projekt (Projektleitung, kein Admin), B ist im Projektteam,
-- C ist Mitglied außerhalb des Teams; anon hat keinen Zugang. Geprüft wird: geteilt und geschrieben wird nur im Team
-- und nur über die Funktionen; alle im Team schreiben dieselbe Seite fort (Groß- und Kleinschreibung egal), die frühere
-- Fassung bleibt im Verlauf, ein veralteter Stand überschreibt nichts; Beiträge gelten als eingearbeitet; C sieht
-- nichts; Entscheidungen bleiben Vorschlag, bis die Projektleitung sie bestätigt, eine neue ersetzt die alte, doppelt
-- wird nichts angelegt; eine zusammengeführte Seite leitet weiter; die Regeln liest jedes Mitglied, ändern nur Admins.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('f8000000-0000-4000-8000-00000000000a','authenticated','authenticated','pw-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('f8000000-0000-4000-8000-00000000000b','authenticated','authenticated','pw-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('f8000000-0000-4000-8000-00000000000c','authenticated','authenticated','pw-c@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('f8000000-0000-4000-8000-00000000000a','pw-a@example.invalid','PW Leitung A','member',true,false),
 ('f8000000-0000-4000-8000-00000000000b','pw-b@example.invalid','PW Team B','member',true,false),
 ('f8000000-0000-4000-8000-00000000000c','pw-c@example.invalid','PW Außen C','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('f8000000-0000-4000-8000-0000000000e1','PW-1','Wissen-Test','aktiv','f8000000-0000-4000-8000-00000000000a','f8000000-0000-4000-8000-00000000000a');
insert into public.office_project_members(project_id,user_id,added_by) values
 ('f8000000-0000-4000-8000-0000000000e1','f8000000-0000-4000-8000-00000000000a','f8000000-0000-4000-8000-00000000000a'),
 ('f8000000-0000-4000-8000-0000000000e1','f8000000-0000-4000-8000-00000000000b','f8000000-0000-4000-8000-00000000000a');

do $test$
declare
  r text := ''; n int; x record; t text; b1 uuid; s1 uuid; stand1 timestamptz; e1 uuid;
  erwartet constant text :=
       'B_neu=true; B_eingearbeitet=1; A_neu=false; A_gleich=true; versionen=1; seiten=1; '
    || 'veraltet=40001; direkt=verweigert; A_direkt=0; '
    || 'C_beitraege=0; C_seiten=0; C_protokoll=0; C_teilen=42501; C_regeln=1; anon=verweigert; '
    || 'B_entscheidung=proposed; doppelt=true; B_pruefen=42501; A_pruefen=confirmed; A_neue=confirmed; alt=superseded; '
    || 'zusammen=superseded; weiter=Bodenbelag Flure; protokoll=11; A_regeln=0; ';
  ua constant text := '{"sub":"f8000000-0000-4000-8000-00000000000a","role":"authenticated"}';
  ub constant text := '{"sub":"f8000000-0000-4000-8000-00000000000b","role":"authenticated"}';
  uc constant text := '{"sub":"f8000000-0000-4000-8000-00000000000c","role":"authenticated"}';
  p constant uuid := 'f8000000-0000-4000-8000-0000000000e1';
begin
  -- B teilt einen Beitrag und legt die Seite «Bodenbelag Flure» an; der Beitrag gilt als eingearbeitet.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  b1 := public.office_wissen_beitrag_teilen(p, 'Recherche Bodenbeläge', 'Linoleum, Kautschuk und Terrazzo im Vergleich.', 'chat', 'Chat «Bodenbelag»', null);
  select * into x from public.office_wissen_seite_schreiben(p, 'Bodenbelag Flure', 'Stand: Linoleum bevorzugt.', 'Linoleum bevorzugt', array[b1]);
  s1 := x.seite_id; stand1 := x.seite_stand;
  r := r || 'B_neu=' || x.ist_neu || '; ';
  select count(*) into n from public.office_wissen_beitraege where id = b1 and 'Bodenbelag Flure' = any(eingearbeitet_in) and eingearbeitet_am is not null;
  r := r || 'B_eingearbeitet=' || n || '; ';
  execute 'reset role';

  -- A schreibt dieselbe Seite fort (andere Schreibweise); die frühere Fassung bleibt im Verlauf.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  select * into x from public.office_wissen_seite_schreiben(p, '  bodenbelag flure ', 'Stand: Linoleum entschieden, Farbe offen.', null, '{}', stand1, 'Bauherrengespräch');
  r := r || 'A_neu=' || x.ist_neu || '; A_gleich=' || (x.seite_id = s1) || '; ';
  select count(*) into n from public.office_wissen_versionen where seite_id = s1; r := r || 'versionen=' || n || '; ';
  select count(*) into n from public.minds_work_memory where project_id = p and memory_type = 'document_state' and metadata->>'kind' = 'wissensseite';
  r := r || 'seiten=' || n || '; ';
  execute 'reset role';

  -- B mit dem alten Stand: abgelehnt, nichts überschrieben. Direkt in die Beiträge schreibt niemand.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  begin perform public.office_wissen_seite_schreiben(p, 'Bodenbelag Flure', 'Überschrieben?', null, '{}', stand1);
    r := r || 'veraltet=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'veraltet=' || sqlstate || '; '; end;
  begin insert into public.office_wissen_beitraege(project_id, titel, inhalt) values (p, 'Direkt', 'Direkt eingefügt.');
    r := r || 'direkt=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'direkt=verweigert; '; end;
  execute 'reset role';

  -- A ändert die Zeile, die B angelegt hat, nicht direkt: die Projektakte behält ihre Regeln.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  update public.minds_work_memory set body = 'direkt' where id = s1;
  get diagnostics n = row_count; r := r || 'A_direkt=' || n || '; ';
  execute 'reset role';

  -- C (nicht im Team) sieht nichts und teilt nichts; die Regeln liest jedes Mitglied.
  perform set_config('request.jwt.claims', uc, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_wissen_beitraege; r := r || 'C_beitraege=' || n || '; ';
  select count(*) into n from public.minds_work_memory where project_id = p; r := r || 'C_seiten=' || n || '; ';
  select count(*) into n from public.office_wissen_protokoll; r := r || 'C_protokoll=' || n || '; ';
  begin perform public.office_wissen_beitrag_teilen(p, 'Fremd', 'Fremder Beitrag.'); r := r || 'C_teilen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_teilen=' || sqlstate || '; '; end;
  select count(*) into n from public.office_wissen_regeln; r := r || 'C_regeln=' || n || '; ';
  execute 'reset role';
  execute 'set local role anon';
  begin perform public.office_wissen_beitrag_teilen(p, 'Anonym', 'Anonymer Beitrag.'); r := r || 'anon=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon=verweigert; '; end;
  execute 'reset role';

  -- Entscheidungen: B schlägt vor (auch mit «beschlossen» bleibt es ein Vorschlag); doppelt wird nichts angelegt;
  -- B bestätigt nicht, A (Projektleitung) schon.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  select * into x from public.office_wissen_entscheidung(p, 'Linoleum in den Fluren', 'Farbe offen', '2026-11-20', 'Bauherrengespräch', b1, 'Bodenbelag Flure', true);
  e1 := x.entscheidung_id; r := r || 'B_entscheidung=' || x.entscheidung_status || '; ';
  select * into x from public.office_wissen_entscheidung(p, ' linoleum in den fluren ');
  r := r || 'doppelt=' || (x.entscheidung_id = e1) || '; ';
  begin perform public.office_wissen_entscheidung_pruefen(e1, true); r := r || 'B_pruefen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_pruefen=' || sqlstate || '; '; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  r := r || 'A_pruefen=' || public.office_wissen_entscheidung_pruefen(e1, true) || '; ';
  -- A ersetzt sie und beschließt die neue gleich: die alte bleibt sichtbar, als ersetzt.
  select * into x from public.office_wissen_entscheidung(p, 'Kautschuk in den Fluren', null, null, null, null, 'Bodenbelag Flure', true, e1);
  r := r || 'A_neue=' || x.entscheidung_status || '; ';
  select status into t from public.minds_work_memory where id = e1; r := r || 'alt=' || t || '; ';
  -- Zusammenführen: «Flure Material» geht in «Bodenbelag Flure» auf; wer danach dorthin schreibt, landet dort.
  perform public.office_wissen_seite_schreiben(p, 'Flure Material', 'Kautschuk als Rollenware.', 'Rollenware');
  perform public.office_wissen_seite_schreiben(p, 'Bodenbelag Flure', 'Kautschuk entschieden (ersetzt Linoleum), Rollenware.', null, '{}', null, 'zusammengeführt', array['flure material']);
  select status into t from public.minds_work_memory where project_id = p and title = 'Flure Material'; r := r || 'zusammen=' || t || '; ';
  select * into x from public.office_wissen_seite_schreiben(p, 'Flure Material', 'Nachtrag: Farbe grau.');
  r := r || 'weiter=' || x.seite_titel || '; ';
  select count(*) into n from public.office_wissen_protokoll where project_id = p; r := r || 'protokoll=' || n || '; ';
  update public.office_wissen_regeln set text = 'geändert';
  get diagnostics n = row_count; r := r || 'A_regeln=' || n || '; ';
  execute 'reset role';

  if r <> erwartet then raise exception 'Projektwissen weicht ab: % (erwartet: %)', r, erwartet; end if;
  raise notice 'Projektwissen: %', r;
end
$test$;
rollback;
do $$ begin
  if exists(select 1 from public.office_projects where id='f8000000-0000-4000-8000-0000000000e1') then
    raise exception 'Testdaten des Projektwissens sind nach dem Zurückrollen geblieben';
  end if;
end $$;
