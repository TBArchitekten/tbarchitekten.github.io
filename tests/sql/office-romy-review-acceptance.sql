-- Review 08.11.2026: owner writes for the shared engine and the app-notice path.
-- Fictitious members, ephemeral PostgreSQL only; everything is rolled back.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password)
VALUES
('31111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','review-alpha@fixture.invalid',''),
('32222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','review-beta@fixture.invalid',''),
('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','review-outsider@fixture.invalid','')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.office_members(user_id,email,display_name,role,is_active,must_change_password)
VALUES
('31111111-1111-4111-8111-111111111111','review-alpha@fixture.invalid','Alex Beispiel','member',true,false),
('32222222-2222-4222-8222-222222222222','review-beta@fixture.invalid','Mara Muster','member',true,false)
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.conversations(id,user_id,app_scope,origin_kind,title)
VALUES ('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','31111111-1111-4111-8111-111111111111','isabella','global','Fixture');
INSERT INTO public.isabella_return_queue(id,user_id,kind,title,reason,status)
VALUES ('3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','32222222-2222-4222-8222-222222222222','conversation_thread','Beta','fixture','ready');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','31111111-1111-4111-8111-111111111111',true);
DO $test$
DECLARE v_denied boolean; v_rows int;
BEGIN
  -- The engine writes the member's own rows with the member's JWT.
  INSERT INTO public.isabella_return_queue(user_id,kind,title,reason,status)
  VALUES ('31111111-1111-4111-8111-111111111111','conversation_thread','Alpha','fixture','ready');
  -- Never someone else's.
  v_denied:=false;
  BEGIN
    INSERT INTO public.isabella_return_queue(user_id,kind,title,reason,status)
    VALUES ('32222222-2222-4222-8222-222222222222','conversation_thread','Forged','fixture','ready');
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'member A wrote a row for member B'; END IF;
  UPDATE public.isabella_return_queue SET status='dismissed' WHERE id='3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows<>0 THEN RAISE EXCEPTION 'member A changed member B row'; END IF;
  -- Assistant rows stay closed to browsers; the notice function is the one narrow path.
  v_denied:=false;
  BEGIN
    INSERT INTO public.conversation_messages(user_id,conversation_id,role,content,client_key,metadata)
    VALUES ('31111111-1111-4111-8111-111111111111','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','assistant','Forged','forged-0001','{}');
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'browser wrote an assistant row'; END IF;
  PERFORM public.office_romy_append_notice('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','notice-0001','Gespeichert.');
  PERFORM public.office_romy_append_notice('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','notice-0001','Gespeichert.');
  IF (SELECT count(*) FROM public.conversation_messages WHERE client_key='notice:notice-0001'
      AND role='assistant' AND metadata->>'author'='system' AND provenance_class='system'
      AND exposure_scope_version=1)<>1
    THEN RAISE EXCEPTION 'notice missing, duplicated or not marked as system'; END IF;
  -- The owner may annotate their own turn (clarification receipt), never an assistant or app row.
  INSERT INTO public.conversation_messages(user_id,conversation_id,role,content,client_key,metadata,provenance_class)
  VALUES ('31111111-1111-4111-8111-111111111111','3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','user','Frage','turn-0001','{}','owner');
  UPDATE public.conversation_messages SET metadata='{"pending_clarification":{"id":"x"}}' WHERE client_key='turn-0001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows<>1 THEN RAISE EXCEPTION 'owner cannot annotate own turn'; END IF;
  UPDATE public.conversation_messages SET metadata='{"author":"owner"}' WHERE client_key='notice:notice-0001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows<>0 THEN RAISE EXCEPTION 'owner rewrote an app notice'; END IF;
  v_denied:=false;
  BEGIN UPDATE public.conversation_messages SET role='assistant' WHERE client_key='turn-0001';
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'owner turned own message into Romy'; END IF;
  v_denied:=false;
  BEGIN UPDATE public.conversation_messages SET metadata='{"author":"system"}' WHERE client_key='turn-0001';
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'owner disguised own turn as an app notice'; END IF;
  v_denied:=false;
  BEGIN PERFORM public.office_romy_append_notice('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','notice-0002','');
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'empty notice accepted'; END IF;
END $test$;

SELECT set_config('request.jwt.claim.sub','32222222-2222-4222-8222-222222222222',true);
DO $test$
DECLARE v_denied boolean:=false;
BEGIN
  BEGIN PERFORM public.office_romy_append_notice('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','notice-0003','Fremd.');
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'member B wrote into member A conversation'; END IF;
END $test$;

SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
DO $test$
DECLARE v_denied boolean:=false;
BEGIN
  BEGIN
    INSERT INTO public.isabella_return_queue(user_id,kind,title,reason,status)
    VALUES ('33333333-3333-4333-8333-333333333333','conversation_thread','Outsider','fixture','ready');
  EXCEPTION WHEN OTHERS THEN v_denied:=true; END;
  IF NOT v_denied THEN RAISE EXCEPTION 'non-member wrote engine rows'; END IF;
END $test$;
RESET ROLE;
ROLLBACK;
