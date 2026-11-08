-- Romy · review 08.11.2026 (Claude) · app notices that Romy can read.
-- In Window the app writes its receipts («La tarea queda para el miércoles.») into the conversation,
-- so the next turn knows a confirmed change is done. Office browsers may not write assistant rows
-- (phase 1, on purpose). This function is the one narrow path: the owner of the conversation, an
-- active member, a short text, always marked as a system notice of the app. Never Romy's voice.
begin;

create or replace function public.office_romy_append_notice(p_conversation_id uuid, p_client_key text, p_content text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_text text := btrim(coalesce(p_content,''));
  v_key text := btrim(coalesce(p_client_key,''));
  v_scope record;
begin
  if v_user is null or not (select private.office_is_member()) then
    raise exception 'office_member_required';
  end if;
  if length(v_text) < 1 or length(v_text) > 600 or length(v_key) < 8 or length(v_key) > 80 then
    raise exception 'notice_invalid';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.user_id = v_user and c.app_scope in ('isabella','work_thread')
  ) then
    raise exception 'conversation_not_owned';
  end if;
  -- The notice belongs to the scope of the latest scoped message (the turn it answers).
  select m.exposure_scope_kind, m.exposure_scope_ref, m.exposure_scope_key into v_scope
  from public.conversation_messages m
  where m.conversation_id = p_conversation_id and m.user_id = v_user and m.exposure_scope_version = 1
  order by m.created_at desc limit 1;
  insert into public.conversation_messages(user_id, conversation_id, role, content, provisional, metadata, client_key,
    exposure_scope_version, exposure_scope_kind, exposure_scope_ref, exposure_scope_key, provenance_class)
  values (v_user, p_conversation_id, 'assistant', v_text, false,
    jsonb_build_object('author','system','source','office_app_notice'), 'notice:'||v_key,
    1, coalesce(v_scope.exposure_scope_kind,'global'), v_scope.exposure_scope_ref, coalesce(v_scope.exposure_scope_key,'global'), 'system')
  on conflict (user_id, conversation_id, client_key) do nothing;
  return jsonb_build_object('status','saved');
end
$function$;

revoke all on function public.office_romy_append_notice(uuid, text, text) from public, anon;
grant execute on function public.office_romy_append_notice(uuid, text, text) to authenticated;

commit;
