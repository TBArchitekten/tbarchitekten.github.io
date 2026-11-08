-- Phase 5 acceptance: synthetic projects, team RLS, one daily service claim.
-- Ephemeral SQL only; transaction always rolled back.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password)
VALUES
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','akte-alpha@fixture.invalid',''),
('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','akte-beta@fixture.invalid',''),
('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','akte-third@fixture.invalid','')
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.office_members(user_id,email,display_name,role,is_active,must_change_password)
VALUES
('11111111-1111-4111-8111-111111111111','akte-alpha@fixture.invalid','Alex Beispiel','member',true,false),
('22222222-2222-4222-8222-222222222222','akte-beta@fixture.invalid','Mara Muster','member',true,false),
('33333333-3333-4333-8333-333333333333','akte-third@fixture.invalid','Lena Fixture','admin',true,false)
ON CONFLICT(user_id) DO NOTHING;
INSERT INTO public.office_projects(id,number,name,created_by,status)
VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','AKTE-A','Projekt P','11111111-1111-4111-8111-111111111111','aktiv'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','AKTE-B','Projekt Q','22222222-2222-4222-8222-222222222222','aktiv')
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.office_project_members(project_id,user_id,added_by)
VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222')
ON CONFLICT DO NOTHING;
DO $system$
BEGIN
  IF NOT public.office_romy_claim_akte_project('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
    RAISE EXCEPTION 'first project lease failed'; END IF;
  IF public.office_romy_claim_akte_project('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
    RAISE EXCEPTION 'duplicate project lease permitted'; END IF;
  IF NOT public.office_romy_claim_akte_project('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') THEN
    RAISE EXCEPTION 'second project should have its own lease'; END IF;
END $system$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.office_romy_akte_maintenance_state)<>1
    THEN RAISE EXCEPTION 'member P can see project Q maintenance state'; END IF;
  IF has_function_privilege('authenticated','public.office_romy_claim_akte_project(uuid)','EXECUTE')
    THEN RAISE EXCEPTION 'browser can claim project maintenance'; END IF;
END $test$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.office_romy_akte_maintenance_state)<>1
    THEN RAISE EXCEPTION 'member Q can see project P maintenance state'; END IF;
END $test$;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.office_romy_akte_maintenance_state)<>0
    THEN RAISE EXCEPTION 'unassigned admin has implicit Akte access'; END IF;
END $test$;
RESET ROLE;
ROLLBACK;
