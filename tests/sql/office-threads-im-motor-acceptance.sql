-- Abnahme · Threads auf dem Motor (Migration 20261128120000_office_threads_im_motor.sql), 28.11.2026.
-- Erfundene Personen und Projekte; alles in einer Transaktion, die am Ende zurückgerollt wird.
-- A = Mitglied mit Thread, C = anderes Mitglied. Geprüft: das Gespräch eines Threads liegt in conversations
-- (app_scope work_thread), gehört A, entsteht nur einmal, wird mit umbenannt; C kommt nicht heran; ein Thread
-- kann auf kein fremdes Gespräch zeigen; im Thread schreibt der Browser nur eigene Züge, keine Antworten.
begin;
insert into auth.users(id,aud,role,email,instance_id) values
 ('a1000000-0000-4000-8000-0000000000a1','authenticated','authenticated','th-a@example.invalid','00000000-0000-0000-0000-000000000000'),
 ('c1000000-0000-4000-8000-0000000000c1','authenticated','authenticated','th-c@example.invalid','00000000-0000-0000-0000-000000000000');
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password) values
 ('a1000000-0000-4000-8000-0000000000a1','th-a@example.invalid','TH Anna','projektleiter',true,false),
 ('c1000000-0000-4000-8000-0000000000c1','th-c@example.invalid','TH Carl','member',true,false);
insert into public.office_projects(id,number,name,status,projektleiter_id,created_by) values
 ('e1000000-0000-4000-8000-0000000000f1','TH-1','Threadtest','aktiv','a1000000-0000-4000-8000-0000000000a1','a1000000-0000-4000-8000-0000000000a1');
do $test$
declare
  r text := ''; n int; t text;
  th uuid; cid uuid; cid2 uuid; fremd uuid;
  erwartet constant text := 'A_gespraech=work_thread; A_anker=ok; A_einmal=ok; A_umbenannt=Neuer Titel; C_ensure=verweigert; '
    || 'C_fremdes_gespraech=verweigert; A_zug=ok; A_antwort=verweigert; ';
  a_id constant uuid := 'a1000000-0000-4000-8000-0000000000a1';
begin
  perform set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
  execute 'set local role authenticated';
  insert into public.minds_work_threads(project_id,title) values ('e1000000-0000-4000-8000-0000000000f1','Lichtplanung') returning id into th;
  cid := public.minds_ensure_work_thread_conversation(th);
  select app_scope into t from public.conversations where id = cid;
  r := r || 'A_gespraech=' || coalesce(t,'-') || '; ';
  select case when origin_anchor->>'type'='work_thread' and origin_anchor->>'id'=th::text and metadata->>'work_thread_id'=th::text
              then 'ok' else 'FEHLER' end into t from public.conversations where id = cid;
  r := r || 'A_anker=' || coalesce(t,'-') || '; ';
  cid2 := public.minds_ensure_work_thread_conversation(th);
  r := r || 'A_einmal=' || case when cid2 = cid then 'ok' else 'FEHLER' end || '; ';
  perform public.minds_rename_work_thread(th, 'Neuer Titel');
  select title into t from public.conversations where id = cid;
  r := r || 'A_umbenannt=' || coalesce(t,'-') || '; ';
  -- C kommt an das Gespräch von A nicht heran und kann keinen Thread auf ein fremdes Gespräch zeigen lassen.
  perform set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
  begin
    perform public.minds_ensure_work_thread_conversation(th);
    r := r || 'C_ensure=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_ensure=verweigert; ';
  end;
  begin
    insert into public.minds_work_threads(project_id,title,conversation_id) values ('e1000000-0000-4000-8000-0000000000f1','Fremd',cid) returning id into fremd;
    r := r || 'C_fremdes_gespraech=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'C_fremdes_gespraech=verweigert; ';
  end;
  -- A schreibt im Thread die eigene Frage; eine Antwort schreibt nur der Motor.
  perform set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
  begin
    insert into public.conversation_messages(user_id,conversation_id,client_key,role,content,provisional,citations)
      values (a_id,cid,'th-zug-1','user','Wie ist der Stand?',false,'[]'::jsonb);
    r := r || 'A_zug=ok; ';
  exception when others then r := r || 'A_zug=FEHLER(' || sqlerrm || '); ';
  end;
  begin
    insert into public.conversation_messages(user_id,conversation_id,client_key,role,content,provisional,citations)
      values (a_id,cid,'th-antwort-1','assistant','Gefälscht',false,'[]'::jsonb);
    r := r || 'A_antwort=ERLAUBT(FEHLER); ';
  exception when others then r := r || 'A_antwort=verweigert; ';
  end;
  execute 'reset role';
  if r <> erwartet then raise exception 'Threads auf dem Motor: erwartet «%», erhalten «%»', erwartet, r; end if;
  raise notice 'Threads auf dem Motor: %', r;
end $test$;
rollback;
