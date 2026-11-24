-- Abnahme RLS · Bilder der Mustermappe (Migration office_projektdokumente_bilder), 24.11.2026.
-- Erfundene Personen und Projekte; alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
-- A = Projektleitung von P, B = Team von P, C = Mitglied ohne Bezug zu P, D = kein Office-Mitglied.
-- Geprüft: lesen nur mit Zugang zum Dokument; hochladen nur unter dem eigenen Pfad eines solchen Dokuments und nur
-- mit gültigem Pfad; entfernen nur, wer hochgeladen hat (oder ein Admin); nichts ohne Anmeldung.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a1000000-0000-4000-8000-0000000000a1','authenticated','authenticated','mm-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b1000000-0000-4000-8000-0000000000b1','authenticated','authenticated','mm-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('c1000000-0000-4000-8000-0000000000c1','authenticated','authenticated','mm-c@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('d1000000-0000-4000-8000-0000000000d1','authenticated','authenticated','mm-d@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a1000000-0000-4000-8000-0000000000a1','mm-a@example.invalid','MM Leitung','projektleiter',true,false),
 ('b1000000-0000-4000-8000-0000000000b1','mm-b@example.invalid','MM Team','member',true,false),
 ('c1000000-0000-4000-8000-0000000000c1','mm-c@example.invalid','MM Fremd','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e1000000-0000-4000-8000-0000000000f1','MM-1','Mappentest P','aktiv','a1000000-0000-4000-8000-0000000000a1','a1000000-0000-4000-8000-0000000000a1');
insert into public.office_project_members(project_id,user_id,added_by) values
 ('e1000000-0000-4000-8000-0000000000f1','b1000000-0000-4000-8000-0000000000b1','a1000000-0000-4000-8000-0000000000a1');
do $test$
declare
  r text := ''; n int; dok uuid;
  erwartet constant text := 'bucket=privat; A_dok=ok; A_bild=ok; B_bild=ok; B_fremder_pfad=verweigert; B_ohne_dokument=verweigert; '
    || 'B_tiefer=verweigert; B_unbekanntes_dokument=verweigert; B_sieht=2; C_sieht=0; C_bild=verweigert; D_sieht=0; '
    || 'B_entfernt_fremdes=0; A_entfernt_fremdes=0; B_entfernt_eigenes=1; anon=0; ';
  p_projekt constant uuid := 'e1000000-0000-4000-8000-0000000000f1';
  a_id constant text := 'a1000000-0000-4000-8000-0000000000a1';
  b_id constant text := 'b1000000-0000-4000-8000-0000000000b1';
  c_id constant text := 'c1000000-0000-4000-8000-0000000000c1';
begin
  select case when public then 'oeffentlich' else 'privat' end into r from storage.buckets where id = 'office-projektdokumente';
  r := 'bucket=' || coalesce(r,'fehlt') || '; ';
  -- A legt die Entscheidungsvorlagen des Projekts an und lädt ein Bild hoch.
  perform set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
  execute 'set local role authenticated';
  insert into public.office_projektdokumente(project_id,art,owner_id) values (p_projekt,'entscheidungsvorlagen',a_id::uuid) returning id into dok;
  r := r || 'A_dok=ok; ';
  insert into storage.objects(bucket_id,name) values ('office-projektdokumente', dok || '/' || a_id || '/plan-a.jpg');
  r := r || 'A_bild=ok; ';
  -- B (Team) unter dem eigenen Pfad: ja; unter dem Pfad von A, ohne Dokument, tiefer verschachtelt: nein.
  perform set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
  insert into storage.objects(bucket_id,name) values ('office-projektdokumente', dok || '/' || b_id || '/plan-b.png');
  r := r || 'B_bild=ok; ';
  begin
    insert into storage.objects(bucket_id,name) values ('office-projektdokumente', dok || '/' || a_id || '/von-b.png');
    r := r || 'B_fremder_pfad=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_fremder_pfad=verweigert; ';
  end;
  begin
    insert into storage.objects(bucket_id,name) values ('office-projektdokumente', 'kein-dokument/' || b_id || '/x.png');
    r := r || 'B_ohne_dokument=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_ohne_dokument=verweigert; ';
  end;
  begin
    insert into storage.objects(bucket_id,name) values ('office-projektdokumente', dok || '/' || b_id || '/tiefer/x.png');
    r := r || 'B_tiefer=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_tiefer=verweigert; ';
  end;
  begin
    insert into storage.objects(bucket_id,name) values ('office-projektdokumente', gen_random_uuid() || '/' || b_id || '/x.png');
    r := r || 'B_unbekanntes_dokument=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_unbekanntes_dokument=verweigert; ';
  end;
  select count(*) into n from storage.objects where bucket_id = 'office-projektdokumente' and name like dok || '/%';
  r := r || 'B_sieht=' || n || '; ';
  -- C (Mitglied ohne Projekt) sieht nichts und lädt nichts hoch; D ist kein Mitglied.
  perform set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
  select count(*) into n from storage.objects where bucket_id = 'office-projektdokumente' and name like dok || '/%';
  r := r || 'C_sieht=' || n || '; ';
  begin
    insert into storage.objects(bucket_id,name) values ('office-projektdokumente', dok || '/' || c_id || '/x.png');
    r := r || 'C_bild=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_bild=verweigert; ';
  end;
  perform set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
  select count(*) into n from storage.objects where bucket_id = 'office-projektdokumente' and name like dok || '/%';
  r := r || 'D_sieht=' || n || '; ';
  -- Entfernen: nur, wer hochgeladen hat; die Projektleitung ohne Admin-Rolle auch nicht. Neuere Fassungen von Storage
  -- sperren DELETE per SQL; für diese Prüfung der Policies wird es in der Transaktion erlaubt.
  perform set_config('storage.allow_delete_query', 'true', true);
  perform set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
  delete from storage.objects where bucket_id = 'office-projektdokumente' and name = dok || '/' || a_id || '/plan-a.jpg';
  get diagnostics n = row_count; r := r || 'B_entfernt_fremdes=' || n || '; ';
  perform set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
  delete from storage.objects where bucket_id = 'office-projektdokumente' and name = dok || '/' || b_id || '/plan-b.png';
  get diagnostics n = row_count; r := r || 'A_entfernt_fremdes=' || n || '; ';
  perform set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
  delete from storage.objects where bucket_id = 'office-projektdokumente' and name = dok || '/' || b_id || '/plan-b.png';
  get diagnostics n = row_count; r := r || 'B_entfernt_eigenes=' || n || '; ';
  -- Ohne Anmeldung: nichts.
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    select count(*) into n from storage.objects where bucket_id = 'office-projektdokumente';
  exception when insufficient_privilege then n := 0;
  end;
  r := r || 'anon=' || n || '; ';
  execute 'reset role';
  if r <> erwartet then
    raise exception 'RLS Bilder der Mustermappe weicht ab. Erwartet: % Erhalten: %', erwartet, r;
  end if;
  raise notice 'RLS Bilder der Mustermappe: %', r;
end $test$;
rollback;
-- Nichts davon darf bleiben.
do $test$ begin
  if exists(select 1 from public.office_projects where id = 'e1000000-0000-4000-8000-0000000000f1')
     or exists(select 1 from storage.objects where bucket_id = 'office-projektdokumente' and name like '%/a1000000-0000-4000-8000-0000000000a1/%') then
    raise exception 'Testdaten der Mustermappe sind nach dem Zurückrollen geblieben';
  end if;
end $test$;
