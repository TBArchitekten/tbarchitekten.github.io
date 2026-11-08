-- Romy phase 4: owner-only forget; no destructive DELETE and no cross-member access.
-- This RPC never trusts an owner identifier from the browser.
begin;
create or replace function public.office_romy_forget_private_memory(p_kind text,p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $office$
declare
  v_user uuid := (select auth.uid());
  v_allowed boolean := false;
  v_source text;
begin
  if v_user is null or p_id is null or not (select private.office_is_member()) then
    raise exception 'office_member_required' using errcode='42501';
  end if;
  if p_kind = 'memory' then
    select exists(select 1 from public.isabella_memories where id=p_id and user_id=v_user)
      into v_allowed;
    v_source := 'memory';
  elsif p_kind = 'claim' then
    select exists(select 1 from public.isabella_model_claims where id=p_id and user_id=v_user)
      into v_allowed;
    v_source := 'model_claim';
  elsif p_kind = 'entity' then
    select exists(select 1 from public.isabella_entities where id=p_id and user_id=v_user)
      into v_allowed;
    v_source := 'entity';
  else
    raise exception 'unsupported_private_memory_kind' using errcode='22023';
  end if;
  if not v_allowed then return jsonb_build_object('status','missing'); end if;
  -- A tombstone and lineage invalidation preserves provenance without deleting data.
  return public.minds_invalidate_memory_lineage(v_user,v_source,p_id::text,'user_forget');
end
$office$;
revoke all on function public.office_romy_forget_private_memory(text,uuid) from public,anon,authenticated;
grant execute on function public.office_romy_forget_private_memory(text,uuid) to authenticated;
commit;
