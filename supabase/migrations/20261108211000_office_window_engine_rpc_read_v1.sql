-- Office phase 1: read-only Window engine RPCs by catalog-defined signatures.
-- SECURITY INVOKER only; every query is subject to Office RLS.
-- Project-scoped reads explicitly require Office team membership, not uploader identity.
-- No user data, contacts, client information or secret values were copied.
begin;
-- Window's entity recall uses similarity(); Office must install pg_trgm in public
-- because the copied SQL function deliberately uses search_path='public'.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
-- isabella_entity_recall: Window owner read under Office RLS
CREATE OR REPLACE FUNCTION public.isabella_entity_recall(p_query text, p_limit integer DEFAULT 12)
 RETURNS TABLE(source_type text, source_id text, content text, occurred_at timestamp with time zone, score real)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with q as (
  select lower(coalesce(nullif(trim(p_query),''),'__nothing__')) as raw
),
entity_hits as (
  select
    'entity'::text as source_type,
    e.id::text as source_id,
    concat_ws(' · ',e.entity_type,e.name)::text as content,
    e.updated_at as occurred_at,
    (
      similarity(lower(e.name),q.raw)
      + case when lower(e.name) like '%'||q.raw||'%' then 0.7 else 0 end
    )::real as score
  from public.isabella_entities e cross join q
  where e.user_id=auth.uid()
    and nullif(e.metadata->>'forgotten_at','') is null
    and (
      similarity(lower(e.name),q.raw)>0.10
      or lower(e.name) like '%'||q.raw||'%'
      or q.raw like '%'||lower(e.name)||'%'
    )
),
link_hits as (
  select
    'entity_link'::text,
    l.id::text,
    concat_ws(' · ',
      s.entity_type||': '||s.name,
      l.predicate,
      case when o.id is not null then o.entity_type||': '||o.name else l.object_text end
    )::text,
    l.updated_at,
    (
      similarity(lower(s.name||' '||l.predicate||' '||coalesce(o.name,l.object_text,'')),q.raw)
      + case when lower(s.name||' '||l.predicate||' '||coalesce(o.name,l.object_text,'')) like '%'||q.raw||'%' then 0.8 else 0 end
      + least(greatest(l.confidence,0),1)*0.15
    )::real
  from public.isabella_entity_links l
  join public.isabella_entities s on s.id=l.subject_entity_id
  left join public.isabella_entities o on o.id=l.object_entity_id
  cross join q
  where l.user_id=auth.uid()
    and nullif(l.metadata->>'forgotten_at','') is null
    and nullif(s.metadata->>'forgotten_at','') is null
    and (o.id is null or nullif(o.metadata->>'forgotten_at','') is null)
    and (
      similarity(lower(s.name||' '||l.predicate||' '||coalesce(o.name,l.object_text,'')),q.raw)>0.08
      or lower(s.name||' '||l.predicate||' '||coalesce(o.name,l.object_text,'')) like '%'||q.raw||'%'
    )
)
select * from (
  select * from entity_hits
  union all
  select * from link_hits
) x
where score>0
order by score desc,occurred_at desc
limit least(greatest(p_limit,1),30);
$function$;
REVOKE ALL ON FUNCTION public.isabella_entity_recall(p_query text, p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.isabella_entity_recall(p_query text, p_limit integer) TO authenticated, service_role;

-- isabella_recall_scoped: Window owner read under Office RLS
CREATE OR REPLACE FUNCTION public.isabella_recall_scoped(p_query text, p_scope_key text, p_allow_cross_scope boolean DEFAULT false, p_limit integer DEFAULT 12)
 RETURNS TABLE(source_type text, source_id text, content text, occurred_at timestamp with time zone, score real, source_scope_key text, provenance_class text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with q as (
  select
    websearch_to_tsquery('simple', coalesce(nullif(trim(p_query),''), '__nothing__')) as tsq,
    lower(coalesce(nullif(trim(p_query),''), '__nothing__')) as raw,
    coalesce(nullif(trim(p_scope_key),''),'global') as scope_key
),
memory_hits as (
  select
    'memory'::text as source_type,
    m.id::text as source_id,
    concat_ws(' · ', nullif(m.subject,''), m.content)::text as content,
    m.updated_at as occurred_at,
    (
      ts_rank_cd(to_tsvector('simple',coalesce(m.subject,'')||' '||coalesce(m.content,'')),q.tsq)*2.0
      + similarity(lower(coalesce(m.subject,'')||' '||coalesce(m.content,'')),q.raw)
      + least(greatest(m.confidence::real,0),1)*0.15
    )::real as score,
    m.exposure_scope_key as source_scope_key,
    m.provenance_class
  from public.isabella_memories m
  cross join q
  where m.user_id=auth.uid()
    and m.status='active'
    and not exists(
      select 1 from public.minds_memory_forget_tombstones t
      where t.user_id=m.user_id and t.source_kind='memory' and t.source_id=m.id::text
    )
    and (
      p_allow_cross_scope or m.exposure_scope_key='global' or m.exposure_scope_key=q.scope_key
    )
    and (
      to_tsvector('simple',coalesce(m.subject,'')||' '||coalesce(m.content,''))@@q.tsq
      or similarity(lower(coalesce(m.subject,'')||' '||coalesce(m.content,'')),q.raw)>0.10
    )
),
conversation_hits as (
  select
    'conversation'::text,
    cm.id::text,
    cm.content::text,
    cm.created_at,
    (
      ts_rank_cd(to_tsvector('simple',coalesce(cm.content,'')),q.tsq)*1.55
      + similarity(lower(coalesce(cm.content,'')),q.raw)
      + case when cm.role='user' then 0.12 else 0 end
    )::real,
    case when cm.exposure_scope_version=1 then cm.exposure_scope_key else 'legacy' end,
    cm.provenance_class
  from public.conversation_messages cm
  join public.conversations c on c.id=cm.conversation_id
  cross join q
  where cm.user_id=auth.uid()
    and c.user_id=auth.uid()
    and c.app_scope='isabella'
    and cm.role in ('user','assistant')
    and not exists(
      select 1 from public.minds_memory_forget_tombstones t
      where t.user_id=cm.user_id and t.source_kind='conversation' and t.source_id=c.id::text
    )
    and (
      (cm.exposure_scope_version=1 and (p_allow_cross_scope or cm.exposure_scope_key=q.scope_key))
      or (p_allow_cross_scope and cm.exposure_scope_version=0)
    )
    and (
      to_tsvector('simple',coalesce(cm.content,''))@@q.tsq
      or similarity(lower(coalesce(cm.content,'')),q.raw)>0.13
    )
),
preference_hits as (
  select
    'preference'::text,
    p.id::text,
    (p.preference_key||': '||p.value::text)::text,
    p.updated_at,
    (
      ts_rank_cd(to_tsvector('simple',p.preference_key||' '||p.value::text),q.tsq)*1.8
      + similarity(lower(p.preference_key||' '||p.value::text),q.raw)
      + least(greatest(p.confidence::real,0),1)*0.15
    )::real,
    'global'::text,
    'owner'::text
  from public.isabella_preferences p
  cross join q
  where p.user_id=auth.uid()
    and p.status<>'rejected'
    and (
      to_tsvector('simple',p.preference_key||' '||p.value::text)@@q.tsq
      or similarity(lower(p.preference_key||' '||p.value::text),q.raw)>0.10
    )
),
people_hits as (
  select
    'person'::text,
    p.id::text,
    concat_ws(' · ',p.name,nullif(p.relationship,''),case when p.birthday is not null then 'cumpleaños '||p.birthday::text end)::text,
    p.updated_at,
    (
      ts_rank_cd(to_tsvector('simple',coalesce(p.name,'')||' '||coalesce(p.relationship,'')||' '||coalesce(p.birthday::text,'')),q.tsq)*1.8
      + similarity(lower(coalesce(p.name,'')||' '||coalesce(p.relationship,'')),q.raw)
    )::real,
    'global'::text,
    'owner'::text
  from public.isabella_people p
  cross join q
  where p.user_id=auth.uid()
    and (
      to_tsvector('simple',coalesce(p.name,'')||' '||coalesce(p.relationship,'')||' '||coalesce(p.birthday::text,''))@@q.tsq
      or similarity(lower(coalesce(p.name,'')||' '||coalesce(p.relationship,'')),q.raw)>0.10
    )
)
select source_type,source_id,content,occurred_at,score,source_scope_key,provenance_class
from (
  select * from memory_hits
  union all select * from conversation_hits
  union all select * from preference_hits
  union all select * from people_hits
) hits
where score>0
order by score desc,occurred_at desc
limit least(greatest(p_limit,1),30);
$function$;
REVOKE ALL ON FUNCTION public.isabella_recall_scoped(p_query text, p_scope_key text, p_allow_cross_scope boolean, p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.isabella_recall_scoped(p_query text, p_scope_key text, p_allow_cross_scope boolean, p_limit integer) TO authenticated, service_role;

-- isabella_semantic_recall_scoped: Window owner read under Office RLS
CREATE OR REPLACE FUNCTION public.isabella_semantic_recall_scoped(p_embedding vector, p_scope_key text, p_allow_cross_scope boolean DEFAULT false, p_limit integer DEFAULT 10)
 RETURNS TABLE(source_type text, source_id text, content text, score real, source_scope_key text, provenance_class text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select
    e.source_type,e.source_id,e.content,
    (1-(e.embedding<=>p_embedding))::real as score,
    e.exposure_scope_key,e.provenance_class
  from public.isabella_embeddings e
  where e.user_id=auth.uid()
    and (
      p_allow_cross_scope
      or e.exposure_scope_key='global'
      or e.exposure_scope_key=coalesce(nullif(trim(p_scope_key),''),'global')
    )
    and not (
      e.source_type='memory'
      and exists(
        select 1 from public.minds_memory_forget_tombstones t
        where t.user_id=e.user_id and t.source_kind='memory' and t.source_id=e.source_id
      )
    )
    and not (
      e.source_type='conversation'
      and exists(
        select 1
        from public.conversation_messages cm
        join public.conversations c on c.id=cm.conversation_id and c.user_id=cm.user_id
        join public.minds_memory_forget_tombstones t
          on t.user_id=cm.user_id and t.source_kind='conversation' and t.source_id=c.id::text
        where cm.user_id=e.user_id and cm.id::text=e.source_id
      )
    )
  order by e.embedding<=>p_embedding
  limit least(greatest(p_limit,1),30);
$function$;
REVOKE ALL ON FUNCTION public.isabella_semantic_recall_scoped(p_embedding vector, p_scope_key text, p_allow_cross_scope boolean, p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.isabella_semantic_recall_scoped(p_embedding vector, p_scope_key text, p_allow_cross_scope boolean, p_limit integer) TO authenticated, service_role;

-- minds_find_work_source_occurrences: Office project-team read (replacing Window owner-only filter)
CREATE OR REPLACE FUNCTION public.minds_find_work_source_occurrences(p_project_id uuid, p_terms text[], p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_expected_fingerprint text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
WITH input AS (
 SELECT
  p_project_id IS NOT NULL AND (select private.office_project_team_has_access(p_project_id))
   AND coalesce(cardinality(p_terms),0) BETWEEN 1 AND 12
   AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p_terms,ARRAY[]::text[])) t
       WHERE length(trim(coalesce(t,''))) NOT BETWEEN 2 AND 120)
   AND coalesce(p_limit,25) BETWEEN 1 AND 50
   AND coalesce(p_offset,0) BETWEEN 0 AND 1000000
   AND (coalesce(p_offset,0)=0 OR length(coalesce(p_expected_fingerprint,''))=32)
   AND (p_expected_fingerprint IS NULL OR p_expected_fingerprint ~ '^[a-f0-9]{32}$') AS valid,
  coalesce(p_limit,25) AS page_size,coalesce(p_offset,0) AS page_offset
),
terms AS (
 SELECT DISTINCT lower(trim(t)) term FROM unnest(coalesce(p_terms,ARRAY[]::text[])) t
 WHERE length(trim(coalesce(t,''))) BETWEEN 2 AND 120
),
hits AS (
 SELECT s.file_id,f.name AS file_name,s.source_version,s.segment_no,s.segment_kind,
   s.locator,s.extractor,s.content,
   (SELECT min(strpos(lower(s.content),t.term)) FROM terms t
      WHERE strpos(lower(s.content),t.term)>0) AS first_match
 FROM public.minds_work_source_segments s
 JOIN public.minds_work_files f ON f.id=s.file_id
   AND f.user_id=s.user_id AND f.project_id=s.project_id
 WHERE s.project_id=p_project_id
   AND s.source_version=coalesce(f.metadata->'knowledge_intake'->>'source_version','')
   AND EXISTS(SELECT 1 FROM terms t WHERE strpos(lower(s.content),t.term)>0)
),
scan AS (
 SELECT count(*)::integer AS total,
   md5(coalesce(string_agg(h.file_id::text||':'||h.source_version||':'||h.segment_no::text,
     '|' ORDER BY h.file_id,h.segment_no),'') || '|' ||
     coalesce((SELECT string_agg(term,'|' ORDER BY term) FROM terms),'')) AS fingerprint
 FROM hits h
),
page AS (
 SELECT h.file_id,h.file_name,h.source_version,h.segment_no,h.segment_kind,h.locator,
    h.extractor,length(h.content) AS segment_chars,
    substring(h.content from greatest(1,h.first_match-120) for 960) AS match_excerpt,
    h.first_match AS first_match_char
 FROM hits h
 ORDER BY h.file_id,h.segment_no
 LIMIT (SELECT greatest(1,least(page_size,50)) FROM input)
 OFFSET (SELECT greatest(0,page_offset) FROM input)
),
pack AS (
 SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page.file_id,page.segment_no),
   '[]'::jsonb) AS matches,count(*)::integer AS returned FROM page
)
SELECT CASE
 WHEN NOT (SELECT valid FROM input)
  THEN jsonb_build_object('status','invalid','reason','invalid_terms_or_cursor')
 WHEN p_expected_fingerprint IS NOT NULL
   AND p_expected_fingerprint<>(SELECT fingerprint FROM scan)
  THEN jsonb_build_object('status','version_changed',
   'total',(SELECT total FROM scan),'fingerprint',(SELECT fingerprint FROM scan),
   'matches','[]'::jsonb,'has_more',false)
 ELSE jsonb_build_object(
   'status','ok',
   'scope','all_current_extracted_text_matching_explicit_terms',
   'terms',(SELECT coalesce(jsonb_agg(term ORDER BY term),'[]'::jsonb) FROM terms),
   'total',(SELECT total FROM scan),
   'fingerprint',(SELECT fingerprint FROM scan),
   'offset',(SELECT page_offset FROM input),
   'limit',(SELECT page_size FROM input),
   'returned',(SELECT returned FROM pack),
   'has_more',(SELECT page_offset FROM input)+(SELECT returned FROM pack)<(SELECT total FROM scan),
   'next_offset',CASE WHEN (SELECT page_offset FROM input)+(SELECT returned FROM pack)<(SELECT total FROM scan)
     THEN (SELECT page_offset FROM input)+(SELECT returned FROM pack) ELSE NULL END,
   'matches',(SELECT matches FROM pack),
   'extraction_gaps_are_separate',true,
   'full_originals_verified',false)
 END;
$function$;
REVOKE ALL ON FUNCTION public.minds_find_work_source_occurrences(p_project_id uuid, p_terms text[], p_limit integer, p_offset integer, p_expected_fingerprint text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_find_work_source_occurrences(p_project_id uuid, p_terms text[], p_limit integer, p_offset integer, p_expected_fingerprint text) TO authenticated, service_role;

-- minds_lock_conversation: Window owner read under Office RLS
CREATE OR REPLACE FUNCTION public.minds_lock_conversation(p_id uuid, p_token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if p_token is null then raise exception 'Lease token required';end if;
  update public.conversations set runtime_lease_token=p_token,runtime_lease_until=now()+interval '15 minutes' where id=p_id and (runtime_lease_until is null or runtime_lease_until<now());
  return found;
end $function$;
REVOKE ALL ON FUNCTION public.minds_lock_conversation(p_id uuid, p_token uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_lock_conversation(p_id uuid, p_token uuid) TO authenticated, service_role;

-- minds_project_model_snapshot: Office project-team read (replacing Window owner-only filter)
CREATE OR REPLACE FUNCTION public.minds_project_model_snapshot(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_project jsonb;
  v_revision jsonb;
  v_revision_id uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;

  select jsonb_build_object('id',p.id,'name',p.name,'client_key',p.id::text)
  into v_project
  from public.office_projects p
  where p.id=p_project_id and p.status='aktiv'
    and (select private.office_project_team_has_access(p.id));

  if v_project is null then raise exception 'project_not_found' using errcode='P0002'; end if;

  select r.id,to_jsonb(r) into v_revision_id,v_revision
  from public.minds_project_model_revisions r
  where r.project_id=p_project_id and r.status='current'
  order by r.created_at desc limit 1;

  select jsonb_build_object(
    'project',v_project,
    'current_revision',v_revision,
    'revision_elements',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.element_kind,x.role,x.element_ref)
      from (
        select element_kind,element_ref,role,note,metadata,created_at
        from public.minds_project_model_elements
        where project_id=p_project_id and revision_id=v_revision_id
        order by element_kind,role,element_ref
        limit 800
      ) x
    ),'[]'::jsonb),
    'variants',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at,x.id)
      from (
        select id,variant_kind,status,source_claim_id,target_claim_id,confidence,rationale,
               comparison_item_id,provenance,created_at,resolved_at
        from public.minds_project_model_variants
        where project_id=p_project_id and revision_id=v_revision_id
          and status<>'retired'
        order by created_at,id
        limit 180
      ) x
    ),'[]'::jsonb),
    'referents',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.kind,x.label)
      from (
        select id,kind,label,canonical_key,aliases,status,merged_into,provenance,updated_at
        from public.minds_project_referents
        where project_id=p_project_id and status<>'retired'
        limit 180
      ) x
    ),'[]'::jsonb),
    'claims',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc)
      from (
        select id,claim_type,statement,referent_id,subject,topic,discipline,status,confidence,
               provenance_class,author_kind,model_kind,supersedes_id,superseded_by,
               valid_from,valid_to,learned_at,confirmed_at,updated_at
        from public.minds_work_claims
        where project_id=p_project_id
          and status in ('proposed','confirmed','disputed','resolved')
        order by updated_at desc limit 220
      ) x
    ),'[]'::jsonb),
    'relations',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.updated_at desc)
      from (
        select id,source_claim_id,target_claim_id,relation,status,author_kind,confidence,provenance,updated_at
        from public.minds_work_claim_relations
        where project_id=p_project_id and status in ('proposed','confirmed')
        order by updated_at desc limit 260
      ) x
    ),'[]'::jsonb),
    'movements',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.due_at nulls last,x.title)
      from (
        select source_kind,source_ref,actor_kind,title,status,due_at,anchor_kind,metadata
        from public.minds_project_movements_v1
        where project_id=p_project_id
        order by due_at nulls last,title limit 220
      ) x
    ),'[]'::jsonb),
    'perimeter',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.source_class)
      from (
        select source_class,observation_mode,readability,coverage,freshness_minutes,last_checked_at,last_seen_at,note,metadata
        from public.minds_project_perimeter
        where project_id=p_project_id
        order by source_class
      ) x
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end $function$;
REVOKE ALL ON FUNCTION public.minds_project_model_snapshot(p_project_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_project_model_snapshot(p_project_id uuid) TO authenticated, service_role;

-- minds_read_task_origin_v01: Window owner read under Office RLS
CREATE OR REPLACE FUNCTION public.minds_read_task_origin_v01(p_task_ref text)
 RETURNS TABLE(task_id uuid, source_message_id uuid, source_text text, source_created_at timestamp with time zone, match_method text, evidence_status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with owned_task as (
    select t.id,t.title,t.created_at,t.project_id,t.user_id
    from public.isabella_tasks t
    where auth.uid() is not null and t.user_id=auth.uid()
      and (t.id::text=trim(coalesce(p_task_ref,''))
           or t.client_key=trim(coalesce(p_task_ref,'')))
      and t.metadata->>'source'='isabella'
      and length(trim(t.title)) between 3 and 180
    limit 1
  ),
  current_conversation as (
    select c.id
    from public.conversations c
    where c.user_id=auth.uid() and c.app_scope='isabella'
    order by c.updated_at desc,c.id desc
    limit 1
  ),
  candidates as (
    select
      t.id as task_id,
      m.id as source_message_id,
      left(m.content,600) as source_text,
      m.created_at as source_created_at,
      count(*) over(partition by t.id) as candidate_count,
      row_number() over(partition by t.id order by
        abs(extract(epoch from (m.created_at-t.created_at))) asc,m.id asc) as candidate_rank
    from owned_task t
    join current_conversation c on true
    join public.conversation_messages m
      on m.user_id=auth.uid() and m.conversation_id=c.id
     and m.role='user'
     and m.created_at between t.created_at-interval '10 minutes'
                          and t.created_at+interval '2 minutes'
     and strpos(lower(m.content),lower(t.title))>0
     and (
       (m.exposure_scope_version=0 and m.exposure_scope_key='legacy')
       or
       (m.exposure_scope_version=1 and
         (m.exposure_scope_key='global'
          or (t.project_id is not null and
              m.exposure_scope_key='project:'||t.project_id::text)))
     )
  )
  select c.task_id,c.source_message_id,c.source_text,c.source_created_at,
         'unique_title_creation_window'::text,
         'inferred_origin_candidate'::text
  from candidates c
  where c.candidate_rank=1 and c.candidate_count=1;
$function$;
REVOKE ALL ON FUNCTION public.minds_read_task_origin_v01(p_task_ref text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_read_task_origin_v01(p_task_ref text) TO authenticated, service_role;

-- minds_recent_scoped_messages: Window owner read under Office RLS
CREATE OR REPLACE FUNCTION public.minds_recent_scoped_messages(p_conversation_id uuid, p_scope_key text, p_limit integer DEFAULT 24)
 RETURNS TABLE(id uuid, role text, content text, created_at timestamp with time zone, metadata jsonb, exposure_scope_kind text, exposure_scope_ref text, exposure_scope_key text, provenance_class text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select cm.id,cm.role,cm.content,cm.created_at,cm.metadata,
         cm.exposure_scope_kind,cm.exposure_scope_ref,cm.exposure_scope_key,cm.provenance_class
  from public.conversation_messages cm
  join public.conversations c on c.id=cm.conversation_id and c.user_id=cm.user_id
  where cm.user_id=auth.uid()
    and cm.conversation_id=p_conversation_id
    and c.user_id=auth.uid()
    and cm.exposure_scope_version=1
    and cm.exposure_scope_key=trim(coalesce(p_scope_key,'global'))
    and cm.role in ('user','assistant')
  order by cm.created_at desc,cm.id desc
  limit least(greatest(coalesce(p_limit,24),1),80);
$function$;
REVOKE ALL ON FUNCTION public.minds_recent_scoped_messages(p_conversation_id uuid, p_scope_key text, p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_recent_scoped_messages(p_conversation_id uuid, p_scope_key text, p_limit integer) TO authenticated, service_role;

-- minds_scoped_message_count: Window owner read under Office RLS
CREATE OR REPLACE FUNCTION public.minds_scoped_message_count(p_conversation_id uuid, p_scope_key text)
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select count(*)
  from public.conversation_messages cm
  join public.conversations c on c.id=cm.conversation_id and c.user_id=cm.user_id
  where cm.user_id=auth.uid()
    and cm.conversation_id=p_conversation_id
    and c.user_id=auth.uid()
    and cm.exposure_scope_version=1
    and cm.exposure_scope_key=trim(coalesce(p_scope_key,'global'))
    and cm.role in ('user','assistant');
$function$;
REVOKE ALL ON FUNCTION public.minds_scoped_message_count(p_conversation_id uuid, p_scope_key text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_scoped_message_count(p_conversation_id uuid, p_scope_key text) TO authenticated, service_role;

-- minds_search_work_source_segments: Office project-team read (replacing Window owner-only filter)
CREATE OR REPLACE FUNCTION public.minds_search_work_source_segments(p_project_id uuid, p_query text, p_limit integer DEFAULT 12)
 RETURNS TABLE(file_id uuid, file_name text, source_version text, segment_no integer, segment_kind text, locator jsonb, content text, extractor text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
WITH terms AS (
  SELECT DISTINCT lower(word) w
  FROM regexp_split_to_table(left(coalesce(p_query,''),500),'[^[:alnum:]äöüßáéíóúñ]+') word
  WHERE length(word)>=4 AND lower(word) NOT IN
    ('sobre','como','para','cuál','donde','archivo','documento','projekt',
     'planung','work','dice','explica','tiene','document','file')
  LIMIT 12
), scored AS (
  SELECT s.file_id,f.name file_name,s.source_version,s.segment_no,s.segment_kind,
    s.locator,s.content,s.extractor,
    (SELECT count(*) FROM terms WHERE strpos(lower(s.content),w)>0) content_hits,
    (SELECT count(*) FROM terms WHERE strpos(lower(f.name),w)>0) filename_hits,
    position(lower(f.name) in lower(coalesce(p_query,'')))>0 named_file
  FROM public.minds_work_source_segments s
  JOIN public.minds_work_files f ON f.id=s.file_id AND f.user_id=s.user_id
  WHERE s.project_id=p_project_id
    AND (select private.office_project_team_has_access(p_project_id))
    AND s.source_version=coalesce(f.metadata->'knowledge_intake'->>'source_version','')
)
SELECT file_id,file_name,source_version,segment_no,segment_kind,locator,content,extractor
FROM scored
WHERE content_hits>0 OR filename_hits>0 OR named_file
ORDER BY named_file DESC,(content_hits*2+filename_hits) DESC,file_name,segment_no
LIMIT greatest(1,least(coalesce(p_limit,12),16));
$function$;
REVOKE ALL ON FUNCTION public.minds_search_work_source_segments(p_project_id uuid, p_query text, p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_search_work_source_segments(p_project_id uuid, p_query text, p_limit integer) TO authenticated, service_role;

-- minds_unlock_conversation: Window owner read under Office RLS
CREATE OR REPLACE FUNCTION public.minds_unlock_conversation(p_id uuid, p_token uuid)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update public.conversations set runtime_lease_token=null,runtime_lease_until=null where id=p_id and runtime_lease_token=p_token;
$function$;
REVOKE ALL ON FUNCTION public.minds_unlock_conversation(p_id uuid, p_token uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_unlock_conversation(p_id uuid, p_token uuid) TO authenticated, service_role;
commit;
