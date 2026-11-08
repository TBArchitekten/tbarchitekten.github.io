-- Office Phase 1: Window action and review RPCs (no execution or migration applied).
-- Privileges are restricted to verified owner calls and the server service role.
-- D1 requires canonical creation receipts and bounded Undo; D2 stays confirm-only.
-- Catalog DDL only; no names of customers/colleagues, personal records or secrets.
begin;
CREATE OR REPLACE FUNCTION public.isabella_next_routine_run(p_schedule jsonb, p_timezone text, p_after timestamp with time zone DEFAULT now())
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  v_kind text := coalesce(p_schedule->>'kind','daily');
  v_time time := coalesce(nullif(p_schedule->>'time','')::time,'08:00'::time);
  v_weekdays int[] := coalesce(array(select jsonb_array_elements_text(coalesce(p_schedule->'weekdays','[]'::jsonb))::int), '{}'::int[]);
  v_local_after timestamp;
  v_date date;
  v_candidate timestamp;
  i int;
begin
  v_local_after := p_after at time zone p_timezone;

  if v_kind = 'once' then
    v_date := nullif(p_schedule->>'date','')::date;
    if v_date is null then return null; end if;
    v_candidate := v_date + v_time;
    if v_candidate > v_local_after then
      return v_candidate at time zone p_timezone;
    end if;
    return null;
  end if;

  for i in 0..14 loop
    v_date := v_local_after::date + i;
    if v_kind = 'daily'
       or (v_kind = 'weekly' and extract(dow from v_date)::int = any(v_weekdays)) then
      v_candidate := v_date + v_time;
      if v_candidate > v_local_after then
        return v_candidate at time zone p_timezone;
      end if;
    end if;
  end loop;
  return null;
exception when others then
  return null;
end;
$function$;
REVOKE ALL ON FUNCTION public.isabella_next_routine_run(p_schedule jsonb, p_timezone text, p_after timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.isabella_next_routine_run(p_schedule jsonb, p_timezone text, p_after timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.isabella_next_routine_run(p_schedule jsonb, p_timezone text, p_after timestamp with time zone) TO authenticated;

CREATE OR REPLACE FUNCTION public.isabella_routines_set_next_run()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  if new.enabled then
    new.next_run_at := public.isabella_next_routine_run(new.schedule,new.timezone,now());
  else
    new.next_run_at := null;
  end if;
  return new;
end;
$function$;
REVOKE ALL ON FUNCTION public.isabella_routines_set_next_run() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.isabella_routines_set_next_run() TO service_role;

CREATE OR REPLACE FUNCTION public.minds_invalidate_memory_lineage(p_user uuid, p_source_kind text, p_source_id text, p_reason text DEFAULT 'user_forget'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz:=now();
  v_memories integer:=0;
  v_claims integer:=0;
  v_entities integer:=0;
  v_links integer:=0;
begin
  if p_user is null or nullif(trim(coalesce(p_source_kind,'')),'') is null or nullif(trim(coalesce(p_source_id,'')),'') is null then
    raise exception 'invalid_forget_source';
  end if;

  insert into public.minds_memory_forget_tombstones(user_id,source_kind,source_id,reason,forgotten_at)
  values(p_user,p_source_kind,p_source_id,coalesce(nullif(trim(p_reason),''),'user_forget'),v_now)
  on conflict(user_id,source_kind,source_id)
  do update set reason=excluded.reason,forgotten_at=excluded.forgotten_at;

  with recursive affected(kind,id) as (
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    where l.user_id=p_user and l.source_kind=p_source_kind and l.source_id=p_source_id
    union
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    join affected a on l.source_kind=a.kind and l.source_id=a.id
    where l.user_id=p_user
  )
  insert into public.minds_memory_forget_tombstones(user_id,source_kind,source_id,reason,forgotten_at)
  select p_user,a.kind,a.id,'derived_from_forgotten_source',v_now from affected a
  on conflict(user_id,source_kind,source_id)
  do update set reason=excluded.reason,forgotten_at=excluded.forgotten_at;

  with recursive affected(kind,id) as (
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    where l.user_id=p_user and l.source_kind=p_source_kind and l.source_id=p_source_id
    union
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    join affected a on l.source_kind=a.kind and l.source_id=a.id
    where l.user_id=p_user
  )
  update public.minds_memory_lineage l
  set invalidated_at=v_now,invalidation_reason=coalesce(nullif(trim(p_reason),''),'user_forget')
  where l.user_id=p_user and (
    (l.source_kind=p_source_kind and l.source_id=p_source_id)
    or exists(select 1 from affected a where a.kind=l.child_kind and a.id=l.child_id)
  );

  with recursive affected(kind,id) as (
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    where l.user_id=p_user and l.source_kind=p_source_kind and l.source_id=p_source_id
    union
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    join affected a on l.source_kind=a.kind and l.source_id=a.id
    where l.user_id=p_user
  )
  update public.isabella_memories m
  set status='archived',
      metadata=coalesce(m.metadata,'{}'::jsonb)||jsonb_build_object('forgotten_at',v_now,'forgotten_reason',coalesce(nullif(trim(p_reason),''),'user_forget')),
      updated_at=v_now
  where m.user_id=p_user and (
    (p_source_kind='memory' and m.id::text=p_source_id)
    or exists(select 1 from affected a where a.kind='memory' and a.id=m.id::text)
  );
  get diagnostics v_memories=row_count;

  with recursive affected(kind,id) as (
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    where l.user_id=p_user and l.source_kind=p_source_kind and l.source_id=p_source_id
    union
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    join affected a on l.source_kind=a.kind and l.source_id=a.id
    where l.user_id=p_user
  )
  update public.isabella_model_claims c
  set status='stale',
      metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object('forgotten_at',v_now,'forgotten_reason',coalesce(nullif(trim(p_reason),''),'user_forget')),
      last_seen_at=v_now
  where c.user_id=p_user and (
    (p_source_kind='model_claim' and c.id::text=p_source_id)
    or exists(select 1 from affected a where a.kind='model_claim' and a.id=c.id::text)
  );
  get diagnostics v_claims=row_count;

  with recursive affected(kind,id) as (
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    where l.user_id=p_user and l.source_kind=p_source_kind and l.source_id=p_source_id
    union
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    join affected a on l.source_kind=a.kind and l.source_id=a.id
    where l.user_id=p_user
  )
  update public.isabella_entities e
  set metadata=coalesce(e.metadata,'{}'::jsonb)||jsonb_build_object('forgotten_at',v_now,'forgotten_reason',coalesce(nullif(trim(p_reason),''),'user_forget')),
      updated_at=v_now
  where e.user_id=p_user and (
    (p_source_kind='entity' and e.id::text=p_source_id)
    or exists(select 1 from affected a where a.kind='entity' and a.id=e.id::text)
  );
  get diagnostics v_entities=row_count;

  with recursive affected(kind,id) as (
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    where l.user_id=p_user and l.source_kind=p_source_kind and l.source_id=p_source_id
    union
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    join affected a on l.source_kind=a.kind and l.source_id=a.id
    where l.user_id=p_user
  )
  update public.isabella_entity_links e
  set metadata=coalesce(e.metadata,'{}'::jsonb)||jsonb_build_object('forgotten_at',v_now,'forgotten_reason',coalesce(nullif(trim(p_reason),''),'user_forget')),
      updated_at=v_now
  where e.user_id=p_user and (
    (p_source_kind='entity_link' and e.id::text=p_source_id)
    or exists(select 1 from affected a where a.kind='entity_link' and a.id=e.id::text)
  );
  get diagnostics v_links=row_count;

  with recursive affected(kind,id) as (
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    where l.user_id=p_user and l.source_kind=p_source_kind and l.source_id=p_source_id
    union
    select l.child_kind,l.child_id
    from public.minds_memory_lineage l
    join affected a on l.source_kind=a.kind and l.source_id=a.id
    where l.user_id=p_user
  )
  delete from public.isabella_embeddings emb
  where emb.user_id=p_user and (
    (p_source_kind='memory' and emb.source_type='memory' and emb.source_id=p_source_id)
    or (p_source_kind='conversation' and emb.source_type='conversation' and exists(
      select 1 from public.conversation_messages cm
      where cm.user_id=p_user and cm.conversation_id::text=p_source_id and cm.id::text=emb.source_id
    ))
    or exists(select 1 from affected a where a.kind='memory' and emb.source_type='memory' and emb.source_id=a.id)
  );

  return jsonb_build_object(
    'status','forgotten',
    'source_kind',p_source_kind,
    'source_id',p_source_id,
    'memories_archived',v_memories,
    'claims_staled',v_claims,
    'entities_hidden',v_entities,
    'entity_links_hidden',v_links,
    'forgotten_at',v_now
  );
end;
$function$;
REVOKE ALL ON FUNCTION public.minds_invalidate_memory_lineage(p_user uuid, p_source_kind text, p_source_id text, p_reason text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_invalidate_memory_lineage(p_user uuid, p_source_kind text, p_source_id text, p_reason text) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_record_shadow_decision(p_user uuid, p_request_id uuid, p_action text, p_candidate jsonb, p_context jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare d public.minds_shadow_decisions;
begin
  if p_user is null or p_request_id is null or length(trim(coalesce(p_action,'')))=0 then raise exception 'Invalid shadow decision';end if;
  if jsonb_typeof(coalesce(p_candidate,'{}'::jsonb))<>'object' or jsonb_typeof(coalesce(p_context,'{}'::jsonb))<>'object' then raise exception 'Invalid shadow payload';end if;
  insert into public.minds_shadow_decisions(user_id,agent,request_id,action,proposal_kind,policy_mode,candidate,context)
  values(p_user,case when coalesce(p_candidate->>'agent','isabella') in('isabella','sofia','minds') then coalesce(p_candidate->>'agent','isabella') else 'isabella' end,p_request_id,trim(p_action),coalesce(nullif(trim(p_candidate->>'kind'),''),'action'),'confirm',p_candidate,coalesce(p_context,'{}'::jsonb))
  on conflict(user_id,request_id) do nothing returning * into d;
  if not found then select * into d from public.minds_shadow_decisions where user_id=p_user and request_id=p_request_id;end if;
  return to_jsonb(d);
end $function$;
REVOKE ALL ON FUNCTION public.minds_record_shadow_decision(p_user uuid, p_request_id uuid, p_action text, p_candidate jsonb, p_context jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_record_shadow_decision(p_user uuid, p_request_id uuid, p_action text, p_candidate jsonb, p_context jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_admit_shadow_decision(p_user uuid, p_request_id uuid, p_action text, p_candidate jsonb, p_context jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  d public.minds_shadow_decisions;
  existing public.minds_shadow_decisions;
  v_kind text:=coalesce(nullif(trim(p_candidate->>'kind'),''),'action');
  v_action text:=trim(coalesce(p_action,''));
  v_run_id text:=nullif(trim(coalesce(p_context->>'run_id','')),'');
  v_scope text:=coalesce(
    nullif(p_context->'autonomy_class'->>'scope_key',''),
    nullif(p_context->>'project',''),
    'unscoped'
  );
  v_direct text:=case when coalesce((p_context->>'direct_request')::boolean,false) then 'direct' else 'inferred' end;
  v_tainted text:=case when coalesce((p_context->>'source_tainted')::boolean,false) then 'tainted' else 'clean' end;
  v_fingerprint text;
  v_target uuid;
  v_noop boolean:=false;
  v_reason text:=null;
begin
  if p_user is null or p_request_id is null or v_action='' then
    raise exception 'Invalid shadow decision';
  end if;
  if jsonb_typeof(coalesce(p_candidate,'{}'::jsonb))<>'object'
     or jsonb_typeof(coalesce(p_context,'{}'::jsonb))<>'object' then
    raise exception 'Invalid shadow payload';
  end if;

  v_fingerprint:=md5(
    v_action||'|'||v_kind||'|'||
    ((p_candidate-'request_id'-'mission_request_id')::text)||'|'||
    v_scope||'|'||v_direct||'|'||v_tainted
  );

  perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||coalesce(v_run_id,'none')||':'||v_fingerprint,0));

  select * into d
  from public.minds_shadow_decisions
  where user_id=p_user and request_id=p_request_id
  limit 1;
  if found then
    return jsonb_build_object('status','already_recorded','decision',to_jsonb(d),'reason','same_request_id');
  end if;

  -- Safe low-value suppression: do not ask la persona to confirm a state that already exists.
  if v_action in ('complete_task','archive_task') and coalesce(p_candidate->>'target_id','') ~* '^[0-9a-f-]{36}$' then
    v_target:=(p_candidate->>'target_id')::uuid;
    if v_action='complete_task' then
      select (completed_at is not null) into v_noop
      from public.isabella_tasks
      where id=v_target and user_id=p_user;
      if coalesce(v_noop,false) then v_reason:='task_already_completed'; end if;
    elsif v_action='archive_task' then
      select (archived_at is not null) into v_noop
      from public.isabella_tasks
      where id=v_target and user_id=p_user;
      if coalesce(v_noop,false) then v_reason:='task_already_archived'; end if;
    end if;
  end if;

  if v_reason is not null then
    insert into public.minds_review_admission_events(
      user_id,request_id,action,proposal_kind,outcome,reason_code,semantic_fingerprint,metadata
    ) values (
      p_user,p_request_id,v_action,v_kind,'suppressed',v_reason,v_fingerprint,
      jsonb_build_object(
        'target_id',p_candidate->>'target_id',
        'title',left(coalesce(p_candidate->>'title',''),500),
        'run_id',v_run_id,
        'scope',v_scope,
        'directness',v_direct,
        'reversible',true,
        'reissue_if_state_changes',true,
        'authority_changed',false
      )
    );
    return jsonb_build_object(
      'status','suppressed',
      'reason',v_reason,
      'semantic_fingerprint',v_fingerprint,
      'authority_changed',false
    );
  end if;

  -- Semantic dedupe is deliberately limited to one agent run.
  -- Repeating the same request in a later turn remains a new user act and is not silently swallowed.
  if v_run_id is not null then
    select * into existing
    from public.minds_shadow_decisions s
    where s.user_id=p_user
      and s.status='pending'
      and s.admission_fingerprint=v_fingerprint
      and s.context->>'run_id'=v_run_id
    order by s.created_at asc
    limit 1;

    if found then
      insert into public.minds_review_admission_events(
        user_id,request_id,action,proposal_kind,outcome,reason_code,semantic_fingerprint,
        existing_decision_id,metadata
      ) values (
        p_user,p_request_id,v_action,v_kind,'duplicate','same_run_semantic_duplicate',v_fingerprint,
        existing.id,
        jsonb_build_object(
          'run_id',v_run_id,
          'scope',v_scope,
          'directness',v_direct,
          'authority_changed',false
        )
      );
      return jsonb_build_object(
        'status','duplicate',
        'reason','same_run_semantic_duplicate',
        'decision',to_jsonb(existing),
        'authority_changed',false
      );
    end if;
  end if;

  insert into public.minds_shadow_decisions(
    user_id,agent,request_id,action,proposal_kind,policy_mode,candidate,context,admission_fingerprint
  ) values (
    p_user,
    case when coalesce(p_candidate->>'agent','isabella') in ('isabella','sofia','minds')
      then coalesce(p_candidate->>'agent','isabella') else 'isabella' end,
    p_request_id,v_action,v_kind,'confirm',p_candidate,coalesce(p_context,'{}'::jsonb),v_fingerprint
  )
  returning * into d;

  insert into public.minds_review_admission_events(
    user_id,request_id,action,proposal_kind,outcome,reason_code,semantic_fingerprint,
    existing_decision_id,metadata
  ) values (
    p_user,p_request_id,v_action,v_kind,'admitted','review_required',v_fingerprint,d.id,
    jsonb_build_object(
      'run_id',v_run_id,
      'scope',v_scope,
      'directness',v_direct,
      'source_tainted',coalesce((p_context->>'source_tainted')::boolean,false),
      'authority_changed',false
    )
  );

  return jsonb_build_object(
    'status','admitted',
    'decision',to_jsonb(d),
    'semantic_fingerprint',v_fingerprint,
    'authority_changed',false
  );
exception
  when unique_violation then
    select * into d from public.minds_shadow_decisions
    where user_id=p_user and request_id=p_request_id limit 1;
    if found then
      return jsonb_build_object('status','already_recorded','decision',to_jsonb(d),'reason','same_request_id');
    end if;
    raise;
end $function$;
REVOKE ALL ON FUNCTION public.minds_admit_shadow_decision(p_user uuid, p_request_id uuid, p_action text, p_candidate jsonb, p_context jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_admit_shadow_decision(p_user uuid, p_request_id uuid, p_action text, p_candidate jsonb, p_context jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_resolve_shadow_decision(p_request_id uuid, p_outcome text, p_reviewed jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();d public.minds_shadow_decisions;fields jsonb;next_status text;
begin
 if u is null or p_request_id is null or p_outcome is null or p_outcome not in ('accepted','rejected') then raise exception 'Invalid shadow outcome';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,70));
 select * into d from public.minds_shadow_decisions where user_id=u and request_id=p_request_id for update;
 if not found then return jsonb_build_object('status','missing');end if;
 if d.status<>'pending' then return to_jsonb(d);end if;
 if jsonb_typeof(p_reviewed) is distinct from 'object' then raise exception 'Invalid reviewed candidate';end if;
 fields:=minds_private.shadow_changed_fields(d.candidate,p_reviewed);
 next_status:=case when p_outcome='rejected' then 'rejected' when jsonb_array_length(fields)>0 then 'edited' else 'accepted' end;
 update public.minds_shadow_decisions set status=next_status,reviewed_candidate=p_reviewed,
  context=context||jsonb_build_object('verified_changed_fields',fields),resolved_at=now(),updated_at=now() where id=d.id returning * into d;
 return to_jsonb(d);
end $function$;
REVOKE ALL ON FUNCTION public.minds_resolve_shadow_decision(p_request_id uuid, p_outcome text, p_reviewed jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_resolve_shadow_decision(p_request_id uuid, p_outcome text, p_reviewed jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_resolve_shadow_decision(p_request_id uuid, p_outcome text, p_reviewed jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_commit_reviewed_task_create_v01(p_request_id uuid, p_reviewed jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_user uuid:=auth.uid();
 v_decision public.minds_shadow_decisions%ROWTYPE;
 v_existing public.minds_calendar_action_receipts%ROWTYPE;
 v_target public.isabella_tasks%ROWTYPE;
 v_original jsonb;
 v_title text;
 v_date date;
 v_project text;
 v_category text;
 v_project_id uuid;
 v_category_id uuid;
 v_note text;
 v_reminder time;
 v_after jsonb;
 v_receipt uuid;
 v_status text;
BEGIN
 IF v_user IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_reviewed) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'unauthorized_or_invalid_review';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text||':'||p_request_id::text,42));
 SELECT * INTO v_existing FROM public.minds_calendar_action_receipts
  WHERE user_id=v_user AND request_id=p_request_id;
 IF FOUND THEN
   IF v_existing.action<>'create_task' OR
      (p_reviewed-'_review') IS DISTINCT FROM (v_existing.reviewed_candidate-'_review')
   THEN RAISE EXCEPTION 'receipt_replay_candidate_mismatch'; END IF;
   RETURN jsonb_build_object('status','already_applied','receipt_id',v_existing.id,
     'request_id',p_request_id,'entity_kind','task','entity_id',v_existing.entity_id,
     'entity_client_key',v_existing.entity_client_key,'after',v_existing.after_state);
 END IF;
 SELECT * INTO v_decision FROM public.minds_shadow_decisions
  WHERE user_id=v_user AND request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_decision.action<>'create_task' OR
    v_decision.proposal_kind<>'task' OR v_decision.policy_mode<>'confirm'
    OR v_decision.status NOT IN ('pending','accepted','edited')
 THEN RAISE EXCEPTION 'missing_or_ineligible_review'; END IF;
 v_original:=v_decision.candidate;
 IF coalesce(p_reviewed->>'kind','')<>'task'
    OR coalesce(p_reviewed->>'action','')<>'create'
    OR nullif(p_reviewed->>'request_id','') IS DISTINCT FROM p_request_id::text
    OR coalesce(p_reviewed->>'target_id','')<>''
    OR coalesce(p_reviewed->>'target_title','')<>''
    OR coalesce(p_reviewed->>'target_date','')<>''
 THEN RAISE EXCEPTION 'review_target_or_authority_changed'; END IF;
 IF v_decision.status IN ('accepted','edited') AND
   (v_decision.reviewed_candidate IS NULL OR
    (p_reviewed-'_review') IS DISTINCT FROM (v_decision.reviewed_candidate-'_review'))
 THEN RAISE EXCEPTION 'reviewed_candidate_mismatch'; END IF;
 v_title:=nullif(btrim(p_reviewed->>'title'),'');
 IF v_title IS NULL OR length(v_title)>500 THEN RAISE EXCEPTION 'invalid_reviewed_title'; END IF;
 IF nullif(p_reviewed->>'date','') IS NOT NULL THEN
   IF (p_reviewed->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   THEN RAISE EXCEPTION 'invalid_reviewed_date'; END IF;
   v_date:=(p_reviewed->>'date')::date;
   IF to_char(v_date,'YYYY-MM-DD')<>(p_reviewed->>'date')
   THEN RAISE EXCEPTION 'invalid_reviewed_date'; END IF;
 END IF;
 v_project:=nullif(btrim(p_reviewed->>'project'),'');
 IF v_project IS NOT NULL THEN
   SELECT id INTO v_project_id FROM public.isabella_projects
    WHERE user_id=v_user AND archived=false AND lower(name)=lower(v_project);
   IF NOT FOUND THEN RAISE EXCEPTION 'project_not_found'; END IF;
 END IF;
 v_category:=nullif(btrim(p_reviewed->>'category'),'');
 IF v_category IS NOT NULL THEN
   SELECT id INTO v_category_id FROM public.isabella_categories
    WHERE user_id=v_user AND lower(name)=lower(v_category);
   IF NOT FOUND THEN RAISE EXCEPTION 'category_not_found'; END IF;
 END IF;
 IF p_reviewed->'recurrence' IS NOT NULL AND
    p_reviewed->'recurrence' NOT IN ('null'::jsonb,'{}'::jsonb,'""'::jsonb)
 THEN RAISE EXCEPTION 'recurrence_requires_separate_executor'; END IF;
 v_note:=left(coalesce(p_reviewed->>'notes',''),12000);
 IF nullif(p_reviewed->>'reminder_time','') IS NOT NULL THEN
   IF v_date IS NULL OR (p_reviewed->>'reminder_time') !~ '^[0-9]{2}:[0-9]{2}$'
   THEN RAISE EXCEPTION 'invalid_reviewed_reminder'; END IF;
   v_reminder:=(p_reviewed->>'reminder_time')::time;
 END IF;
 INSERT INTO public.isabella_tasks(user_id,client_key,title,due_date,project_id,category_id,notes,reminder_time,metadata)
 VALUES(v_user,'review:'||p_request_id::text,v_title,v_date,v_project_id,v_category_id,
        v_note,v_reminder,jsonb_build_object('source','isabella','review_request_id',p_request_id))
 RETURNING * INTO v_target;
 v_after:=jsonb_build_object('id',v_target.id,'client_key',v_target.client_key,
   'title',v_target.title,'date',v_target.due_date,
   'project_id',v_target.project_id,'category_id',v_target.category_id,
   'notes',v_target.notes,'reminder_time',v_target.reminder_time,
   'updated_at',v_target.updated_at);
 INSERT INTO public.minds_calendar_action_receipts(
   user_id,request_id,action,entity_kind,entity_id,entity_client_key,
   before_state,after_state,reviewed_candidate
 ) VALUES(v_user,p_request_id,'create_task','task',v_target.id,v_target.client_key,
          'null'::jsonb,v_after,p_reviewed) RETURNING id INTO v_receipt;
 v_status:=CASE WHEN p_reviewed-'_review' IS DISTINCT FROM v_original-'_review'
   THEN 'edited' ELSE 'accepted' END;
 UPDATE public.minds_shadow_decisions
   SET status=v_status,reviewed_candidate=p_reviewed,
       resolved_at=coalesce(resolved_at,now()),updated_at=now()
 WHERE id=v_decision.id;
 INSERT INTO public.isabella_activity_log(
   user_id,entity_type,entity_key,action,source,before_state,after_state
 ) VALUES(v_user,'task',v_target.client_key,'create','assistant',NULL,v_after);
 RETURN jsonb_build_object('status','applied','receipt_id',v_receipt,
   'request_id',p_request_id,'entity_kind','task','entity_id',v_target.id,
   'entity_client_key',v_target.client_key,'after',v_after);
END;
$function$;
REVOKE ALL ON FUNCTION public.minds_commit_reviewed_task_create_v01(p_request_id uuid, p_reviewed jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_commit_reviewed_task_create_v01(p_request_id uuid, p_reviewed jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_commit_reviewed_task_create_v01(p_request_id uuid, p_reviewed jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_commit_reviewed_task_update_v01(p_request_id uuid, p_reviewed jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_decision public.minds_shadow_decisions%ROWTYPE;
  v_existing public.minds_calendar_action_receipts%ROWTYPE;
  v_target public.isabella_tasks%ROWTYPE;
  v_original jsonb;
  v_target_ref text;
  v_match_count integer;
  v_due_date date;
  v_title text;
  v_before jsonb;
  v_after jsonb;
  v_receipt uuid;
  v_status text;
  v_edited boolean;
  v_project_id uuid;
  v_category_id uuid;
  v_project text;
  v_category text;
BEGIN
  IF v_user IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_reviewed) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'unauthorized_or_invalid_review';
  END IF;
  -- One user, one request. All reads/writes below take place atomically.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text||':'||p_request_id::text,42));
  SELECT * INTO v_existing FROM public.minds_calendar_action_receipts
    WHERE user_id=v_user AND request_id=p_request_id;
  IF FOUND THEN
    IF (p_reviewed-'_review') IS DISTINCT FROM (v_existing.reviewed_candidate-'_review') THEN
      RAISE EXCEPTION 'receipt_replay_candidate_mismatch';
    END IF;
    RETURN jsonb_build_object('status','already_applied','receipt_id',v_existing.id,
      'request_id',p_request_id,'entity_id',v_existing.entity_id,
      'entity_client_key',v_existing.entity_client_key,'after',v_existing.after_state);
  END IF;
  SELECT * INTO v_decision FROM public.minds_shadow_decisions
    WHERE user_id=v_user AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v_decision.action<>'update_task' OR
     v_decision.proposal_kind<>'task' OR v_decision.policy_mode<>'confirm'
     OR v_decision.status NOT IN ('pending','accepted','edited') THEN
    RAISE EXCEPTION 'missing_or_ineligible_review';
  END IF;
  v_original:=v_decision.candidate;
  IF coalesce(p_reviewed->>'kind','')<>'task'
     OR coalesce(p_reviewed->>'action','')<>'update'
     OR nullif(p_reviewed->>'request_id','') IS DISTINCT FROM p_request_id::text
     OR coalesce(p_reviewed->>'target_id','') IS DISTINCT FROM coalesce(v_original->>'target_id','')
     OR coalesce(p_reviewed->>'target_title','') IS DISTINCT FROM coalesce(v_original->>'target_title','')
     OR coalesce(p_reviewed->>'target_date','') IS DISTINCT FROM coalesce(v_original->>'target_date','')
  THEN RAISE EXCEPTION 'review_target_or_authority_changed';
  END IF;
  -- Reviews already marked accepted/edited by the former UI are immutable;
  -- retrying an earlier reviewed request cannot silently change its content.
  IF v_decision.status IN ('accepted','edited') AND
     (v_decision.reviewed_candidate IS NULL OR
      (p_reviewed - '_review') IS DISTINCT FROM
      (v_decision.reviewed_candidate - '_review')) THEN
    RAISE EXCEPTION 'reviewed_candidate_mismatch';
  END IF;
  v_target_ref:=nullif(v_original->>'target_id','');
  IF v_target_ref IS NOT NULL THEN
    SELECT * INTO v_target FROM public.isabella_tasks
      WHERE user_id=v_user AND (client_key=v_target_ref OR id::text=v_target_ref)
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'target_not_found'; END IF;
  ELSE
    -- Never select a task solely by an ambiguous name.
    IF nullif(v_original->>'target_title','') IS NULL
       OR nullif(v_original->>'target_date','') IS NULL THEN
      RAISE EXCEPTION 'unbound_task_target';
    END IF;
    SELECT count(*) INTO v_match_count FROM public.isabella_tasks
      WHERE user_id=v_user
        AND lower(title)=lower(v_original->>'target_title')
        AND due_date=(v_original->>'target_date')::date;
    IF v_match_count<>1 THEN RAISE EXCEPTION 'ambiguous_or_missing_target'; END IF;
    SELECT * INTO v_target FROM public.isabella_tasks
      WHERE user_id=v_user
        AND lower(title)=lower(v_original->>'target_title')
        AND due_date=(v_original->>'target_date')::date FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'target_changed'; END IF;
  END IF;
  IF nullif(v_original->>'target_title','') IS NOT NULL
     AND lower(v_target.title)<>lower(v_original->>'target_title') THEN
     RAISE EXCEPTION 'stale_target_title';
  END IF;
  IF nullif(v_original->>'target_date','') IS NOT NULL
     AND v_target.due_date IS DISTINCT FROM (v_original->>'target_date')::date THEN
    RAISE EXCEPTION 'stale_target_date';
  END IF;
  IF v_target.completed_at IS NOT NULL OR v_target.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'task_not_active';
  END IF;
  v_due_date:=v_target.due_date;
  IF coalesce((p_reviewed->>'clear_date')::boolean,false) THEN v_due_date:=NULL;
  ELSIF nullif(p_reviewed->>'date','') IS NOT NULL THEN
    IF (p_reviewed->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       THEN RAISE EXCEPTION 'invalid_reviewed_date'; END IF;
    v_due_date:=(p_reviewed->>'date')::date;
    IF to_char(v_due_date,'YYYY-MM-DD')<>(p_reviewed->>'date')
       THEN RAISE EXCEPTION 'invalid_reviewed_date'; END IF;
  END IF;
  v_title:=coalesce(nullif(btrim(p_reviewed->>'title'),''),v_target.title);
  IF length(v_title)>500 THEN RAISE EXCEPTION 'invalid_reviewed_title'; END IF;
  -- Project and category must match an owned canonical object if specified.
  v_project_id:=v_target.project_id;
  v_project:=nullif(btrim(p_reviewed->>'project'),'');
  IF v_project IS NOT NULL THEN
    SELECT id INTO v_project_id FROM public.isabella_projects
     WHERE user_id=v_user AND lower(name)=lower(v_project) LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'project_not_found'; END IF;
  END IF;
  v_category_id:=v_target.category_id;
  v_category:=nullif(btrim(p_reviewed->>'category'),'');
  IF v_category IS NOT NULL THEN
    SELECT id INTO v_category_id FROM public.isabella_categories
     WHERE user_id=v_user AND lower(name)=lower(v_category) LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'category_not_found'; END IF;
  END IF;
  -- No implicit recurrence rewrite in v0.1; nonempty changes fail closed.
  IF p_reviewed->'recurrence' IS NOT NULL AND
     p_reviewed->'recurrence'<>'null'::jsonb AND
     p_reviewed->'recurrence' NOT IN (v_original->'recurrence','{}'::jsonb) THEN
    RAISE EXCEPTION 'recurrence_requires_separate_executor';
  END IF;
  v_before:=jsonb_build_object('id',v_target.id,'client_key',v_target.client_key,
    'title',v_target.title,'date',v_target.due_date,'updated_at',v_target.updated_at);
  UPDATE public.isabella_tasks
    SET title=v_title,due_date=v_due_date,project_id=v_project_id,category_id=v_category_id,
      notes=CASE WHEN p_reviewed->>'notes' IS NULL THEN v_target.notes
                 ELSE left(p_reviewed->>'notes',12000) END,
      reminder_time=CASE WHEN v_due_date IS NULL THEN NULL
                         WHEN p_reviewed->>'reminder_time' IS NULL THEN v_target.reminder_time
                         WHEN p_reviewed->>'reminder_time'='' THEN NULL
                         ELSE (p_reviewed->>'reminder_time')::time END,
      updated_at=now()
    WHERE id=v_target.id AND user_id=v_user
    RETURNING * INTO v_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'canonical_write_failed'; END IF;
  v_after:=jsonb_build_object('id',v_target.id,'client_key',v_target.client_key,
    'title',v_target.title,'date',v_target.due_date,
    'project_id',v_target.project_id,'category_id',v_target.category_id,
    'notes',v_target.notes,'reminder_time',v_target.reminder_time,
    'updated_at',v_target.updated_at);
  INSERT INTO public.minds_calendar_action_receipts(
    user_id,request_id,action,entity_kind,entity_id,entity_client_key,before_state,after_state,reviewed_candidate
  ) VALUES (v_user,p_request_id,'update_task','task',v_target.id,v_target.client_key,
            v_before,v_after,p_reviewed) RETURNING id INTO v_receipt;
  v_edited:=p_reviewed-'_review' IS DISTINCT FROM v_original-'_review';
  v_status:=CASE WHEN v_edited THEN 'edited' ELSE 'accepted' END;
  UPDATE public.minds_shadow_decisions
    SET status=v_status,reviewed_candidate=p_reviewed,
        resolved_at=coalesce(resolved_at,now()),updated_at=now()
    WHERE id=v_decision.id;
  INSERT INTO public.isabella_activity_log
    (user_id,entity_type,entity_key,action,source,before_state,after_state)
    VALUES (v_user,'task',v_target.client_key,'update','assistant',
            v_before,v_after);
  RETURN jsonb_build_object('status','applied','receipt_id',v_receipt,
    'request_id',p_request_id,'entity_id',v_target.id,
    'entity_client_key',v_target.client_key,'after',v_after);
END;
$function$;
REVOKE ALL ON FUNCTION public.minds_commit_reviewed_task_update_v01(p_request_id uuid, p_reviewed jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_commit_reviewed_task_update_v01(p_request_id uuid, p_reviewed jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_commit_reviewed_task_update_v01(p_request_id uuid, p_reviewed jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_commit_reviewed_routine_v1(p_request_id uuid, p_reviewed jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  u uuid:=auth.uid();
  d public.minds_shadow_decisions%rowtype;
  receipt public.minds_routine_action_receipts%rowtype;
  r public.isabella_routines%rowtype;
  a text:=coalesce(p_reviewed->>'action','create');
  original jsonb;
  before_config jsonb;
  before_row jsonb:='{}';
  after_row jsonb:='{}';
  sched jsonb;
  tz text;
  title_text text;
  instruction_text text;
  rid uuid;
  receipt_id uuid;
  next_run timestamptz;
begin
  if u is null or p_request_id is null or jsonb_typeof(p_reviewed) is distinct from 'object'
     then raise exception 'unauthorized_or_invalid_review'; end if;
  -- Serialize routine changes per owner, including duplicate creation checks.
  perform pg_advisory_xact_lock(hashtextextended(u::text||':routines',42));
  select * into receipt from public.minds_routine_action_receipts where user_id=u and request_id=p_request_id;
  if found then
    if p_reviewed-'_review' is distinct from receipt.reviewed_candidate-'_review'
      then raise exception 'receipt_replay_candidate_mismatch'; end if;
    return jsonb_build_object('status','already_applied','receipt_id',receipt.id,'entity_id',receipt.entity_id,'after',receipt.after_state);
  end if;
  select * into d from public.minds_shadow_decisions where user_id=u and request_id=p_request_id for update;
  if not found or d.proposal_kind<>'routine' or d.policy_mode<>'confirm'
    or d.status not in ('pending','accepted','edited') then raise exception 'missing_or_ineligible_review'; end if;
  original:=d.candidate;
  if a not in ('create','update','pause','resume','delete')
    or coalesce(p_reviewed->>'kind','')<>'routine'
    or coalesce(original->>'action','create')<>a
    or (p_reviewed->>'request_id') is distinct from p_request_id::text
    or (p_reviewed->>'target_id') is distinct from (original->>'target_id')
    or (p_reviewed->'before') is distinct from (original->'before')
    or d.action not in (a||'_routine',case when a='create' then 'create_chat_reminder' else a||'_routine' end)
    then raise exception 'review_target_or_authority_changed'; end if;
  if d.status in ('accepted','edited') and (d.reviewed_candidate is null or
    p_reviewed-'_review' is distinct from d.reviewed_candidate-'_review')
    then raise exception 'reviewed_candidate_mismatch'; end if;
  if a<>'create' then
    select * into r from public.isabella_routines where id=(original->>'target_id')::uuid and user_id=u for update;
    if not found then raise exception 'routine_target_not_found'; end if;
    rid:=r.id; before_row:=to_jsonb(r);
    before_config:=jsonb_build_object('title',r.title,'instruction',r.instruction,'schedule',r.schedule,'timezone',r.timezone,'enabled',r.enabled);
    -- Runner timestamps/output do not invalidate a review, but config edits do.
    if original->'before' is distinct from before_config then raise exception 'routine_changed_since_review'; end if;
  end if;
  if a in ('create','update') then
    title_text:=btrim(p_reviewed->>'title'); instruction_text:=btrim(p_reviewed->>'instruction'); tz:=p_reviewed->>'timezone';
    if coalesce(length(title_text),0) not between 1 and 500 or coalesce(length(instruction_text),0) not between 1 and 20000
      then raise exception 'invalid_routine_content'; end if;
    if tz is null or not exists(select 1 from pg_timezone_names where name=tz) then raise exception 'invalid_routine_timezone'; end if;
    if coalesce(p_reviewed->>'schedule_kind','') not in ('once','daily','weekly')
      or coalesce(p_reviewed->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      then raise exception 'invalid_routine_schedule'; end if;
    sched:=jsonb_build_object('kind',p_reviewed->>'schedule_kind','time',p_reviewed->>'time');
    if p_reviewed->>'schedule_kind'='weekly' then
      if jsonb_typeof(p_reviewed->'weekdays') is distinct from 'array' then raise exception 'invalid_routine_weekdays'; end if;
      if jsonb_array_length(p_reviewed->'weekdays')=0 or exists(
        select 1 from jsonb_array_elements(p_reviewed->'weekdays') x where x::text !~ '^[0-6]$'
      ) then raise exception 'invalid_routine_weekdays'; end if;
      sched:=sched||jsonb_build_object('weekdays',(select jsonb_agg(v order by v) from (select distinct value v from jsonb_array_elements(p_reviewed->'weekdays')) days));
    elsif p_reviewed->>'schedule_kind'='once' then
      if coalesce(p_reviewed->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid_routine_date'; end if;
      perform (p_reviewed->>'date')::date;
      sched:=sched||jsonb_build_object('date',p_reviewed->>'date');
    end if;
    next_run:=public.isabella_next_routine_run(sched,tz,now());
    if next_run is null or next_run<=now() then raise exception 'routine_requires_future_run'; end if;
    if a='create' and exists(select 1 from public.isabella_routines
      where user_id=u and (lower(btrim(title))=lower(title_text) or
        (btrim(instruction)=instruction_text and schedule->>'kind'=sched->>'kind'
          and schedule->>'time'=sched->>'time' and coalesce(schedule->'weekdays','[]')=coalesce(sched->'weekdays','[]')
          and coalesce(schedule->>'date','')=coalesce(sched->>'date','') and timezone=tz)))
      then raise exception 'duplicate_routine_edit_existing'; end if;
    if a='create' then
      insert into public.isabella_routines(user_id,title,instruction,schedule,timezone,enabled,client_key,metadata)
        values(u,title_text,instruction_text,sched,tz,true,p_request_id::text,jsonb_build_object('source','isabella_chat')) returning * into r;
      rid:=r.id;
    else
      update public.isabella_routines set title=title_text,instruction=instruction_text,schedule=sched,timezone=tz,updated_at=now()
        where id=rid and user_id=u returning * into r;
    end if;
    after_row:=to_jsonb(r);
  elsif a='delete' then
    delete from public.isabella_routines where id=rid and user_id=u;
  else
    if a='resume' and public.isabella_next_routine_run(r.schedule,r.timezone,now()) is null
      then raise exception 'routine_requires_future_run'; end if;
    update public.isabella_routines set enabled=(a='resume'),updated_at=now()
      where id=rid and user_id=u returning * into r;
    after_row:=to_jsonb(r);
  end if;
  insert into public.minds_routine_action_receipts(user_id,request_id,action,entity_id,before_state,after_state,reviewed_candidate)
    values(u,p_request_id,a,rid,before_row,after_row,p_reviewed) returning id into receipt_id;
  update public.minds_shadow_decisions set
    status=case when p_reviewed-'_review' is distinct from original-'_review' then 'edited' else 'accepted' end,
    reviewed_candidate=p_reviewed,resolved_at=coalesce(resolved_at,now()),updated_at=now() where id=d.id;
  return jsonb_build_object('status','applied','receipt_id',receipt_id,'entity_id',rid,'after',after_row);
end $function$;
REVOKE ALL ON FUNCTION public.minds_commit_reviewed_routine_v1(p_request_id uuid, p_reviewed jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_commit_reviewed_routine_v1(p_request_id uuid, p_reviewed jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_commit_reviewed_routine_v1(p_request_id uuid, p_reviewed jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_commit_direct_calendar_create_v01(p_request_id uuid, p_candidate jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_pref text;
  v_decision public.minds_shadow_decisions%ROWTYPE;
  v_existing public.minds_calendar_action_receipts%ROWTYPE;
  v_evidence text;
  v_normalized_title text;
  v_event_time_quote text;
  v_event_duration_quote text;
  v_owner_turn uuid;
  v_source_turn uuid;
  v_turns text[];
  v_authorization_exists boolean;
  v_action text;
  v_title text;
  v_date date;
  v_time time;
  v_duration integer;
  v_zone text;
  v_start timestamp;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_project text;
  v_category text;
  v_project_id uuid;
  v_category_id uuid;
  v_event public.isabella_events%ROWTYPE;
  v_after jsonb;
  v_receipt uuid;
BEGIN
  IF v_user IS NULL OR p_request_id IS NULL OR
     jsonb_typeof(p_candidate) IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION 'unauthorized_or_invalid_direct_create'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text||':'||p_request_id::text,42));
  SELECT create_mode INTO v_pref FROM public.minds_calendar_execution_preferences
    WHERE user_id=v_user;
  IF v_pref IS DISTINCT FROM 'direct' THEN RAISE EXCEPTION 'direct_creation_not_enabled'; END IF;

  SELECT * INTO v_existing FROM public.minds_calendar_action_receipts
    WHERE user_id=v_user AND request_id=p_request_id;
  IF FOUND THEN
    IF v_existing.action NOT IN ('create_task','create_event') OR
       (p_candidate-'_review') IS DISTINCT FROM (v_existing.reviewed_candidate-'_review')
    THEN RAISE EXCEPTION 'receipt_replay_candidate_mismatch'; END IF;
    RETURN jsonb_build_object('status','already_applied','receipt_id',v_existing.id,
      'request_id',p_request_id,'entity_kind',v_existing.entity_kind,
      'entity_id',v_existing.entity_id,'entity_client_key',v_existing.entity_client_key,
      'after',v_existing.after_state);
  END IF;

  SELECT * INTO v_decision FROM public.minds_shadow_decisions
    WHERE user_id=v_user AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v_decision.status<>'pending' OR v_decision.policy_mode<>'confirm'
     OR v_decision.action NOT IN ('create_task','create_event')
     OR v_decision.proposal_kind NOT IN ('task','event')
     OR coalesce(v_decision.context->>'direct_calendar_authority','')<>'explicit_owner_v1'
     OR coalesce((v_decision.context->>'direct_owner_source_tainted')::boolean,true)
     OR coalesce((v_decision.context->>'background')::boolean,true)
     OR (v_decision.candidate-'_review') IS DISTINCT FROM (p_candidate-'_review')
     OR v_decision.candidate->>'request_id' IS DISTINCT FROM p_request_id::text
  THEN RAISE EXCEPTION 'direct_creation_not_authorized'; END IF;
  v_action:=v_decision.action;
  IF (v_action='create_task' AND (p_candidate->>'kind'<>'task' OR p_candidate->>'action'<>'create'))
     OR (v_action='create_event' AND (p_candidate->>'kind'<>'event' OR p_candidate->>'action'<>'create'))
  THEN RAISE EXCEPTION 'direct_creation_kind_mismatch'; END IF;
  IF nullif(p_candidate->>'target_id','') IS NOT NULL OR
     nullif(p_candidate->>'target_title','') IS NOT NULL
  THEN RAISE EXCEPTION 'direct_creation_cannot_mutate'; END IF;
  v_evidence:=nullif(btrim(v_decision.context->>'direct_authorization_excerpt'),'');
  IF v_evidence IS NULL OR length(v_evidence)<8 OR length(v_evidence)>900
  THEN RAISE EXCEPTION 'direct_authorization_excerpt_missing'; END IF;
  BEGIN
    v_owner_turn:=(v_decision.context->>'direct_authorization_turn_id')::uuid;
    -- After a server-verified clarification («¿a qué hora?» → «a las 10») the clarified owner
    -- turn may hold the title or a quote; the answering turn stays the authorizing one.
    v_source_turn:=nullif(v_decision.context->>'direct_source_turn_id','')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'direct_authorization_source_invalid';
  END;
  v_turns:=array_remove(ARRAY[v_owner_turn::text,v_source_turn::text],NULL);
  -- Quotes are literal but case-insensitive, as in v01.
  SELECT EXISTS(
    SELECT 1 FROM public.conversation_messages m
    WHERE m.user_id=v_user AND m.client_key=ANY(v_turns) AND m.role='user'
      AND m.provenance_class='owner' AND m.exposure_scope_version=1
      AND position(lower(v_evidence) in lower(m.content))>0
  ) INTO v_authorization_exists;
  IF NOT v_authorization_exists THEN RAISE EXCEPTION 'direct_authorization_source_missing'; END IF;
  IF p_candidate->'recurrence' IS NOT NULL AND
     p_candidate->'recurrence' NOT IN ('null'::jsonb,'{}'::jsonb,'""'::jsonb)
  THEN RAISE EXCEPTION 'recurrence_requires_review'; END IF;

  -- Independent server-side check: the actual owner-authored global turn
  -- must already contain the proposed title; prefetched Work text cannot supply it.
  v_normalized_title:=btrim(regexp_replace(regexp_replace(
    lower(coalesce(p_candidate->>'title','')), '[^[:alnum:] ]+', ' ', 'g'), '[[:space:]]+', ' ', 'g'));
  IF length(v_normalized_title)<3 OR NOT EXISTS(
    SELECT 1 FROM public.conversation_messages m
    WHERE m.user_id=v_user AND m.client_key=ANY(v_turns) AND m.role='user'
      AND m.provenance_class='owner' AND m.exposure_scope_version=1
      AND position(v_normalized_title in btrim(regexp_replace(regexp_replace(
        lower(m.content),'[^[:alnum:] ]+',' ','g'),'[[:space:]]+',' ','g')))>0
  ) THEN RAISE EXCEPTION 'direct_title_not_in_owner_turn'; END IF;

  IF v_action='create_task' THEN
    -- Reuse the already accepted transactional executor: task + receipt +
    -- decision + activity, all in this same transaction.
    RETURN public.minds_commit_reviewed_task_create_v01(p_request_id,p_candidate);
  END IF;

  v_event_time_quote:=nullif(btrim(v_decision.context->>'direct_event_time_excerpt'),'');
  v_event_duration_quote:=nullif(btrim(v_decision.context->>'direct_event_duration_excerpt'),'');
  IF v_event_time_quote IS NULL OR length(v_event_time_quote)<3 OR length(v_event_time_quote)>160 OR
    NOT EXISTS(
      SELECT 1 FROM public.conversation_messages m
      WHERE m.user_id=v_user AND m.client_key=ANY(v_turns) AND m.role='user'
        AND m.provenance_class='owner' AND m.exposure_scope_version=1
        AND position(lower(v_event_time_quote) in lower(m.content))>0
    )
  THEN RAISE EXCEPTION 'event_time_not_explicit'; END IF;
  IF coalesce((v_decision.context->>'direct_duration_defaulted')::boolean,false) THEN
    -- Only the canonical server may mark the omitted duration, and only 60 min.
    IF v_event_duration_quote IS NOT NULL OR
      coalesce((p_candidate->>'duration_defaulted')::boolean,false) IS NOT TRUE OR
      (p_candidate->>'duration_minutes')::integer IS DISTINCT FROM 60
    THEN RAISE EXCEPTION 'event_default_duration_invalid'; END IF;
  ELSE
    IF v_event_duration_quote IS NULL OR
       length(v_event_duration_quote)<3 OR length(v_event_duration_quote)>160 OR
       NOT EXISTS(
         SELECT 1 FROM public.conversation_messages m
         WHERE m.user_id=v_user AND m.client_key=ANY(v_turns) AND m.role='user'
           AND m.provenance_class='owner' AND m.exposure_scope_version=1
           AND position(lower(v_event_duration_quote) in lower(m.content))>0
       )
    THEN RAISE EXCEPTION 'event_time_or_duration_not_explicit'; END IF;
  END IF;
  v_title:=nullif(btrim(p_candidate->>'title'),'');
  IF v_title IS NULL OR length(v_title)>500 THEN RAISE EXCEPTION 'invalid_event_title'; END IF;
  IF coalesce(p_candidate->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      OR coalesce(p_candidate->>'time','') !~ '^[0-9]{2}:[0-9]{2}$'
  THEN RAISE EXCEPTION 'event_time_requires_review'; END IF;
  v_date:=(p_candidate->>'date')::date;
  IF to_char(v_date,'YYYY-MM-DD')<>p_candidate->>'date' THEN RAISE EXCEPTION 'invalid_event_date'; END IF;
  v_time:=(p_candidate->>'time')::time;
  IF to_char(v_time,'HH24:MI')<>p_candidate->>'time' THEN RAISE EXCEPTION 'invalid_event_time'; END IF;
  v_duration:=(p_candidate->>'duration_minutes')::integer;
  IF v_duration IS NULL OR v_duration<1 OR v_duration>720 OR
     coalesce((p_candidate->>'all_day')::boolean,false)
  THEN RAISE EXCEPTION 'event_duration_or_all_day_requires_review'; END IF;
  v_zone:=nullif(btrim(v_decision.context->>'direct_timezone'),'');
  IF v_zone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=v_zone)
  THEN RAISE EXCEPTION 'event_timezone_requires_review'; END IF;
  v_start:=v_date::timestamp+v_time;
  v_start_at:=v_start AT TIME ZONE v_zone;
  IF (v_start_at AT TIME ZONE v_zone)<>v_start
  THEN RAISE EXCEPTION 'event_invalid_local_time'; END IF;
  v_end_at:=v_start_at+make_interval(mins=>v_duration);
  v_project:=nullif(btrim(p_candidate->>'project'),'');
  IF v_project IS NOT NULL THEN
    SELECT id INTO v_project_id FROM public.isabella_projects
    WHERE user_id=v_user AND lower(name)=lower(v_project) AND NOT archived LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'project_not_found'; END IF;
  END IF;
  v_category:=nullif(btrim(p_candidate->>'category'),'');
  IF v_category IS NOT NULL THEN
    SELECT id INTO v_category_id FROM public.isabella_categories
    WHERE user_id=v_user AND lower(name)=lower(v_category) LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'category_not_found'; END IF;
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.isabella_events e
    WHERE e.user_id=v_user AND e.starts_at<v_end_at AND e.ends_at>v_start_at
  ) THEN RAISE EXCEPTION 'event_overlap_requires_review'; END IF;

  INSERT INTO public.isabella_events(user_id,client_key,title,starts_at,ends_at,all_day,
    project_id,category_id,notes,metadata)
  VALUES(v_user,'direct:'||p_request_id::text,v_title,v_start_at,v_end_at,false,
    v_project_id,v_category_id,left(coalesce(p_candidate->>'notes',''),12000),
    jsonb_build_object('source','isabella','direct_request_id',p_request_id))
  RETURNING * INTO v_event;
  v_after:=jsonb_build_object('id',v_event.id,'client_key',v_event.client_key,
    'title',v_event.title,'starts_at',v_event.starts_at,'ends_at',v_event.ends_at,
    'project_id',v_event.project_id,'category_id',v_event.category_id,
    'all_day',v_event.all_day,'updated_at',v_event.updated_at);
  INSERT INTO public.minds_calendar_action_receipts(
    user_id,request_id,action,entity_kind,entity_id,entity_client_key,
    before_state,after_state,reviewed_candidate)
  VALUES(v_user,p_request_id,'create_event','event',v_event.id,v_event.client_key,
    'null'::jsonb,v_after,p_candidate) RETURNING id INTO v_receipt;
  UPDATE public.minds_shadow_decisions SET status='accepted',reviewed_candidate=p_candidate,
    resolved_at=now(),updated_at=now() WHERE id=v_decision.id;
  INSERT INTO public.isabella_activity_log(user_id,entity_type,entity_key,action,source,before_state,after_state)
  VALUES(v_user,'event',v_event.client_key,'create','assistant',NULL,v_after);
  RETURN jsonb_build_object('status','applied','receipt_id',v_receipt,
    'request_id',p_request_id,'entity_kind','event','entity_id',v_event.id,
    'entity_client_key',v_event.client_key,'after',v_after);
END;
$function$;
REVOKE ALL ON FUNCTION public.minds_commit_direct_calendar_create_v01(p_request_id uuid, p_candidate jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_commit_direct_calendar_create_v01(p_request_id uuid, p_candidate jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_commit_direct_calendar_create_v01(p_request_id uuid, p_candidate jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_undo_direct_calendar_create_v01(p_request_id uuid, p_receipt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_receipt public.minds_calendar_action_receipts%ROWTYPE;
  v_decision public.minds_shadow_decisions%ROWTYPE;
  v_task public.isabella_tasks%ROWTYPE;
  v_after_task public.isabella_tasks%ROWTYPE;
  v_event public.isabella_events%ROWTYPE;
  v_undo_receipt uuid;
BEGIN
  IF v_user IS NULL OR p_request_id IS NULL OR p_receipt_id IS NULL
  THEN RAISE EXCEPTION 'unauthorized_or_invalid_undo'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text||':'||p_request_id::text,42));
  SELECT * INTO v_receipt FROM public.minds_calendar_action_receipts
    WHERE user_id=v_user AND id=p_receipt_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v_receipt.action NOT IN ('create_task','create_event')
    OR v_receipt.entity_kind NOT IN ('task','event')
    OR v_receipt.after_state IS NULL
  THEN RAISE EXCEPTION 'direct_create_receipt_not_found'; END IF;
  -- The receipt must be fresh; this guard is not a generic archive/delete permission.
  IF now()>v_receipt.created_at+interval '10 minutes'
  THEN RAISE EXCEPTION 'direct_undo_window_expired'; END IF;
  SELECT * INTO v_decision FROM public.minds_shadow_decisions
    WHERE user_id=v_user AND request_id=p_request_id;
  IF NOT FOUND OR v_decision.action IS DISTINCT FROM v_receipt.action
     OR v_decision.context->>'direct_calendar_authority' IS DISTINCT FROM 'explicit_owner_v1'
     OR v_decision.context->>'direct_authorization_turn_id' IS NULL
  THEN RAISE EXCEPTION 'not_a_direct_owner_create'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.conversation_messages m
      WHERE m.user_id=v_user AND m.role='user' AND m.provenance_class='owner' AND m.exposure_scope_version=1
        AND m.client_key=v_decision.context->>'direct_authorization_turn_id'
        AND NOT EXISTS (SELECT 1 FROM public.conversation_messages newer
          WHERE newer.user_id=v_user AND newer.role='user' AND newer.provenance_class='owner'
            AND newer.conversation_id=m.conversation_id AND newer.created_at>m.created_at))
  THEN RAISE EXCEPTION 'direct_undo_superseded'; END IF;

  IF v_receipt.entity_kind='task' THEN
    SELECT * INTO v_task FROM public.isabella_tasks
      WHERE user_id=v_user AND id=v_receipt.entity_id
        AND client_key=v_receipt.entity_client_key FOR UPDATE;
    IF NOT FOUND OR v_task.archived_at IS NOT NULL OR v_task.completed_at IS NOT NULL OR
       v_task.updated_at IS DISTINCT FROM (v_receipt.after_state->>'updated_at')::timestamptz OR
       v_task.title IS DISTINCT FROM v_receipt.after_state->>'title' OR
       v_task.due_date IS DISTINCT FROM (v_receipt.after_state->>'date')::date
    THEN RAISE EXCEPTION 'original_task_changed_undo_requires_review'; END IF;
    UPDATE public.isabella_tasks SET archived_at=now(),updated_at=now()
      WHERE id=v_task.id AND user_id=v_user AND archived_at IS NULL
      RETURNING * INTO v_after_task;
    IF NOT FOUND THEN RAISE EXCEPTION 'task_undo_conflict'; END IF;
    INSERT INTO public.isabella_activity_log(user_id,entity_type,entity_key,action,source,before_state,after_state)
      VALUES(v_user,'task',v_task.client_key,'archive','assistant',to_jsonb(v_task),to_jsonb(v_after_task))
      RETURNING id INTO v_undo_receipt;
  ELSE
    SELECT * INTO v_event FROM public.isabella_events
      WHERE user_id=v_user AND id=v_receipt.entity_id
        AND client_key=v_receipt.entity_client_key FOR UPDATE;
    IF NOT FOUND OR
       v_event.updated_at IS DISTINCT FROM (v_receipt.after_state->>'updated_at')::timestamptz OR
       v_event.title IS DISTINCT FROM v_receipt.after_state->>'title' OR
       v_event.starts_at IS DISTINCT FROM (v_receipt.after_state->>'starts_at')::timestamptz OR
       v_event.ends_at IS DISTINCT FROM (v_receipt.after_state->>'ends_at')::timestamptz
    THEN RAISE EXCEPTION 'original_event_changed_undo_requires_review'; END IF;
    DELETE FROM public.isabella_events WHERE id=v_event.id AND user_id=v_user;
    IF NOT FOUND THEN RAISE EXCEPTION 'event_undo_conflict'; END IF;
    -- Sync tombstone belongs in the same transaction as the deletion.
    INSERT INTO public.isabella_deleted_items(user_id,entity_type,client_key,deleted_at)
      VALUES(v_user,'event',v_event.client_key,now())
      ON CONFLICT (user_id,entity_type,client_key) DO UPDATE
      SET deleted_at=EXCLUDED.deleted_at;
    INSERT INTO public.isabella_activity_log(user_id,entity_type,entity_key,action,source,before_state,after_state)
      VALUES(v_user,'event',v_event.client_key,'delete','assistant',to_jsonb(v_event),NULL)
      RETURNING id INTO v_undo_receipt;
  END IF;
  RETURN jsonb_build_object('status','undone','request_id',p_request_id,
    'original_receipt_id',p_receipt_id,'undo_receipt_id',v_undo_receipt,
    'entity_kind',v_receipt.entity_kind,'entity_client_key',v_receipt.entity_client_key);
END;
$function$;
REVOKE ALL ON FUNCTION public.minds_undo_direct_calendar_create_v01(p_request_id uuid, p_receipt_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_undo_direct_calendar_create_v01(p_request_id uuid, p_receipt_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_undo_direct_calendar_create_v01(p_request_id uuid, p_receipt_id uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_undo_direct_calendar_batch_v01(p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid:=auth.uid();
  v_item jsonb;
  v_result jsonb;
  v_results jsonb:='[]'::jsonb;
  v_count integer;
BEGIN
  IF v_user IS NULL OR p_items IS NULL OR jsonb_typeof(p_items)<>'array'
  THEN RAISE EXCEPTION 'direct_batch_undo_invalid'; END IF;
  v_count:=jsonb_array_length(p_items);
  IF v_count<1 OR v_count>20 THEN RAISE EXCEPTION 'direct_undo_batch_limit'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item)<>'object' OR
       nullif(v_item->>'request_id','') IS NULL OR
       nullif(v_item->>'receipt_id','') IS NULL
    THEN RAISE EXCEPTION 'direct_undo_batch_bad_item'; END IF;
    v_result:=public.minds_undo_direct_calendar_create_v01(
      (v_item->>'request_id')::uuid,(v_item->>'receipt_id')::uuid);
    IF v_result->>'status' IS DISTINCT FROM 'undone'
    THEN RAISE EXCEPTION 'direct_undo_receipt_missing'; END IF;
    v_results:=v_results||jsonb_build_array(v_result);
  END LOOP;
  RETURN jsonb_build_object('status','undone','count',v_count,'receipts',v_results);
END;
$function$;
REVOKE ALL ON FUNCTION public.minds_undo_direct_calendar_batch_v01(p_items jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_undo_direct_calendar_batch_v01(p_items jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_undo_direct_calendar_batch_v01(p_items jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_forget_conversation(p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  if not exists(
    select 1 from public.conversations c
    where c.id=p_conversation_id and c.user_id=v_user
  ) then
    raise exception 'conversation_not_found';
  end if;

  return public.minds_invalidate_memory_lineage(v_user,'conversation',p_conversation_id::text,'user_forget_session');
end;
$function$;
REVOKE ALL ON FUNCTION public.minds_forget_conversation(p_conversation_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_forget_conversation(p_conversation_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_forget_conversation(p_conversation_id uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_forget_memory(p_client_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_id uuid;
begin
  if v_user is null then raise exception 'unauthorized'; end if;
  select m.id into v_id
  from public.isabella_memories m
  where m.user_id=v_user and m.client_key=p_client_key
  limit 1;

  if v_id is null then
    return jsonb_build_object('status','not_found','client_key',p_client_key);
  end if;

  return public.minds_invalidate_memory_lineage(v_user,'memory',v_id::text,'user_forget');
end;
$function$;
REVOKE ALL ON FUNCTION public.minds_forget_memory(p_client_key text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_forget_memory(p_client_key text) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_forget_memory(p_client_key text) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_review_model_claim(p_claim_id uuid, p_status text, p_replacement text DEFAULT NULL::text, p_claim_type text DEFAULT 'other'::text, p_evidence text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid, p_confirmed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select minds_private.review_model_claim(
    p_claim_id,p_status,p_replacement,p_claim_type,p_evidence,p_request_id,p_confirmed
  );
$function$;
REVOKE ALL ON FUNCTION public.minds_review_model_claim(p_claim_id uuid, p_status text, p_replacement text, p_claim_type text, p_evidence text, p_request_id uuid, p_confirmed boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minds_review_model_claim(p_claim_id uuid, p_status text, p_replacement text, p_claim_type text, p_evidence text, p_request_id uuid, p_confirmed boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_review_model_claim(p_claim_id uuid, p_status text, p_replacement text, p_claim_type text, p_evidence text, p_request_id uuid, p_confirmed boolean) TO authenticated;
commit;
