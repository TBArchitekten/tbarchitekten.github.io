-- Office phase 4; PostgreSQL/Supabase CLI ephemeral database only. Three fictional identities.
begin;
insert into auth.users (id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values
 ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fixture-a@fixture.invalid','',now(),now()),
 ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fixture-b@fixture.invalid','',now(),now())
on conflict(id) do nothing;
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password)
values
 ('11111111-1111-4111-8111-111111111111','fixture-a@fixture.invalid','Fiktiv Alpha','member',true,false),
 ('22222222-2222-4222-8222-222222222222','fixture-b@fixture.invalid','Fiktiv Beta','member',true,false)
on conflict(user_id) do nothing;
insert into public.isabella_memories(id,user_id,kind,content,client_key)
values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','context','Synthetic private Alpha','fixture-mem-a'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','context','Synthetic private Beta','fixture-mem-b');
insert into public.isabella_preferences(user_id,preference_key,value,status)
values
 ('11111111-1111-4111-8111-111111111111','assistant','{"curiosityEnabled":true}'::jsonb,'confirmed'),
 ('22222222-2222-4222-8222-222222222222','assistant','{"curiosityEnabled":true}'::jsonb,'confirmed')
on conflict(user_id,preference_key) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $check$
declare result jsonb;
begin
  if (select count(*) from public.isabella_memories where content like 'Synthetic private%')<>1 then
    raise exception 'private memory RLS read isolation failed';
  end if;
  if (select count(*) from public.isabella_preferences where preference_key='assistant')<>1 then
    raise exception 'private preference RLS isolation failed';
  end if;
  result:=public.office_romy_forget_private_memory('memory','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  if result->>'status'<>'missing' then
    raise exception 'user A must not forget user B memory';
  end if;
  result:=public.office_romy_forget_private_memory('memory','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if result->>'status'<>'forgotten' then
    raise exception 'user A cannot forget own memory';
  end if;
  if exists(select 1 from public.isabella_memories where content='Synthetic private Alpha' and status='active') then
    raise exception 'forget did not archive own memory';
  end if;
end $check$;
update public.isabella_preferences set value='{"curiosityEnabled":false}'::jsonb
  where user_id='11111111-1111-4111-8111-111111111111' and preference_key='assistant';
do $check$
begin
  if (select value->>'curiosityEnabled' from public.isabella_preferences where preference_key='assistant')<>'false' then
    raise exception 'user A did not save opt-out';
  end if;
end $check$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $check$
begin
  if (select value->>'curiosityEnabled' from public.isabella_preferences where preference_key='assistant')<>'true' then
    raise exception 'user A preference changed user B';
  end if;
  if (select count(*) from public.isabella_memories where content like 'Synthetic private%')<>1 then
    raise exception 'user B private memory visibility corrupted';
  end if;
  if (select status from public.isabella_memories where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>'active' then
    raise exception 'user A forgot user B memory';
  end if;
end $check$;
reset role;
rollback;
