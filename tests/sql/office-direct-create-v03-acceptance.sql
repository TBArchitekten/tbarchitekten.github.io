-- Romy · «Rückgängig statt Bestätigen» (v03, 13.11.2026). Erfundene Personen, nur auf einer
-- flüchtigen PostgreSQL-Instanz, alles wird zurückgerollt. Kein echtes Projekt, kein echter Kunde.
--
-- Geprüft wird, was sich am 13.11. geändert hat und was gerade NICHT nachgeben darf:
--  * die Bitte muss aus dem Zug des Mitglieds stammen, beliebig formuliert;
--  * Titel, Tag und Uhrzeit dürfen aus einem Anhang oder aus Romys Lesart kommen;
--  * eine Überschneidung blockiert nicht mehr, und die Nur-Lese-Hilfsfunktion nennt sie;
--  * sofort anlegen ist der Normalfall, «review» schaltet es weiter ab;
--  * Ändern/Löschen, Serien- und Ganztagstermine, fremder Text und fremde Züge bleiben gesperrt;
--  * Rückgängig nur innerhalb von 10 Minuten und nur solange der Eintrag unverändert ist.
begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values
('a1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','v03-a@fixture.invalid','',now(),now()),
('a2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','v03-b@fixture.invalid','',now(),now())
on conflict(id) do nothing;
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password)
values
('a1111111-1111-4111-8111-111111111111','v03-a@fixture.invalid','Mara Muster','member',true,false),
('a2222222-2222-4222-8222-222222222222','v03-b@fixture.invalid','Jonas Beispiel','member',true,false)
on conflict(user_id) do nothing;
insert into public.conversations(id,user_id,app_scope,origin_kind,title)
values ('ac000000-0000-4000-8000-000000000001','a1111111-1111-4111-8111-111111111111','isabella','global','Fixture');

-- Die eigenen Züge des Mitglieds. Der Screenshot-Fall: die Bitte ist kurz, die Daten stehen im Anhang.
insert into public.conversation_messages(user_id,conversation_id,role,content,client_key,provenance_class,exposure_scope_version,metadata)
values
('a1111111-1111-4111-8111-111111111111','ac000000-0000-4000-8000-000000000001','user','Trag diesen Termin ein!','c0000000-0000-4000-8000-000000000001','owner',1,'{}'),
('a1111111-1111-4111-8111-111111111111','ac000000-0000-4000-8000-000000000001','user','Ja','c0000000-0000-4000-8000-000000000002','owner',1,'{}'),
('a1111111-1111-4111-8111-111111111111','ac000000-0000-4000-8000-000000000001','user','Und was steht am Freitag an?','c0000000-0000-4000-8000-000000000003','owner',1,'{}');

create or replace function pg_temp.decide(
  p_request uuid,p_action text,p_candidate jsonb,p_context jsonb
) returns void language plpgsql security definer as $helper$
begin
  perform public.minds_admit_shadow_decision(
    'a1111111-1111-4111-8111-111111111111',p_request,p_action,p_candidate,
    '{"policy_mode":"confirm"}'::jsonb||p_context);
  update public.minds_shadow_decisions
     set policy_mode='confirm',context=context||p_context
   where request_id=p_request;
end $helper$;

-- Der Zug, den Romy führt: Bitte aus turn-0001, Daten aus dem Screenshot.
create or replace function pg_temp.ctx(p_extra jsonb default '{}'::jsonb) returns jsonb language sql as $c$
  select jsonb_build_object(
    'direct_calendar_authority','owner_request_v2',
    'direct_authorization_excerpt','Trag diesen Termin ein',
    'direct_authorization_turn_id','c0000000-0000-4000-8000-000000000001',
    'direct_owner_source_tainted',false,
    'background',false,
    'direct_request',true,
    'direct_timezone','Europe/Berlin')||p_extra;
$c$;
create or replace function pg_temp.event(p_request uuid,p_extra jsonb default '{}'::jsonb) returns jsonb language sql as $e$
  select jsonb_build_object('request_id',p_request::text,'kind','event','action','create',
    'title','Bemusterung Pendelleuchten','date','2026-11-19','time','14:00','duration_minutes',60)||p_extra;
$e$;

set local role authenticated;
select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);

-- 1. Was früher eine Karte brauchte: kurze Bitte, Titel und Uhrzeit aus dem Anhang gelesen.
do $screenshot$
declare r jsonb; v_id uuid;
begin
  perform pg_temp.decide('b0000000-0000-4000-8000-000000000001','create_event',
    pg_temp.event('b0000000-0000-4000-8000-000000000001'),pg_temp.ctx());
  r:=public.minds_commit_direct_calendar_create_v01('b0000000-0000-4000-8000-000000000001',
    pg_temp.event('b0000000-0000-4000-8000-000000000001'));
  if r->>'status'<>'applied' then raise exception 'screenshot case was not created: %',r; end if;
  v_id:=(r->>'entity_id')::uuid;
  if not exists(select 1 from public.isabella_events e where e.id=v_id
    and e.title='Bemusterung Pendelleuchten' and not e.all_day
    and e.starts_at=('2026-11-19 14:00'::timestamp at time zone 'Europe/Berlin')
    and e.ends_at=('2026-11-19 15:00'::timestamp at time zone 'Europe/Berlin'))
  then raise exception 'event stored with wrong time'; end if;
  if (select status from public.minds_shadow_decisions where request_id='b0000000-0000-4000-8000-000000000001')<>'accepted'
  then raise exception 'decision not accepted'; end if;
  if (select count(*) from public.minds_calendar_action_receipts where request_id='b0000000-0000-4000-8000-000000000001')<>1
  then raise exception 'receipt missing'; end if;
  -- Zweimal gesendet bleibt ein Termin.
  r:=public.minds_commit_direct_calendar_create_v01('b0000000-0000-4000-8000-000000000001',
    pg_temp.event('b0000000-0000-4000-8000-000000000001'));
  if r->>'status'<>'already_applied' then raise exception 'replay created a second event'; end if;
end $screenshot$;

-- 2. Die Überschneidung blockiert nicht mehr, und die Hilfsfunktion nennt sie vorher.
do $overlap$
declare r jsonb; v_overlaps jsonb;
begin
  v_overlaps:=public.minds_direct_event_overlap_v01('2026-11-19','14:30',60,'Europe/Berlin');
  if jsonb_array_length(v_overlaps)<>1 or v_overlaps->0->>'title'<>'Bemusterung Pendelleuchten'
     or v_overlaps->0->>'local_start'<>'14:00'
  then raise exception 'overlap helper did not report the clash: %',v_overlaps; end if;
  if jsonb_array_length(public.minds_direct_event_overlap_v01('2026-11-19','16:00',60,'Europe/Berlin'))<>0
  then raise exception 'overlap helper reported a clash where there is none'; end if;
  if jsonb_array_length(public.minds_direct_event_overlap_v01('2026-11-19','14:30',60,'Mars/Olympus'))<>0
  then raise exception 'overlap helper accepted an unknown timezone'; end if;
  perform pg_temp.decide('b0000000-0000-4000-8000-000000000002','create_event',
    pg_temp.event('b0000000-0000-4000-8000-000000000002','{"title":"Abstimmung Fassade","time":"14:30"}'::jsonb),pg_temp.ctx());
  r:=public.minds_commit_direct_calendar_create_v01('b0000000-0000-4000-8000-000000000002',
    pg_temp.event('b0000000-0000-4000-8000-000000000002','{"title":"Abstimmung Fassade","time":"14:30"}'::jsonb));
  if r->>'status'<>'applied' then raise exception 'overlapping event was refused: %',r; end if;
end $overlap$;

-- 3. Ein «Ja» auf Romys eigenen Vorschlag ist eine Bitte; ein Satz, den niemand geschrieben hat, nicht.
do $wording$
declare r jsonb; v_failed boolean;
begin
  perform pg_temp.decide('b0000000-0000-4000-8000-000000000003','create_task',
    jsonb_build_object('request_id','b0000000-0000-4000-8000-000000000003','kind','task','action','create','title','Jonas anrufen'),
    pg_temp.ctx('{"direct_authorization_excerpt":"ja!","direct_authorization_turn_id":"c0000000-0000-4000-8000-000000000002"}'::jsonb));
  r:=public.minds_commit_direct_calendar_create_v01('b0000000-0000-4000-8000-000000000003',
    jsonb_build_object('request_id','b0000000-0000-4000-8000-000000000003','kind','task','action','create','title','Jonas anrufen'));
  if r->>'status'<>'applied' then raise exception '«Ja» was not accepted as a request: %',r; end if;

  v_failed:=false;
  begin
    perform pg_temp.decide('b0000000-0000-4000-8000-000000000004','create_task',
      jsonb_build_object('request_id','b0000000-0000-4000-8000-000000000004','kind','task','action','create','title','Erfunden'),
      pg_temp.ctx('{"direct_authorization_excerpt":"Leg bitte eine Aufgabe an"}'::jsonb));
    perform public.minds_commit_direct_calendar_create_v01('b0000000-0000-4000-8000-000000000004',
      jsonb_build_object('request_id','b0000000-0000-4000-8000-000000000004','kind','task','action','create','title','Erfunden'));
  exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'a request nobody wrote was accepted'; end if;

  -- Ein anderer Zug desselben Mitglieds autorisiert nicht: die Bitte muss im genannten Zug stehen.
  v_failed:=false;
  begin
    perform pg_temp.decide('b0000000-0000-4000-8000-000000000005','create_task',
      jsonb_build_object('request_id','b0000000-0000-4000-8000-000000000005','kind','task','action','create','title','Fremder Zug'),
      pg_temp.ctx('{"direct_authorization_excerpt":"Und was steht am Freitag an","direct_authorization_turn_id":"c0000000-0000-4000-8000-000000000001"}'::jsonb));
    perform public.minds_commit_direct_calendar_create_v01('b0000000-0000-4000-8000-000000000005',
      jsonb_build_object('request_id','b0000000-0000-4000-8000-000000000005','kind','task','action','create','title','Fremder Zug'));
  exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'a quote from another turn authorized a creation'; end if;
end $wording$;

-- 4. Was gesperrt bleibt.
do $limits$
declare v_failed boolean; i integer; v_action text; v_candidate jsonb; v_context jsonb;
begin
  for i,v_action,v_candidate,v_context in
    select * from (values
      (1,'create_event','{"kind":"event","action":"create","title":"Serie","date":"2026-11-20","time":"09:00","duration_minutes":60,"recurrence":{"frequency":"weekly"}}'::jsonb,'{}'::jsonb),
      (2,'create_event','{"kind":"event","action":"create","title":"Ganztag","date":"2026-11-20","all_day":true}'::jsonb,'{}'::jsonb),
      (3,'update_event','{"kind":"event","action":"update","title":"Verschieben","target_id":"x","date":"2026-11-20","time":"09:00","duration_minutes":60}'::jsonb,'{}'::jsonb),
      (4,'create_event','{"kind":"event","action":"create","title":"Aus dem Netz","date":"2026-11-20","time":"09:00","duration_minutes":60}'::jsonb,'{"direct_owner_source_tainted":true}'::jsonb),
      (5,'create_event','{"kind":"event","action":"create","title":"Nachts","date":"2026-11-20","time":"09:00","duration_minutes":60}'::jsonb,'{"background":true}'::jsonb),
      (6,'create_event','{"kind":"event","action":"create","title":"Zu lang","date":"2026-11-20","time":"09:00","duration_minutes":900}'::jsonb,'{}'::jsonb),
      (7,'create_event','{"kind":"event","action":"create","title":"Ohne Zeitzone","date":"2026-11-20","time":"09:00","duration_minutes":60}'::jsonb,'{"direct_timezone":""}'::jsonb),
      (8,'create_event','{"kind":"event","action":"create","title":"","date":"2026-11-20","time":"09:00","duration_minutes":60}'::jsonb,'{}'::jsonb)
    ) as t(i,v_action,v_candidate,v_context)
  loop
    v_failed:=false;
    begin
      perform pg_temp.decide(('b1000000-0000-4000-8000-00000000000'||i)::uuid,v_action,
        v_candidate||jsonb_build_object('request_id','b1000000-0000-4000-8000-00000000000'||i),pg_temp.ctx(v_context));
      perform public.minds_commit_direct_calendar_create_v01(('b1000000-0000-4000-8000-00000000000'||i)::uuid,
        v_candidate||jsonb_build_object('request_id','b1000000-0000-4000-8000-00000000000'||i));
    exception when others then v_failed:=true; end;
    if not v_failed then raise exception 'case % was created without review',i; end if;
  end loop;
end $limits$;

-- 5. Rückgängig: innerhalb von 10 Minuten, nur solange der Eintrag unverändert ist.
do $undo$
declare r jsonb; v_receipt uuid; v_failed boolean;
begin
  select id into v_receipt from public.minds_calendar_action_receipts
   where request_id='b0000000-0000-4000-8000-000000000001';
  r:=public.minds_undo_direct_calendar_create_v01('b0000000-0000-4000-8000-000000000001'::uuid,v_receipt);
  if r->>'status'<>'undone' then raise exception 'undo did not work: %',r; end if;
  if exists(select 1 from public.isabella_events where client_key='direct:b0000000-0000-4000-8000-000000000001')
  then raise exception 'event still there after undo'; end if;

  -- Nach 10 Minuten nicht mehr. Die Uhr stellt der Beleg; das Browserkonto darf ihn nicht anfassen
  -- (deshalb hier kurz ohne Rolle, wie es sonst nur der Motor könnte).
  reset role;
  update public.minds_calendar_action_receipts set created_at=now()-interval '11 minutes'
   where request_id='b0000000-0000-4000-8000-000000000002';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
  select id into v_receipt from public.minds_calendar_action_receipts
   where request_id='b0000000-0000-4000-8000-000000000002';
  v_failed:=false;
  begin perform public.minds_undo_direct_calendar_create_v01('b0000000-0000-4000-8000-000000000002'::uuid,v_receipt);
  exception when others then v_failed:=true; end;
  if not v_failed and (select count(*) from public.isabella_events where client_key='direct:b0000000-0000-4000-8000-000000000002')=0
  then raise exception 'undo worked after the window closed'; end if;
end $undo$;

-- 6. Wer ausdrücklich «review» gewählt hat, bekommt weiter eine Karte.
do $review$
declare v_failed boolean:=false;
begin
  reset role;
  update public.minds_calendar_execution_preferences set create_mode='review'
   where user_id='a1111111-1111-4111-8111-111111111111';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
  begin
    perform pg_temp.decide('b2000000-0000-4000-8000-000000000001','create_task',
      jsonb_build_object('request_id','b2000000-0000-4000-8000-000000000001','kind','task','action','create','title','Mit Karte'),
      pg_temp.ctx());
    perform public.minds_commit_direct_calendar_create_v01('b2000000-0000-4000-8000-000000000001',
      jsonb_build_object('request_id','b2000000-0000-4000-8000-000000000001','kind','task','action','create','title','Mit Karte'));
  exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'explicit review preference was ignored'; end if;
end $review$;

-- 7. Niemand legt im Namen eines anderen an.
select set_config('request.jwt.claim.sub','a2222222-2222-4222-8222-222222222222',true);
do $other$
declare v_failed boolean:=false;
begin
  begin perform public.minds_commit_direct_calendar_create_v01('b0000000-0000-4000-8000-000000000003',
    jsonb_build_object('request_id','b0000000-0000-4000-8000-000000000003','kind','task','action','create','title','Jonas anrufen'));
  exception when others then v_failed:=true; end;
  if not v_failed then raise exception 'another member committed a stranger decision'; end if;
  if jsonb_array_length(public.minds_direct_event_overlap_v01('2026-11-19','14:30',60,'Europe/Berlin'))<>0
  then raise exception 'overlap helper leaked another member calendar'; end if;
end $other$;

reset role;
rollback;
