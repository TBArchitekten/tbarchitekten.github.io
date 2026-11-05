-- Cover composite mission foreign keys to keep revocation and cleanup predictable.
create index if not exists office_romy_missions_conversation_owner_idx
 on public.office_romy_missions(conversation_id,user_id);
create index if not exists office_romy_missions_request_idx
 on public.office_romy_missions(request_id);
