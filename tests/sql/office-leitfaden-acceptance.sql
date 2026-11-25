-- Abnahme · Leitfaden mit Bestätigung «Gelesen» (Migration office_leitfaden, 25.11.2026).
-- Erfundene Personen; alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
-- A = Admin, B = Mitglied, C = Mitglied, D = ausgeschiedenes Mitglied (nicht aktiv). Geprüft wird: den Leitfaden lesen
-- alle aktiven Mitglieder, D und anon nicht; freischalten nur Admins und nur «aktiv» (Stand, Zeit und Person setzen
-- Migration und Datenbank); bestätigen nur für sich, nur den geltenden Stand eines freigeschalteten Leitfadens,
-- einmal, ohne eigene Zeitangabe; die Bestätigungen liest die Person selbst und der Admin; ändern und löschen niemand.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a8000000-0000-4000-8000-00000000000a','authenticated','authenticated','lf-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b8000000-0000-4000-8000-00000000000b','authenticated','authenticated','lf-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('c8000000-0000-4000-8000-00000000000c','authenticated','authenticated','lf-c@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('d8000000-0000-4000-8000-00000000000d','authenticated','authenticated','lf-d@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a8000000-0000-4000-8000-00000000000a','lf-a@example.invalid','LF Admin A','admin',true,false),
 ('b8000000-0000-4000-8000-00000000000b','lf-b@example.invalid','LF Mitglied B','member',true,false),
 ('c8000000-0000-4000-8000-00000000000c','lf-c@example.invalid','LF Mitglied C','member',true,false),
 ('d8000000-0000-4000-8000-00000000000d','lf-d@example.invalid','LF Ehemalig D','member',false,false);

do $test$
declare
  r text := ''; n int; v text; akt boolean; von uuid; zeit timestamptz;
  erwartet constant text :=
       'B_lesen=1; B_aus=nein; B_vor_freigabe=verweigert; B_freischalten=0; A_freischalten=1; A_von=A; A_von_setzen=verweigert; '
    || 'A_stand=verweigert; B_bestaetigt=ok; B_zeit=gesetzt; B_doppelt=verweigert; B_fuer_A=verweigert; B_alter_stand=verweigert; '
    || 'C_eigene_zeit=verweigert; B_sieht=1; C_sieht=0; A_sieht=1; B_aendern=verweigert; B_loeschen=verweigert; '
    || 'D_lesen=0; D_bestaetigt=verweigert; anon_lesen=verweigert; anon_bestaetigt=verweigert; A_ausschalten=1; C_nach_aus=verweigert; ';
  ua constant text := '{"sub":"a8000000-0000-4000-8000-00000000000a","role":"authenticated"}';
  ub constant text := '{"sub":"b8000000-0000-4000-8000-00000000000b","role":"authenticated"}';
  uc constant text := '{"sub":"c8000000-0000-4000-8000-00000000000c","role":"authenticated"}';
  ud constant text := '{"sub":"d8000000-0000-4000-8000-00000000000d","role":"authenticated"}';
  a constant uuid := 'a8000000-0000-4000-8000-00000000000a';
  b constant uuid := 'b8000000-0000-4000-8000-00000000000b';
  c constant uuid := 'c8000000-0000-4000-8000-00000000000c';
  d constant uuid := 'd8000000-0000-4000-8000-00000000000d';
begin
  -- Der Leitfaden beginnt ausgeschaltet; B liest ihn, kann ihn aber weder bestätigen noch freischalten.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_leitfaeden where leitfaden = 'desktop';
  r := r || 'B_lesen=' || n || '; ';
  select version, aktiv into v, akt from public.office_leitfaeden where leitfaden = 'desktop';
  r := r || 'B_aus=' || case when akt then 'ja' else 'nein' end || '; ';
  begin insert into public.office_leitfaden_bestaetigungen(user_id,leitfaden,version) values (b,'desktop',v);
    r := r || 'B_vor_freigabe=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_vor_freigabe=verweigert; '; end;
  update public.office_leitfaeden set aktiv = true where leitfaden = 'desktop';
  get diagnostics n = row_count; r := r || 'B_freischalten=' || n || '; ';
  execute 'reset role';

  -- A schaltet frei; wer geändert hat, setzt die Datenbank; Stand und Person setzt A nicht selbst.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  update public.office_leitfaeden set aktiv = true where leitfaden = 'desktop';
  get diagnostics n = row_count; r := r || 'A_freischalten=' || n || '; ';
  select geaendert_von into von from public.office_leitfaeden where leitfaden = 'desktop';
  r := r || 'A_von=' || case when von = a then 'A' else coalesce(von::text,'leer') end || '; ';
  begin update public.office_leitfaeden set geaendert_von = b where leitfaden = 'desktop';
    r := r || 'A_von_setzen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'A_von_setzen=verweigert; '; end;
  begin update public.office_leitfaeden set version = '2027-01-01' where leitfaden = 'desktop';
    r := r || 'A_stand=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'A_stand=verweigert; '; end;
  execute 'reset role';

  -- B bestätigt den geltenden Stand, einmal, nur für sich; die Zeit setzt die Datenbank.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  insert into public.office_leitfaden_bestaetigungen(user_id,leitfaden,version) values (b,'desktop',v);
  r := r || 'B_bestaetigt=ok; ';
  select bestaetigt_am into zeit from public.office_leitfaden_bestaetigungen where user_id = b;
  r := r || 'B_zeit=' || case when zeit = now() then 'gesetzt' else coalesce(zeit::text,'leer') end || '; ';
  begin insert into public.office_leitfaden_bestaetigungen(user_id,leitfaden,version) values (b,'desktop',v);
    r := r || 'B_doppelt=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_doppelt=verweigert; '; end;
  begin insert into public.office_leitfaden_bestaetigungen(user_id,leitfaden,version) values (a,'desktop',v);
    r := r || 'B_fuer_A=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_fuer_A=verweigert; '; end;
  begin insert into public.office_leitfaden_bestaetigungen(user_id,leitfaden,version) values (b,'desktop','2026-01-01');
    r := r || 'B_alter_stand=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_alter_stand=verweigert; '; end;
  execute 'reset role';

  -- C darf die Zeit der eigenen Bestätigung nicht selbst setzen (etwa zurückdatieren).
  perform set_config('request.jwt.claims', uc, true);
  execute 'set local role authenticated';
  begin insert into public.office_leitfaden_bestaetigungen(user_id,leitfaden,version,bestaetigt_am)
    values (c,'desktop',v,now() - interval '1 year');
    r := r || 'C_eigene_zeit=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_eigene_zeit=verweigert; '; end;
  execute 'reset role';

  -- Lesen: die Person selbst und der Admin.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_leitfaden_bestaetigungen;
  r := r || 'B_sieht=' || n || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', uc, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_leitfaden_bestaetigungen;
  r := r || 'C_sieht=' || n || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_leitfaden_bestaetigungen where user_id = b;
  r := r || 'A_sieht=' || n || '; ';
  execute 'reset role';

  -- Der Beleg bleibt: B ändert und löscht die eigene Bestätigung nicht.
  perform set_config('request.jwt.claims', ub, true);
  execute 'set local role authenticated';
  begin update public.office_leitfaden_bestaetigungen set version = v where user_id = b;
    r := r || 'B_aendern=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_aendern=verweigert; '; end;
  begin delete from public.office_leitfaden_bestaetigungen where user_id = b;
    r := r || 'B_loeschen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_loeschen=verweigert; '; end;
  execute 'reset role';

  -- Wer nicht mehr aktiv ist, liest nichts und bestätigt nichts; anon auch nicht.
  perform set_config('request.jwt.claims', ud, true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_leitfaeden;
  r := r || 'D_lesen=' || n || '; ';
  begin insert into public.office_leitfaden_bestaetigungen(user_id,leitfaden,version) values (d,'desktop',v);
    r := r || 'D_bestaetigt=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'D_bestaetigt=verweigert; '; end;
  execute 'reset role';
  execute 'set local role anon';
  begin perform 1 from public.office_leitfaeden; r := r || 'anon_lesen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon_lesen=verweigert; '; end;
  begin insert into public.office_leitfaden_bestaetigungen(user_id,leitfaden,version) values (c,'desktop',v);
    r := r || 'anon_bestaetigt=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon_bestaetigt=verweigert; '; end;
  execute 'reset role';

  -- Ausgeschaltet nimmt der Leitfaden keine Bestätigung mehr an.
  perform set_config('request.jwt.claims', ua, true);
  execute 'set local role authenticated';
  update public.office_leitfaeden set aktiv = false where leitfaden = 'desktop';
  get diagnostics n = row_count; r := r || 'A_ausschalten=' || n || '; ';
  execute 'reset role';
  perform set_config('request.jwt.claims', uc, true);
  execute 'set local role authenticated';
  begin insert into public.office_leitfaden_bestaetigungen(user_id,leitfaden,version) values (c,'desktop',v);
    r := r || 'C_nach_aus=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_nach_aus=verweigert; '; end;
  execute 'reset role';

  if r <> erwartet then raise exception 'Leitfaden weicht ab: % (erwartet: %)', r, erwartet; end if;
  raise notice 'Leitfaden: %', r;
end
$test$;
rollback;
do $$ begin
  if exists(select 1 from public.office_members where user_id='b8000000-0000-4000-8000-00000000000b') then
    raise exception 'Testdaten des Leitfadens sind nach dem Zurückrollen geblieben';
  end if;
  if exists(select 1 from public.office_leitfaeden where aktiv) then
    raise exception 'Der Leitfaden ist nach dem Zurückrollen freigeschaltet';
  end if;
end $$;
