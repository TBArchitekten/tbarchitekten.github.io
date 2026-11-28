-- Un solo motor (Gari, 28.11.2026: «supongo que lo mejor es empezar ya a hacer solo un motor»): Romys Threads in
-- Work laufen auf dem Motor aus Window (isabella-chat), nicht mehr auf office-assistant. Ein Thread gehört dann wie
-- in Window zu einem Gespräch in public.conversations (app_scope 'work_thread'), bisher zu
-- office_assistant_conversations. Stand vor der Änderung (28.11.2026 geprüft): 0 Threads, es geht also keine
-- Verknüpfung verloren. Fragen und Antworten im Thread schreibt der Motor (das Office lässt den Browser nur die
-- eigenen Züge schreiben); dieser Teil braucht keine Rechte mehr.

alter table public.minds_work_threads
  drop constraint minds_work_threads_conversation_id_user_id_fkey;
-- Das Gespräch muss weiter derselben Person gehören.
alter table public.minds_work_threads
  add constraint minds_work_threads_conversation_id_user_id_fkey
  foreign key (conversation_id, user_id) references public.conversations(id, user_id)
  on delete set null (conversation_id);

-- Wie in Window: das Gespräch des Threads in conversations, mit Projekt und Thread im Anker.
create or replace function public.minds_ensure_work_thread_conversation(p_thread_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_thread record;
  v_conversation uuid;
begin
  select id, title, project_id, conversation_id into v_thread
    from public.minds_work_threads where id = p_thread_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'thread_not_found' using errcode = 'P0002'; end if;
  if v_thread.conversation_id is not null then return v_thread.conversation_id; end if;
  insert into public.conversations(user_id, app_scope, origin_kind, origin_anchor, title, mode, metadata)
    values ((select auth.uid()), 'work_thread', 'global',
            jsonb_build_object('type', 'work_thread', 'id', v_thread.id::text, 'label', v_thread.title),
            left(v_thread.title, 140), 'memory',
            jsonb_build_object('app', 'work_thread', 'work_thread_id', v_thread.id, 'project_id', v_thread.project_id))
    returning id into v_conversation;
  update public.minds_work_threads set conversation_id = v_conversation, updated_at = now() where id = p_thread_id;
  return v_conversation;
end $$;

create or replace function public.minds_rename_work_thread(p_thread_id uuid, p_title text) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_conversation uuid;
begin
  update public.minds_work_threads set title = btrim(p_title), updated_at = now()
    where id = p_thread_id and user_id = (select auth.uid()) returning conversation_id into v_conversation;
  if not found then raise exception 'thread_not_found' using errcode = 'P0002'; end if;
  if v_conversation is not null then
    update public.conversations set title = left(btrim(p_title), 140), updated_at = now()
      where id = v_conversation and user_id = (select auth.uid()) and app_scope = 'work_thread';
  end if;
end $$;
