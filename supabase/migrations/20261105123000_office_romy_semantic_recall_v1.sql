-- Office Romy: employee-owned, source-linked semantic search (not accepted memory).
-- This migration is staged on PR #35. It must NOT be regarded as applied to production.
-- Derived vectors never grant authority, and deleted/retracted sources cannot be recalled.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table public.office_romy_embeddings(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid unique references public.office_assistant_messages(id) on delete cascade,
  memory_id uuid unique references public.office_romy_memories(id) on delete cascade,
  embedding extensions.vector(1536) not null,
  embedded_model text not null default 'text-embedding-3-small'
    check (embedded_model='text-embedding-3-small'),
  created_at timestamptz not null default now(),
  check ((message_id is not null) <> (memory_id is not null))
);
create index office_romy_embeddings_owner_idx
  on public.office_romy_embeddings(user_id);
create index office_romy_embeddings_message_idx
  on public.office_romy_embeddings(message_id) where message_id is not null;
create index office_romy_embeddings_memory_idx
  on public.office_romy_embeddings(memory_id) where memory_id is not null;

alter table public.office_romy_embeddings enable row level security;
revoke all on public.office_romy_embeddings from public, anon, authenticated;
grant select on public.office_romy_embeddings to authenticated;
create policy office_romy_embeddings_owner_select
  on public.office_romy_embeddings for select to authenticated
  using (user_id=(select auth.uid()) and (select private.office_is_member()));
-- No authenticated INSERT/UPDATE/DELETE: only the server, after reading sources with
-- the employee JWT and verifying provenance, can write derived embeddings.

create function public.office_romy_semantic_recall(
  p_embedding extensions.vector(1536),p_limit integer default 10
) returns table(
  source_type text,source_id uuid,conversation_id uuid,
  content text,occurred_at timestamptz,score real,provenance text
)
language sql stable security invoker set search_path=pg_catalog,extensions as $
  with own_messages as (
    select 'conversation'::text as source_type,m.id as source_id,
      m.conversation_id,
      left(m.content,2200)::text as content,m.created_at as occurred_at,
      (1-(e.embedding <=> p_embedding))::real as score,
      'historic_conversation_not_accepted_memory'::text as provenance
    from public.office_romy_embeddings e
    join public.office_assistant_messages m on m.id=e.message_id
      and m.user_id=e.user_id
    where e.user_id=(select auth.uid())
  ), accepted_memories as (
    select 'accepted_memory'::text as source_type, r.id as source_id,
      r.source_conversation_id as conversation_id,
      left(r.content,2200)::text as content,r.created_at as occurred_at,
      (1-(e.embedding <=> p_embedding))::real as score,
      'owner_confirmed_private_memory'::text as provenance
    from public.office_romy_embeddings e
    join public.office_romy_memories r on r.id=e.memory_id
      and r.user_id=e.user_id and r.status='accepted'
    where e.user_id=(select auth.uid())
  )
  select * from (
    select * from own_messages
    union all
    select * from accepted_memories
  ) ranked
  order by score desc, occurred_at desc
  limit least(greatest(coalesce(p_limit,10),1),20);
$$;
revoke all on function public.office_romy_semantic_recall(extensions.vector,integer) from public,anon;
grant execute on function public.office_romy_semantic_recall(text,integer) to authenticated;

create function public.office_romy_discard_retracted_vector()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status <> 'accepted' then
    delete from public.office_romy_embeddings where memory_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.office_romy_discard_retracted_vector() from public,anon,authenticated;
create trigger office_romy_retraction_vector_cleanup
  after update of status on public.office_romy_memories
  for each row when (new.status <> 'accepted')
  execute function public.office_romy_discard_retracted_vector();

comment on table public.office_romy_embeddings is
  'Embeddings for private owner-scoped retrieval; derived from canonical messages and accepted memories only. Never accepted claims themselves.';
