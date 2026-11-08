-- Romy · 09.11.2026 (Claude) · a helper the heartbeat needs, missing from phase 1.
-- minds_publish_continuity_signal (rpc_workers_v1) calls public.minds_continuity_terms, which the port
-- left out, so the first Office heartbeat failed with "function does not exist". Copied unchanged from
-- Window (20260930061213_minds_continuity_engine_v01.sql): pure text function, service role only.
begin;

create or replace function public.minds_continuity_terms(p_text text)
returns text[]
language sql
immutable
security invoker
set search_path=public,pg_temp
as $$
  select coalesce(array_agg(distinct term order by term),'{}'::text[])
  from (
    select lower(x) as term
    from regexp_split_to_table(lower(coalesce(p_text,'')), '[^[:alnum:]áéíóúüñäöüß]+') x
    where length(x)>=4
      and lower(x) not in (
        'esto','esta','este','estos','estas','algo','tema','sobre','para','como','cuando','donde','desde','hasta',
        'quiero','queremos','tener','tiene','tengo','seguir','sigue','vivo','viva','abierto','abierta','pendiente',
        'proyecto','commitment','mission','minds','isabella','theory','work',
        'this','that','with','from','have','keep','open','project','about','into',
        'diese','dieser','dieses','eine','einer','einem','einen','projekt','offen','weiter'
      )
  ) q;
$$;


revoke all on function public.minds_continuity_terms(text) from public,anon,authenticated;
grant execute on function public.minds_continuity_terms(text) to service_role;

commit;
