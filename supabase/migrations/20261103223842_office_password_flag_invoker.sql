-- The "change your start password" flag is cleared by the member themselves, without a
-- SECURITY DEFINER function: they may only set their own flag to false (column grant + policy).
grant update (must_change_password) on public.office_members to authenticated;
create policy office_members_self_clear_password_flag on public.office_members
  for update to authenticated
  using (user_id = (select auth.uid()) and is_active)
  with check (user_id = (select auth.uid()) and must_change_password = false);

create or replace function public.office_password_changed() returns void
language sql security invoker set search_path = '' as $$
  update public.office_members set must_change_password = false
  where user_id = (select auth.uid()) and is_active
$$;
revoke all on function public.office_password_changed() from public, anon;
grant execute on function public.office_password_changed() to authenticated;
