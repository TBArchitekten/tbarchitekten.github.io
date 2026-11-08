-- Office Phase 1: source extraction, text segments, Docling queue and project-model RPCs.
-- RLS remains the authority for owner/team reads; writes are service-role-only.
-- Project writes require active membership of the source/author user in Office.
-- All DDL copied as schema source, no user records or project content.
begin;
CREATE OR REPLACE FUNCTION public.minds_claim_work_ingest(p_limit integer DEFAULT 2)
 RETURNS SETOF minds_work_ingest_queue
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with candidates as (
    select q.id from public.minds_work_ingest_queue q
    where q.attempts<4 and q.next_attempt_at<=now()
      and (q.status in ('queued','docling_pending')
           or (q.status='processing' and q.locked_at<now()-interval '8 minutes'))
    order by q.is_backfill asc,q.created_at,q.id
    for update of q skip locked
    limit greatest(1,least(coalesce(p_limit,2),3))
  )
  update public.minds_work_ingest_queue q
  set status='processing',
    attempts=case when q.status='docling_pending' then q.attempts else q.attempts+1 end,
    locked_at=now(),updated_at=now()
  from candidates c where q.id=c.id returning q.*;
$function$;
REVOKE ALL ON FUNCTION public.minds_claim_work_ingest(p_limit integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_claim_work_ingest(p_limit integer) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_reconcile_work_ingest(p_limit integer DEFAULT 1, p_docling_ready boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_limit integer:=greatest(1,least(coalesce(p_limit,1),2));
  v_resumed integer:=0;
  v_found integer:=0;
  v_waiting integer:=0;
begin
  if p_docling_ready then
    with ready as (
      select q.id,q.file_id from public.minds_work_ingest_queue q
      join public.minds_work_files f on f.id=q.file_id
      where q.status='waiting_parser'
        and q.last_error in ('docling_required_large_source','needs_private_docling_image')
        and f.size_bytes<=50331648
      order by q.updated_at,q.id
      for update of q skip locked limit v_limit
    ), resumed as (
      update public.minds_work_ingest_queue q
      set status='queued',attempts=0,last_error=null,locked_at=null,
        completed_at=null,next_attempt_at=now(),updated_at=now()
      from ready where q.id=ready.id returning q.file_id
    ), updated as (
      update public.minds_work_files f set index_status='queued',updated_at=now()
      from resumed where f.id=resumed.file_id returning f.id
    )
    select count(*)::integer into v_resumed from resumed;
  end if;

  -- Never requeue a completed source merely because it is historic.
  -- Only originals without any receipt are discovered; this is bounded.
  with candidates as (
    select f.id,f.project_id,f.user_id,f.name,f.size_bytes
    from public.minds_work_files f
    where f.index_status='stored'
      and not exists(select 1 from public.minds_work_ingest_queue q where q.file_id=f.id)
    order by f.created_at,f.id
    for update of f skip locked
    limit v_limit
  ), classified as (
    select c.*,
      case
        when c.size_bytes>50331648 then 'needs_larger_worker'
        when lower(c.name) !~ '[.](pdf|doc|docx|xls|xlsx|ppt|pptx|txt|md|csv|rtf|eml|png|jpg|jpeg)$'
          then 'needs_format_reader'
        when c.size_bytes>20971520 then 'docling_required_large_source'
        when lower(c.name) ~ '[.](png|jpg|jpeg)$' and c.size_bytes>8388608
          then 'needs_private_docling_image'
        else null
      end as deferred_reason
    from candidates c
  ), inserted as (
    insert into public.minds_work_ingest_queue(
      file_id,project_id,user_id,status,is_backfill,last_error
    )
    select id,project_id,user_id,
      case when deferred_reason is null then 'queued' else 'waiting_parser' end,
      true,deferred_reason from classified
    on conflict(file_id) do nothing
    returning file_id,status
  ), updated as (
    update public.minds_work_files f
    set index_status=i.status,updated_at=now()
    from inserted i where f.id=i.file_id returning f.id
  )
  select count(*)::integer,
     count(*) filter(where status='waiting_parser')::integer
  into v_found,v_waiting from inserted;

  return jsonb_build_object('discovered',v_found,'waiting_parser',v_waiting,'resumed',v_resumed);
end $function$;
REVOKE ALL ON FUNCTION public.minds_reconcile_work_ingest(p_limit integer, p_docling_ready boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_reconcile_work_ingest(p_limit integer, p_docling_ready boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_commit_work_source_segments(p_user_id uuid, p_project_id uuid, p_file_id uuid, p_source_version text, p_extractor text, p_coverage text, p_locator_class text, p_metadata jsonb, p_segments jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_count integer;
 v_row jsonb;
 v_idx integer;
 v_text text;
 v_kind text;
 v_loc jsonb;
 v_chars integer:=0;
 v_receipt uuid;
begin

  -- Each service-side ingestion is bound to the document author's Office project membership.
  if not exists(select 1 from public.office_projects p
    join public.office_project_members pm on pm.project_id=p.id
    join public.office_members m on m.user_id=pm.user_id
    where p.id=p_project_id and p.status='aktiv' and pm.user_id=p_user_id and m.is_active)
    then raise exception 'office_project_access_denied' using errcode='42501'; end if;
 if not exists(select 1 from public.minds_work_files
   where id=p_file_id and user_id=p_user_id and project_id=p_project_id)
   then raise exception 'source_file_not_owned'; end if;
 if length(coalesce(p_source_version,''))<>64
   or p_source_version!~'^[0-9a-f]{64}$' then raise exception 'invalid_source_version'; end if;
 if p_coverage not in ('complete_text','partial_text') or p_locator_class not in
   ('worksheet_rows','pdf_page','unverified_page') then raise exception 'invalid_coverage'; end if;
 if jsonb_typeof(p_segments)<> 'array' then raise exception 'invalid_segments'; end if;
 v_count:=jsonb_array_length(p_segments);
 if v_count<1 or v_count>250 then raise exception 'segment_count_out_of_bounds'; end if;
 if coalesce(length(p_extractor),0) not between 1 and 100 then raise exception 'invalid_extractor'; end if;
 for v_row in select value from jsonb_array_elements(p_segments) loop
   v_idx:=(v_row->>'segment_no')::integer;
   v_kind:=v_row->>'segment_kind';
   v_text:=v_row->>'content';
   v_loc:=v_row->'locator';
   if v_idx<0 or v_idx>=v_count or v_kind not in
     ('sheet_rows','page_text','unpaged_text') or length(coalesce(v_text,'')) not between 1 and 6500
     or jsonb_typeof(v_loc)<>'object' then raise exception 'invalid_segment'; end if;
   v_chars:=v_chars+length(v_text);
 end loop;
 -- A verified receipt must never be replaced with fewer segments by a retry.
 insert into public.minds_work_source_text_receipts(
  user_id,project_id,file_id,source_version,extractor,coverage,segment_count,content_chars,locator_class,metadata)
 values(p_user_id,p_project_id,p_file_id,p_source_version,p_extractor,p_coverage,v_count,v_chars,p_locator_class,coalesce(p_metadata,'{}'::jsonb))
 on conflict(file_id,source_version) do nothing
 returning id into v_receipt;
 if v_receipt is null then
   return jsonb_build_object('status','already_materialized');
 end if;
 for v_row in select value from jsonb_array_elements(p_segments) loop
   insert into public.minds_work_source_segments(
     user_id,project_id,file_id,source_version,segment_no,segment_kind,locator,content,extractor)
   values(p_user_id,p_project_id,p_file_id,p_source_version,
     (v_row->>'segment_no')::integer,v_row->>'segment_kind',v_row->'locator',v_row->>'content',p_extractor)
   on conflict(file_id,source_version,segment_no) do nothing;
 end loop;
 return jsonb_build_object('status','completed','segments',v_count,'chars',v_chars);
end $function$;
REVOKE ALL ON FUNCTION public.minds_commit_work_source_segments(p_user_id uuid, p_project_id uuid, p_file_id uuid, p_source_version text, p_extractor text, p_coverage text, p_locator_class text, p_metadata jsonb, p_segments jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_commit_work_source_segments(p_user_id uuid, p_project_id uuid, p_file_id uuid, p_source_version text, p_extractor text, p_coverage text, p_locator_class text, p_metadata jsonb, p_segments jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_commit_project_source_extraction(p_user_id uuid, p_project_id uuid, p_file_id uuid, p_source_version text, p_model text, p_referents jsonb, p_claims jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_file public.minds_work_files%rowtype;
  v_ingestion public.minds_project_source_ingestions%rowtype;
  v_ref jsonb;
  v_claim jsonb;
  v_ref_id uuid;
  v_label text;
  v_kind text;
  v_statement text;
  v_claim_type text;
  v_conf numeric;
  v_excerpt text;
  v_referents integer:=0;
  v_claims integer:=0;
begin

  -- Each service-side ingestion is bound to the document author's Office project membership.
  if not exists(select 1 from public.office_projects p
    join public.office_project_members pm on pm.project_id=p.id
    join public.office_members m on m.user_id=pm.user_id
    where p.id=p_project_id and p.status='aktiv' and pm.user_id=p_user_id and m.is_active)
    then raise exception 'office_project_access_denied' using errcode='42501'; end if;
  select * into v_file
  from public.minds_work_files
  where id=p_file_id and user_id=p_user_id and project_id=p_project_id;

  if not found then raise exception 'project_source_file_not_found'; end if;
  if nullif(trim(coalesce(p_source_version,'')),'') is null then raise exception 'source_version_required'; end if;

  select * into v_ingestion
  from public.minds_project_source_ingestions
  where user_id=p_user_id and project_id=p_project_id
    and source_kind='work_file' and source_ref=p_file_id::text and source_version=p_source_version
  for update;

  if found and v_ingestion.status='completed' then
    return jsonb_build_object(
      'status','already_indexed','ingestion_id',v_ingestion.id,
      'referent_count',v_ingestion.referent_count,'claim_count',v_ingestion.claim_count
    );
  end if;

  if not found then
    insert into public.minds_project_source_ingestions(
      user_id,project_id,source_kind,source_ref,source_version,status,model
    ) values (
      p_user_id,p_project_id,'work_file',p_file_id::text,p_source_version,'processing',nullif(p_model,'')
    )
    returning * into v_ingestion;
  else
    update public.minds_project_source_ingestions
    set status='processing',model=nullif(p_model,''),error=null,started_at=now(),completed_at=null
    where id=v_ingestion.id
    returning * into v_ingestion;
  end if;

  for v_ref in select value from jsonb_array_elements(coalesce(p_referents,'[]'::jsonb))
  loop
    v_label:=trim(coalesce(v_ref->>'label',''));
    if v_label='' then continue; end if;
    v_kind:=lower(trim(coalesce(v_ref->>'kind','other')));
    if v_kind not in ('person','organization','building_element','room','system','document','decision','meeting','phase','workstream','other') then
      v_kind:='other';
    end if;

    select id into v_ref_id
    from public.minds_project_referents
    where user_id=p_user_id and project_id=p_project_id and status='active'
      and kind=v_kind and lower(label)=lower(v_label)
    order by created_at asc limit 1;

    if v_ref_id is null then
      insert into public.minds_project_referents(
        user_id,project_id,kind,label,aliases,provenance
      ) values (
        p_user_id,p_project_id,v_kind,left(v_label,240),
        case when jsonb_typeof(v_ref->'aliases')='array' then v_ref->'aliases' else '[]'::jsonb end,
        jsonb_build_object(
          'class','source_first_extraction',
          'source_file_id',p_file_id,
          'source_version',p_source_version,
          'ingestion_id',v_ingestion.id,
          'model',p_model
        )
      ) returning id into v_ref_id;
      v_referents:=v_referents+1;
    end if;
    v_ref_id:=null;
  end loop;

  for v_claim in select value from jsonb_array_elements(coalesce(p_claims,'[]'::jsonb))
  loop
    v_statement:=trim(coalesce(v_claim->>'statement',''));
    if v_statement='' then continue; end if;
    v_claim_type:=lower(trim(coalesce(v_claim->>'claim_type','fact')));
    if v_claim_type not in ('fact','decision','requirement','deadline','dependency','open_question','assumption','constraint','other') then
      v_claim_type:='fact';
    end if;
    begin v_conf:=greatest(0,least(1,coalesce((v_claim->>'confidence')::numeric,0.7)));
    exception when others then v_conf:=0.7; end;
    v_excerpt:=nullif(trim(coalesce(v_claim->>'evidence_excerpt','')),'');

    v_ref_id:=null;
    v_label:=trim(coalesce(v_claim->>'referent_label',''));
    if v_label<>'' then
      select id into v_ref_id
      from public.minds_project_referents
      where user_id=p_user_id and project_id=p_project_id and status='active'
        and lower(label)=lower(v_label)
      order by created_at asc limit 1;
    end if;

    insert into public.minds_work_claims(
      user_id,project_id,claim_type,statement,subject,topic,discipline,status,confidence,
      provenance_class,referent_id,author_kind,model_kind,learned_at,metadata
    ) values (
      p_user_id,p_project_id,v_claim_type,left(v_statement,5000),
      nullif(left(trim(coalesce(v_claim->>'subject','')),500),''),
      nullif(left(trim(coalesce(v_claim->>'topic','')),500),''),
      nullif(left(trim(coalesce(v_claim->>'discipline','')),240),''),
      'proposed',v_conf,'project_source',v_ref_id,'external',null,now(),
      jsonb_build_object(
        'source_first',true,
        'source_file_id',p_file_id,
        'source_version',p_source_version,
        'ingestion_id',v_ingestion.id
      )
    )
    returning id into v_ref_id;

    insert into public.minds_work_evidence(
      user_id,project_id,claim_id,source_kind,source_file_id,locator,excerpt,stance,trust_level,metadata
    ) values (
      p_user_id,p_project_id,v_ref_id,'work_file',p_file_id,
      jsonb_build_object('extraction','source_first','source_version',p_source_version),
      v_excerpt,'supports','reported',
      jsonb_build_object('ingestion_id',v_ingestion.id,'model',p_model)
    );

    v_claims:=v_claims+1;
  end loop;

  update public.minds_project_source_ingestions
  set status='completed',referent_count=v_referents,claim_count=v_claims,
      extraction_metadata=jsonb_build_object('source_file_id',p_file_id,'source_version',p_source_version),
      completed_at=now()
  where id=v_ingestion.id
  returning * into v_ingestion;

  return jsonb_build_object(
    'status','completed','ingestion_id',v_ingestion.id,
    'referent_count',v_referents,'claim_count',v_claims
  );
exception when others then
  if v_ingestion.id is not null then
    update public.minds_project_source_ingestions
    set status='failed',error=left(sqlerrm,1600),completed_at=now()
    where id=v_ingestion.id;
  end if;
  raise;
end $function$;
REVOKE ALL ON FUNCTION public.minds_commit_project_source_extraction(p_user_id uuid, p_project_id uuid, p_file_id uuid, p_source_version text, p_model text, p_referents jsonb, p_claims jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_commit_project_source_extraction(p_user_id uuid, p_project_id uuid, p_file_id uuid, p_source_version text, p_model text, p_referents jsonb, p_claims jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_commit_project_source_comparison(p_user_id uuid, p_project_id uuid, p_ingestion_id uuid, p_baseline_revision_id uuid, p_baseline_fingerprint text, p_model text, p_coverage jsonb, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_ingestion public.minds_project_source_ingestions%rowtype;
  v_comparison public.minds_project_source_comparisons%rowtype;
  v_item jsonb;
  v_source uuid;
  v_target uuid;
  v_verdict text;
  v_relation text;
  v_relation_id uuid;
  v_conf numeric;
  v_rationale text;
  v_count integer:=0;
  v_relations integer:=0;
begin

  -- Each service-side ingestion is bound to the document author's Office project membership.
  if not exists(select 1 from public.office_projects p
    join public.office_project_members pm on pm.project_id=p.id
    join public.office_members m on m.user_id=pm.user_id
    where p.id=p_project_id and p.status='aktiv' and pm.user_id=p_user_id and m.is_active)
    then raise exception 'office_project_access_denied' using errcode='42501'; end if;
  if p_baseline_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_baseline_fingerprint';
  end if;

  select * into v_ingestion
  from public.minds_project_source_ingestions
  where id=p_ingestion_id and user_id=p_user_id and project_id=p_project_id
    and status='completed';

  if not found then raise exception 'completed_ingestion_not_found'; end if;

  if p_baseline_revision_id is not null and not exists (
    select 1 from public.minds_project_model_revisions r
    where r.id=p_baseline_revision_id and r.user_id=p_user_id and r.project_id=p_project_id
  ) then raise exception 'baseline_revision_mismatch'; end if;

  select * into v_comparison
  from public.minds_project_source_comparisons
  where user_id=p_user_id and project_id=p_project_id
    and ingestion_id=p_ingestion_id and baseline_fingerprint=p_baseline_fingerprint;

  if found and v_comparison.status='completed' then
    return jsonb_build_object(
      'status','already_compared',
      'comparison_id',v_comparison.id,
      'compared_claim_count',v_comparison.compared_claim_count,
      'relation_count',v_comparison.relation_count,
      'baseline_fingerprint',v_comparison.baseline_fingerprint
    );
  end if;

  insert into public.minds_project_source_comparisons(
    user_id,project_id,ingestion_id,baseline_revision_id,baseline_fingerprint,model,status
  ) values (
    p_user_id,p_project_id,p_ingestion_id,p_baseline_revision_id,p_baseline_fingerprint,
    nullif(trim(coalesce(p_model,'')),''),'completed'
  )
  on conflict (user_id,project_id,ingestion_id,baseline_fingerprint)
  do update set
    baseline_revision_id=excluded.baseline_revision_id,
    model=excluded.model,
    status='completed',
    error=null
  returning * into v_comparison;

  delete from public.minds_project_source_comparison_items
  where comparison_id=v_comparison.id and user_id=p_user_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb))
  loop
    begin v_source=(v_item->>'source_claim_id')::uuid;
    exception when others then continue; end;

    if not exists (
      select 1 from public.minds_work_claims c
      where c.id=v_source and c.user_id=p_user_id and c.project_id=p_project_id
        and c.metadata->>'ingestion_id'=p_ingestion_id::text
    ) then continue; end if;

    v_target:=null;
    begin
      if nullif(trim(coalesce(v_item->>'target_claim_id','')),'') is not null then
        v_target=(v_item->>'target_claim_id')::uuid;
      end if;
    exception when others then v_target:=null; end;

    if v_target is not null and not exists (
      select 1 from public.minds_work_claims c
      where c.id=v_target and c.project_id=p_project_id
        and c.id<>v_source
        and coalesce(c.metadata->>'ingestion_id','')<>p_ingestion_id::text
    ) then v_target:=null; end if;

    v_verdict:=lower(trim(coalesce(v_item->>'verdict','unclear')));
    if v_verdict not in ('aligned','contradicts','modifies','adds','unclear') then
      v_verdict:='unclear';
    end if;
    if v_target is null and v_verdict in ('aligned','contradicts','modifies') then
      v_verdict:='unclear';
    end if;

    begin v_conf:=greatest(0,least(1,coalesce((v_item->>'confidence')::numeric,0.7)));
    exception when others then v_conf:=0.7; end;
    v_rationale:=nullif(left(trim(coalesce(v_item->>'rationale','')),1600),'');

    v_relation:=case v_verdict
      when 'aligned' then 'supports'
      when 'contradicts' then 'contradicts'
      when 'modifies' then 'qualifies'
      else null
    end;
    v_relation_id:=null;

    if v_relation is not null and v_target is not null then
      select id into v_relation_id
      from public.minds_work_claim_relations
      where user_id=p_user_id and project_id=p_project_id
        and source_claim_id=v_source and target_claim_id=v_target
        and relation=v_relation and status in ('proposed','confirmed')
      order by created_at desc limit 1;

      if v_relation_id is null then
        insert into public.minds_work_claim_relations(
          user_id,project_id,source_claim_id,target_claim_id,relation,status,
          author_kind,confidence,provenance
        ) values (
          p_user_id,p_project_id,v_source,v_target,v_relation,'proposed',
          'isabella',v_conf,
          jsonb_build_object(
            'class','project_source_comparison',
            'comparison_id',v_comparison.id,
            'ingestion_id',p_ingestion_id,
            'baseline_revision_id',p_baseline_revision_id,
            'baseline_fingerprint',p_baseline_fingerprint,
            'model',p_model
          )
        ) returning id into v_relation_id;
        v_relations:=v_relations+1;
      end if;
    end if;

    insert into public.minds_project_source_comparison_items(
      user_id,project_id,comparison_id,source_claim_id,target_claim_id,
      verdict,confidence,rationale,relation_id
    ) values (
      p_user_id,p_project_id,v_comparison.id,v_source,v_target,
      v_verdict,v_conf,v_rationale,v_relation_id
    );
    v_count:=v_count+1;
  end loop;

  update public.minds_project_source_comparisons
  set compared_claim_count=v_count,relation_count=v_relations,
      metadata=jsonb_build_object(
        'comparison_is_inference',true,
        'changes_claim_authority',false,
        'coverage',case when jsonb_typeof(p_coverage)='object' then p_coverage else '{}'::jsonb end
      )
  where id=v_comparison.id
  returning * into v_comparison;

  return jsonb_build_object(
    'status','completed',
    'comparison_id',v_comparison.id,
    'compared_claim_count',v_count,
    'relation_count',v_relations,
    'baseline_fingerprint',p_baseline_fingerprint
  );
end $function$;
REVOKE ALL ON FUNCTION public.minds_commit_project_source_comparison(p_user_id uuid, p_project_id uuid, p_ingestion_id uuid, p_baseline_revision_id uuid, p_baseline_fingerprint text, p_model text, p_coverage jsonb, p_items jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_commit_project_source_comparison(p_user_id uuid, p_project_id uuid, p_ingestion_id uuid, p_baseline_revision_id uuid, p_baseline_fingerprint text, p_model text, p_coverage jsonb, p_items jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_publish_project_model_revision_from_comparison(p_user_id uuid, p_comparison_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_comparison public.minds_project_source_comparisons%rowtype;
  v_ingestion public.minds_project_source_ingestions%rowtype;
  v_parent_id uuid;
  v_revision_id uuid;
  v_existing_id uuid;
  v_trigger_key text;
  v_elements integer:=0;
  v_variants integer:=0;
  v_rows integer:=0;
  v_perimeter jsonb:='[]'::jsonb;
begin
  select * into v_comparison
  from public.minds_project_source_comparisons
  where id=p_comparison_id and user_id=p_user_id and status='completed';

  if not found then raise exception 'completed_comparison_not_found'; end if;
  if not exists(select 1 from public.office_projects p
    join public.office_project_members pm on pm.project_id=p.id
    join public.office_members m on m.user_id=pm.user_id
    where p.id=v_comparison.project_id and p.status='aktiv'
      and pm.user_id=p_user_id and m.is_active)
    then raise exception 'office_project_access_denied' using errcode='42501'; end if;


  select * into v_ingestion
  from public.minds_project_source_ingestions
  where id=v_comparison.ingestion_id and user_id=p_user_id
    and project_id=v_comparison.project_id and status='completed';

  if not found then raise exception 'completed_ingestion_not_found'; end if;

  v_trigger_key:='source_comparison:'||v_comparison.id::text;

  perform pg_advisory_xact_lock(hashtextextended(v_comparison.project_id::text,0));

  select id into v_existing_id
  from public.minds_project_model_revisions
  where project_id=v_comparison.project_id
    and trigger_key=v_trigger_key
  order by created_at desc limit 1;

  if v_existing_id is not null then
    return jsonb_build_object(
      'status','already_published',
      'revision_id',v_existing_id,
      'trigger_key',v_trigger_key
    );
  end if;

  select id into v_parent_id
  from public.minds_project_model_revisions
  where project_id=v_comparison.project_id
    and status='current'
  order by created_at desc limit 1
  for update;

  select coalesce(jsonb_agg(jsonb_build_object(
    'source_class',p.source_class,
    'observation_mode',p.observation_mode,
    'readability',p.readability,
    'coverage',p.coverage,
    'freshness_minutes',p.freshness_minutes,
    'last_checked_at',p.last_checked_at,
    'last_seen_at',p.last_seen_at
  ) order by p.source_class),'[]'::jsonb)
  into v_perimeter
  from public.minds_project_perimeter p
  where p.project_id=v_comparison.project_id;

  insert into public.minds_project_model_revisions(
    user_id,project_id,parent_revision_id,trigger_kind,trigger_key,reason,status,
    coverage_snapshot,metadata
  ) values (
    p_user_id,v_comparison.project_id,v_parent_id,'source',v_trigger_key,
    'Source comparison '||v_comparison.id::text,
    'draft',
    jsonb_build_object(
      'comparison',coalesce(v_comparison.metadata->'coverage','{}'::jsonb),
      'perimeter',v_perimeter
    ),
    jsonb_build_object(
      'writer_version','project_model_revision_v01',
      'comparison_id',v_comparison.id,
      'ingestion_id',v_ingestion.id,
      'source_kind',v_ingestion.source_kind,
      'source_ref',v_ingestion.source_ref,
      'source_version',v_ingestion.source_version,
      'baseline_fingerprint',v_comparison.baseline_fingerprint,
      'authority_mutation',false
    )
  )
  returning id into v_revision_id;

  -- Referent identity is useful for navigation but remains an inferred model element.
  insert into public.minds_project_model_elements(
    user_id,project_id,revision_id,element_kind,element_ref,role,metadata
  )
  select
    p_user_id,v_comparison.project_id,v_revision_id,'referent',r.id::text,'inferred',
    jsonb_build_object('status',r.status,'provenance',r.provenance)
  from public.minds_project_referents r
  where r.project_id=v_comparison.project_id and r.status='active'
  on conflict do nothing;
  get diagnostics v_rows=row_count;
  v_elements:=v_elements+v_rows;

  -- Claim authority is projected, never changed: confirmed -> accepted; proposed/disputed -> inferred.
  insert into public.minds_project_model_elements(
    user_id,project_id,revision_id,element_kind,element_ref,role,metadata
  )
  select
    p_user_id,v_comparison.project_id,v_revision_id,'claim',c.id::text,
    case when c.status='confirmed' then 'accepted' else 'inferred' end,
    jsonb_build_object(
      'claim_status',c.status,
      'author_kind',c.author_kind,
      'provenance_class',c.provenance_class,
      'model_kind',c.model_kind
    )
  from public.minds_work_claims c
  where c.user_id=p_user_id and c.project_id=v_comparison.project_id
    and c.status in ('confirmed','proposed','disputed')
  on conflict do nothing;
  get diagnostics v_rows=row_count;
  v_elements:=v_elements+v_rows;

  insert into public.minds_project_model_elements(
    user_id,project_id,revision_id,element_kind,element_ref,role,metadata
  )
  select
    p_user_id,v_comparison.project_id,v_revision_id,'relation',r.id::text,
    case when r.status='confirmed' then 'accepted' else 'inferred' end,
    jsonb_build_object(
      'relation',r.relation,
      'relation_status',r.status,
      'author_kind',r.author_kind,
      'confidence',r.confidence
    )
  from public.minds_work_claim_relations r
  where r.project_id=v_comparison.project_id
    and r.status in ('proposed','confirmed')
  on conflict do nothing;
  get diagnostics v_rows=row_count;
  v_elements:=v_elements+v_rows;

  -- Open canonical movements survive unrelated source updates because each revision re-projects them.
  insert into public.minds_project_model_elements(
    user_id,project_id,revision_id,element_kind,element_ref,role,metadata
  )
  select
    p_user_id,v_comparison.project_id,v_revision_id,'movement',
    m.source_kind||':'||m.source_ref,'accepted',
    jsonb_build_object(
      'source_kind',m.source_kind,
      'source_ref',m.source_ref,
      'actor_kind',m.actor_kind,
      'status',m.status,
      'due_at',m.due_at,
      'anchor_kind',m.anchor_kind
    )
  from public.minds_project_movements_v1 m
  where m.user_id=p_user_id and m.project_id=v_comparison.project_id
    and m.status not in ('completed','archived','cancelled','failed','occurred','not_occurred','resolved','rejected')
  on conflict do nothing;
  get diagnostics v_rows=row_count;
  v_elements:=v_elements+v_rows;

  -- Unclear comparison findings and unobserved/illegible perimeter are explicit gaps, not silently resolved.
  insert into public.minds_project_model_elements(
    user_id,project_id,revision_id,element_kind,element_ref,role,metadata
  )
  select
    p_user_id,v_comparison.project_id,v_revision_id,'gap',
    'comparison_item:'||i.id::text,'gap',
    jsonb_build_object(
      'comparison_item_id',i.id,
      'source_claim_id',i.source_claim_id,
      'target_claim_id',i.target_claim_id,
      'verdict',i.verdict,
      'confidence',i.confidence
    )
  from public.minds_project_source_comparison_items i
  where i.user_id=p_user_id and i.project_id=v_comparison.project_id
    and i.comparison_id=v_comparison.id and i.verdict='unclear'
  on conflict do nothing;
  get diagnostics v_rows=row_count;
  v_elements:=v_elements+v_rows;

  insert into public.minds_project_model_elements(
    user_id,project_id,revision_id,element_kind,element_ref,role,metadata
  )
  select
    p_user_id,v_comparison.project_id,v_revision_id,'gap',
    'perimeter:'||p.source_class,'gap',
    jsonb_build_object(
      'source_class',p.source_class,
      'observation_mode',p.observation_mode,
      'readability',p.readability,
      'coverage',p.coverage,
      'last_checked_at',p.last_checked_at
    )
  from public.minds_project_perimeter p
  where p.project_id=v_comparison.project_id
    and (
      p.observation_mode='unobserved'
      or p.readability in ('unreadable','unknown')
      or p.coverage in ('missing','unknown')
    )
  on conflict do nothing;
  get diagnostics v_rows=row_count;
  v_elements:=v_elements+v_rows;

  -- Contradictions and modifications remain open alternatives; the writer does not choose a winner.
  insert into public.minds_project_model_variants(
    user_id,project_id,revision_id,comparison_item_id,variant_kind,status,
    source_claim_id,target_claim_id,confidence,rationale,provenance
  )
  select
    p_user_id,v_comparison.project_id,v_revision_id,i.id,
    case when i.verdict='contradicts' then 'contradiction' else 'modification' end,
    'open',i.source_claim_id,i.target_claim_id,i.confidence,i.rationale,
    jsonb_build_object(
      'class','project_model_variant',
      'comparison_id',v_comparison.id,
      'baseline_fingerprint',v_comparison.baseline_fingerprint,
      'authority_mutation',false
    )
  from public.minds_project_source_comparison_items i
  where i.user_id=p_user_id and i.project_id=v_comparison.project_id
    and i.comparison_id=v_comparison.id
    and i.verdict in ('contradicts','modifies')
    and i.target_claim_id is not null
  on conflict do nothing;
  get diagnostics v_variants=row_count;

  if v_parent_id is not null then
    update public.minds_project_model_revisions
    set status='superseded'
    where id=v_parent_id and user_id=p_user_id and status='current';
  end if;

  update public.minds_project_model_revisions
  set status='current',published_at=now()
  where id=v_revision_id and user_id=p_user_id and status='draft';

  return jsonb_build_object(
    'status','published',
    'revision_id',v_revision_id,
    'parent_revision_id',v_parent_id,
    'trigger_key',v_trigger_key,
    'element_count',v_elements,
    'variant_count',v_variants,
    'authority_mutation',false
  );
end $function$;
REVOKE ALL ON FUNCTION public.minds_publish_project_model_revision_from_comparison(p_user_id uuid, p_comparison_id uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_publish_project_model_revision_from_comparison(p_user_id uuid, p_comparison_id uuid) TO service_role;
commit;
