-- Abnahme RLS · Kostenberechnung v1 (Migration 20261121100000_office_kostenberechnung_v1.sql), 21.11.2026.
-- Erfundene Personen und Projekte; alles läuft in einer Transaktion, die am Ende zurückgerollt wird.
-- Läuft im CI auf der frisch migrierten Datenbank (verify.yml) und lässt sich ebenso gegen jede Datenbank
-- mit der Migration ausführen: gezählt wird nur, was diese Datei selbst anlegt.
-- A = Projektleitung von P, B = Team von P (und Q), C = Mitglied ohne Bezug zu P, D = kein Office-Mitglied.
-- Erwartet:
-- B_insert=ok; B_templates=1; B_version=ok; B_move=verweigert; C_sieht=0; C_update=0; C_delete=0; C_versions=0;
-- C_insertP=verweigert; C_version=verweigert; A_sieht=1; A_update_rev=2; A_alte_revision=0; D_templates=0; D_sieht=0;
-- anon=verweigert; B_delete=1;
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a0000000-0000-4000-8000-00000000000a','authenticated','authenticated','kt-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('b0000000-0000-4000-8000-00000000000b','authenticated','authenticated','kt-b@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('c0000000-0000-4000-8000-00000000000c','authenticated','authenticated','kt-c@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('d0000000-0000-4000-8000-00000000000d','authenticated','authenticated','kt-d@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a0000000-0000-4000-8000-00000000000a','kt-a@example.invalid','KT Leitung','projektleiter',true,false),
 ('b0000000-0000-4000-8000-00000000000b','kt-b@example.invalid','KT Team','member',true,false),
 ('c0000000-0000-4000-8000-00000000000c','kt-c@example.invalid','KT Fremd','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e0000000-0000-4000-8000-0000000000e1','KT-1','Kostentest P','aktiv','a0000000-0000-4000-8000-00000000000a','a0000000-0000-4000-8000-00000000000a'),
 ('e0000000-0000-4000-8000-0000000000e2','KT-2','Kostentest Q','aktiv','c0000000-0000-4000-8000-00000000000c','c0000000-0000-4000-8000-00000000000c');
insert into public.office_project_members(project_id,user_id,added_by) values
 ('e0000000-0000-4000-8000-0000000000e1','b0000000-0000-4000-8000-00000000000b','a0000000-0000-4000-8000-00000000000a'),
 ('e0000000-0000-4000-8000-0000000000e2','b0000000-0000-4000-8000-00000000000b','c0000000-0000-4000-8000-00000000000c');
insert into public.office_kosten_templates(id,title,version,state) values
 ('f0000000-0000-4000-8000-0000000000f1','Test-Muster','0.0','{"schema":"test"}');
do $test$
declare
  r text := ''; n int; rev bigint; iid uuid;
  erwartet constant text := 'B_insert=ok; B_templates=1; B_version=ok; B_move=verweigert; C_sieht=0; C_update=0; C_delete=0; C_versions=0; '
    || 'C_insertP=verweigert; C_version=verweigert; A_sieht=1; A_update_rev=2; A_alte_revision=0; D_templates=0; D_sieht=0; '
    || 'anon=verweigert; B_delete=1; ';
  p_projekt constant uuid := 'e0000000-0000-4000-8000-0000000000e1';
  q_projekt constant uuid := 'e0000000-0000-4000-8000-0000000000e2';
  t_muster constant uuid := 'f0000000-0000-4000-8000-0000000000f1';
begin
  -- B (Team von P) legt an, sieht das Muster, hält einen Stand fest; Projekt wechseln geht nicht.
  perform set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  insert into public.office_kosten_instances(project_id,template_id,template_version,project_number,project_name,owner_id,state)
   values (p_projekt,t_muster,'0.0','KT-1','Kostentest P','b0000000-0000-4000-8000-00000000000b','{"v":1}') returning id into iid;
  r := r || 'B_insert=ok; ';
  select count(*) into n from public.office_kosten_templates where id=t_muster; r := r || 'B_templates=' || n || '; ';
  insert into public.office_kosten_versions(instance_id,label,state,server_revision,created_by) values (iid,'Stand','{"v":1}',1,'b0000000-0000-4000-8000-00000000000b');
  r := r || 'B_version=ok; ';
  begin
    update public.office_kosten_instances set project_id=q_projekt where id=iid;
    r := r || 'B_move=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'B_move=verweigert; ';
  end;
  execute 'reset role';
  -- C (Mitglied, nicht im Team von P): sieht nichts, ändert nichts, legt nichts in P an.
  perform set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_kosten_instances where project_id in (p_projekt,q_projekt); r := r || 'C_sieht=' || n || '; ';
  update public.office_kosten_instances set state='{"v":99}' where id=iid; get diagnostics n = row_count; r := r || 'C_update=' || n || '; ';
  delete from public.office_kosten_instances where id=iid; get diagnostics n = row_count; r := r || 'C_delete=' || n || '; ';
  select count(*) into n from public.office_kosten_versions where instance_id=iid; r := r || 'C_versions=' || n || '; ';
  begin
    insert into public.office_kosten_instances(project_id,template_version,project_number,project_name,owner_id,state)
     values (p_projekt,'0.0','KT-1','Kostentest P','c0000000-0000-4000-8000-00000000000c','{}');
    r := r || 'C_insertP=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_insertP=verweigert; ';
  end;
  begin
    insert into public.office_kosten_versions(instance_id,label,state,server_revision,created_by) values (iid,'X','{}',1,'c0000000-0000-4000-8000-00000000000c');
    r := r || 'C_version=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_version=verweigert; ';
  end;
  execute 'reset role';
  -- A (Projektleitung von P): sieht und schreibt; gespeichert wird nur auf die erwartete Revision.
  perform set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_kosten_instances where project_id in (p_projekt,q_projekt); r := r || 'A_sieht=' || n || '; ';
  update public.office_kosten_instances set state='{"v":2}' where id=iid and server_revision=1 returning server_revision into rev;
  r := r || 'A_update_rev=' || coalesce(rev::text,'null') || '; ';
  update public.office_kosten_instances set state='{"v":3}' where id=iid and server_revision=1; get diagnostics n = row_count;
  r := r || 'A_alte_revision=' || n || '; ';
  execute 'reset role';
  -- D (kein Office-Mitglied) sieht weder Muster noch Kostenberechnungen.
  perform set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
  execute 'set local role authenticated';
  select count(*) into n from public.office_kosten_templates where id=t_muster; r := r || 'D_templates=' || n || '; ';
  select count(*) into n from public.office_kosten_instances where project_id in (p_projekt,q_projekt); r := r || 'D_sieht=' || n || '; ';
  execute 'reset role';
  -- anon hat keinen Zugriff.
  execute 'set local role anon';
  begin
    select count(*) into n from public.office_kosten_instances; r := r || 'anon=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'anon=verweigert; ';
  end;
  execute 'reset role';
  -- B löscht als Ersteller.
  perform set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
  execute 'set local role authenticated';
  delete from public.office_kosten_instances where id=iid; get diagnostics n = row_count; r := r || 'B_delete=' || n || '; ';
  execute 'reset role';
  if r <> erwartet then
    raise exception 'RLS Kostenberechnung weicht ab. Erwartet: % Erhalten: %', erwartet, r;
  end if;
  raise notice 'RLS Kostenberechnung: %', r;
end $test$;
rollback;
-- Nichts davon darf bleiben.
do $test$ begin
  if exists(select 1 from public.office_kosten_templates where id='f0000000-0000-4000-8000-0000000000f1')
     or exists(select 1 from public.office_projects where id in ('e0000000-0000-4000-8000-0000000000e1','e0000000-0000-4000-8000-0000000000e2')) then
    raise exception 'Testdaten der Kostenberechnung sind nach dem Zurückrollen geblieben';
  end if;
end $test$;
