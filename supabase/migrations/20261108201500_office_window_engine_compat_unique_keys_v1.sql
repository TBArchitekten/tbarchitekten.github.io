-- Office / Romy · Phase 1 · additive compatibility key for Window RPC FKs.
-- Office's task primary key(id) is already unique; (id,user_id) is therefore
-- intrinsically unique, but Window's composite references require a matching
-- UNIQUE index. This index adds no rows and changes no existing values.
begin;
create unique index if not exists isabella_tasks_id_user_id_office_romy_uidx
on public.isabella_tasks(id,user_id);
commit;
