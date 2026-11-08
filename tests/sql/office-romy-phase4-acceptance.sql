-- Phase 4: fictitious two-person owner isolation, run only on ephemeral PostgreSQL.
-- All rows are rolled back; no production users, clients or accounts.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password)
VALUES
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-alpha@fixture.invalid',''),
('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-beta@fixture.invalid','')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.office_members(user_id,email,display_name,role,is_active,must_change_password)
VALUES
('11111111-1111-4111-8111-111111111111','phase4-alpha@fixture.invalid','Alex Beispiel','member',true,false),
('22222222-2222-4222-8222-222222222222','phase4-beta@fixture.invalid','Mara Muster','member',true,false)
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.isabella_memories(id,user_id,kind,subject,content,status,confidence,source,client_key)
VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','episodic','synthetic','Only fictional Alpha', 'active',0.8,'user','phase4-alpha'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','episodic','synthetic','Only fictional Beta', 'active',0.8,'user','phase4-beta');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $test$
DECLARE v_denied boolean:=false; v_result jsonb;
BEGIN
  IF (SELECT count(*) FROM public.isabella_memories WHERE status='active'
    AND client_key LIKE 'phase4-%')<>1
    THEN RAISE EXCEPTION 'cross-member memory disclosed'; END IF;
  BEGIN
    PERFORM public.office_romy_forget_private_memory('memory','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  EXCEPTION WHEN OTHERS THEN v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'member A could forget B memory'; END IF;
  v_result:=public.office_romy_forget_private_memory('memory','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  IF v_result->>'status'<>'forgotten' THEN RAISE EXCEPTION 'own memory retraction has no receipt'; END IF;
  IF EXISTS(SELECT 1 FROM public.isabella_memories WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND status='active')
    THEN RAISE EXCEPTION 'own memory remains active after confirmed forget'; END IF;
END $test$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.isabella_memories WHERE status='active'
    AND client_key LIKE 'phase4-%')<>1 THEN
    RAISE EXCEPTION 'member B should see only own memory'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.isabella_memories WHERE client_key='phase4-beta' AND status='active') THEN
    RAISE EXCEPTION 'forgetting A incorrectly touched member B'; END IF;
END $test$;
RESET ROLE;
ROLLBACK;
