-- Romy phase 2: synthetic owner-mode acceptance. Only on isolated PostgreSQL.
begin;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values
('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','d1-a@fixture.invalid','',now(),now()),
('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','d1-b@fixture.invalid','',now(),now())
on conflict(id) do nothing;
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password)
values
('11111111-1111-4111-8111-111111111111','d1-a@fixture.invalid','Fixture Alpha','member',true,false),
('22222222-2222-4222-8222-222222222222','d1-b@fixture.invalid','Fixture Beta','member',true,false)
on conflict(user_id) do nothing;
do $mode$
begin
  if (select create_mode from public.minds_calendar_execution_preferences where user_id='11111111-1111-4111-8111-111111111111')<>'direct'
  then raise exception 'D1 default was not set for first member'; end if;
  if (select create_mode from public.minds_calendar_execution_preferences where user_id='22222222-2222-4222-8222-222222222222')<>'direct'
  then raise exception 'D1 default was not set for second member'; end if;
end $mode$;
-- A person who explicitly selected review must retain that restrictive preference.
update public.minds_calendar_execution_preferences set create_mode='review'
where user_id='22222222-2222-4222-8222-222222222222';
update public.office_members set display_name='Fixture Beta Updated'
where user_id='22222222-2222-4222-8222-222222222222';
do $preserve$
begin
  if (select create_mode from public.minds_calendar_execution_preferences where user_id='22222222-2222-4222-8222-222222222222')<>'review'
  then raise exception 'Explicit review preference was overwritten'; end if;
end $preserve$;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $isolation$
begin
  if (select count(*) from public.minds_calendar_execution_preferences)<>1
  then raise exception 'Direct-create preference leaked across people'; end if;
  if (select create_mode from public.minds_calendar_execution_preferences)<>'direct'
  then raise exception 'Owner cannot read own direct-create preference'; end if;
  if has_table_privilege('authenticated','public.minds_calendar_execution_preferences','UPDATE')
  then raise exception 'Browser can rewrite direct-create authority'; end if;
end $isolation$;
reset role;
rollback;
