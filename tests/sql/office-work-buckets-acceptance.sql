-- Abnahme · Buckets entfernen, wiederherstellen, ordnen (Migration 20261123100000_office_work_buckets_v1.sql).
-- Erfundene Personen und Projekte; alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
-- A = Projektleitung von P, B = Team von P, C = Mitglied ohne Bezug zu P, D = kein Office-Mitglied.
-- Erwartet:
-- C_entfernen=verweigert; C_ordnen=verweigert; B_entfernt=2; offen_ohne_bucket=2; erledigt_am_bucket=1; bucket_archiviert=true;
-- nichts_geloescht=4; B_ordnet=2; reihenfolge=Z,X; A_stellt_her=true; hinten=true; D=verweigert; anon=verweigert;
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a3000000-0000-4000-8000-00000000000a','authenticated','authenticated','wb-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b3000000-0000-4000-8000-00000000000b','authenticated','authenticated','wb-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('c3000000-0000-4000-8000-00000000000c','authenticated','authenticated','wb-c@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('d3000000-0000-4000-8000-00000000000d','authenticated','authenticated','wb-d@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a3000000-0000-4000-8000-00000000000a','wb-a@example.invalid','WB Leitung','projektleiter',true,false),
 ('b3000000-0000-4000-8000-00000000000b','wb-b@example.invalid','WB Team','member',true,false),
 ('c3000000-0000-4000-8000-00000000000c','wb-c@example.invalid','WB Fremd','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e3000000-0000-4000-8000-0000000000e1','WB-1','Bucket-Test P','aktiv','a3000000-0000-4000-8000-00000000000a','a3000000-0000-4000-8000-00000000000a');
insert into public.office_project_members(project_id,user_id,added_by) values
 ('e3000000-0000-4000-8000-0000000000e1','b3000000-0000-4000-8000-00000000000b','a3000000-0000-4000-8000-00000000000a');
-- Drei Buckets von A; im Bucket Y zwei offene Aufgaben (eine von A, eine von B) und eine erledigte.
insert into public.minds_work_buckets(id,user_id,project_id,name,sort_order) values
 ('f3000000-0000-4000-8000-0000000000a1','a3000000-0000-4000-8000-00000000000a','e3000000-0000-4000-8000-0000000000e1','X',0),
 ('f3000000-0000-4000-8000-0000000000a2','a3000000-0000-4000-8000-00000000000a','e3000000-0000-4000-8000-0000000000e1','Y',10),
 ('f3000000-0000-4000-8000-0000000000a3','a3000000-0000-4000-8000-00000000000a','e3000000-0000-4000-8000-0000000000e1','Z',20);
insert into public.isabella_tasks(id,user_id,title,project_id,work_bucket_id,completed_at) values
 ('f3000000-0000-4000-8000-0000000000b1','a3000000-0000-4000-8000-00000000000a','Offen A','e3000000-0000-4000-8000-0000000000e1','f3000000-0000-4000-8000-0000000000a2',null),
 ('f3000000-0000-4000-8000-0000000000b2','b3000000-0000-4000-8000-00000000000b','Offen B','e3000000-0000-4000-8000-0000000000e1','f3000000-0000-4000-8000-0000000000a2',null),
 ('f3000000-0000-4000-8000-0000000000b3','a3000000-0000-4000-8000-00000000000a','Erledigt','e3000000-0000-4000-8000-0000000000e1','f3000000-0000-4000-8000-0000000000a2',now()),
 ('f3000000-0000-4000-8000-0000000000b4','a3000000-0000-4000-8000-00000000000a','Anderer Bucket','e3000000-0000-4000-8000-0000000000e1','f3000000-0000-4000-8000-0000000000a1',null);
do $test$
declare
  r text := ''; n int; ok boolean; s text;
  erwartet constant text := 'C_entfernen=verweigert; C_ordnen=verweigert; B_entfernt=2; offen_ohne_bucket=2; erledigt_am_bucket=1; bucket_archiviert=true; '
    || 'nichts_geloescht=4; B_ordnet=2; reihenfolge=Z,X; A_stellt_her=true; hinten=true; D=verweigert; anon=verweigert; ';
  p constant uuid := 'e3000000-0000-4000-8000-0000000000e1';
  x constant uuid := 'f3000000-0000-4000-8000-0000000000a1';
  y constant uuid := 'f3000000-0000-4000-8000-0000000000a2';
  z constant uuid := 'f3000000-0000-4000-8000-0000000000a3';
begin
  -- C (Mitglied ohne Bezug zu P) sieht den Planner, darf aber nichts entfernen oder ordnen.
  perform set_config('request.jwt.claims', '{"sub":"c3000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin perform public.minds_work_bucket_archive(p,y); r := r || 'C_entfernen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_entfernen=verweigert; '; end;
  begin perform public.minds_work_bucket_reorder(p,array[z,y,x]); r := r || 'C_ordnen=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_ordnen=verweigert; '; end;
  execute 'reset role';
  -- B (Team) entfernt den Bucket Y, den A angelegt hat: beide offenen Aufgaben wandern nach «Ohne Bucket».
  perform set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select public.minds_work_bucket_archive(p,y) into n; r := r || 'B_entfernt=' || n || '; ';
  execute 'reset role';
  select count(*) into n from public.isabella_tasks where id in ('f3000000-0000-4000-8000-0000000000b1','f3000000-0000-4000-8000-0000000000b2') and work_bucket_id is null;
  r := r || 'offen_ohne_bucket=' || n || '; ';
  select count(*) into n from public.isabella_tasks where id='f3000000-0000-4000-8000-0000000000b3' and work_bucket_id=y;
  r := r || 'erledigt_am_bucket=' || n || '; ';
  select archived into ok from public.minds_work_buckets where id=y; r := r || 'bucket_archiviert=' || ok || '; ';
  select count(*) into n from public.isabella_tasks where project_id=p; r := r || 'nichts_geloescht=' || n || '; ';
  -- B ordnet die verbliebenen Buckets neu.
  perform set_config('request.jwt.claims', '{"sub":"b3000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select public.minds_work_bucket_reorder(p,array[z,x]) into n; r := r || 'B_ordnet=' || n || '; ';
  execute 'reset role';
  select string_agg(name, ',' order by sort_order) into s from public.minds_work_buckets where project_id=p and archived=false;
  r := r || 'reihenfolge=' || s || '; ';
  -- A (Projektleitung) stellt Y wieder her; er kommt ans Ende.
  perform set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select public.minds_work_bucket_restore(p,y) into ok; r := r || 'A_stellt_her=' || ok || '; ';
  execute 'reset role';
  select (select sort_order from public.minds_work_buckets where id=y) > (select max(sort_order) from public.minds_work_buckets where project_id=p and id<>y and archived=false) into ok;
  r := r || 'hinten=' || ok || '; ';
  -- D (kein Office-Mitglied) und anon: nichts.
  perform set_config('request.jwt.claims', '{"sub":"d3000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
  execute 'set local role authenticated';
  begin perform public.minds_work_bucket_archive(p,x); r := r || 'D=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'D=verweigert; '; end;
  execute 'reset role';
  execute 'set local role anon';
  begin perform public.minds_work_bucket_archive(p,x); r := r || 'anon=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon=verweigert; '; end;
  execute 'reset role';
  if r <> erwartet then raise exception 'Buckets weichen ab: % (erwartet: %)', r, erwartet; end if;
  raise notice 'Buckets: %', r;
end
$test$;
rollback;
do $$ begin
  if exists(select 1 from public.office_projects where id='e3000000-0000-4000-8000-0000000000e1') then
    raise exception 'Testdaten der Buckets sind nach dem Zurückrollen geblieben';
  end if;
end $$;
