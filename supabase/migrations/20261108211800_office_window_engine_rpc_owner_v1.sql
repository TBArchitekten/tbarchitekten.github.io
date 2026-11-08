-- Office Phase 1: commitment, mission and cognitive owner RPCs.
-- Catalog DDL from Window; Office runs on its own Supabase and RLS.
-- SECURITY DEFINER calls retain only authenticated-owner auth (where source allowed);
-- internal/system functions do not gain browser authority.
begin;
CREATE OR REPLACE FUNCTION public.minds_save_memory_checkpoint(p_agent text, p_conversation_id uuid, p_message_ids uuid[], p_summary text, p_open_loops jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare u uuid:=auth.uid(); prior public.minds_memory_flushes; saved public.minds_memory_flushes; expected uuid[]; last_at timestamptz; last_id uuid;
begin
  if u is null then raise exception 'Authentication required'; end if;
  if p_agent not in ('isabella','sofia') or coalesce(cardinality(p_message_ids),0) not between 1 and 100 or length(trim(coalesce(p_summary,'')))=0 then raise exception 'Invalid checkpoint'; end if;
  if not exists(select 1 from public.conversations where id=p_conversation_id and user_id=u and app_scope=p_agent) then raise exception 'Conversation not accessible'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||p_agent||p_conversation_id::text,0));
  select * into saved from public.minds_memory_flushes where user_id=u and agent=p_agent and conversation_id=p_conversation_id and checkpoint_message_id=p_message_ids[cardinality(p_message_ids)];
  if found then
    if saved.source_message_ids<>p_message_ids then raise exception 'Checkpoint coverage conflict'; end if;
    return to_jsonb(saved);
  end if;
  select * into prior from public.minds_memory_flushes where user_id=u and agent=p_agent and conversation_id=p_conversation_id and status='active' order by checkpoint_message_at desc,checkpoint_message_id desc limit 1;
  select array_agg(id order by created_at,id) into expected from (
    select id,created_at from public.conversation_messages where user_id=u and conversation_id=p_conversation_id
    and (prior.id is null or (created_at,id)>(prior.checkpoint_message_at,coalesce(prior.checkpoint_message_id,'00000000-0000-0000-0000-000000000000'::uuid)))
    order by created_at,id limit cardinality(p_message_ids)
  ) q;
  if expected is distinct from p_message_ids then raise exception 'Checkpoint must cover the next contiguous messages'; end if;
  last_id:=p_message_ids[cardinality(p_message_ids)];
  select created_at into last_at from public.conversation_messages where id=last_id and user_id=u;
  insert into public.minds_memory_flushes(user_id,agent,conversation_id,checkpoint_message_at,checkpoint_message_id,source_message_ids,summary,open_loops,provenance)
  values(u,p_agent,p_conversation_id,last_at,last_id,p_message_ids,p_summary,p_open_loops,jsonb_build_object('type','derived_checkpoint','source','conversation','accepted_fact',false,'message_count',cardinality(p_message_ids))) returning * into saved;
  -- Sofía checkpoints remain in its intellectual namespace, never personal memory.
  if p_agent='isabella' then
    insert into public.isabella_memories(user_id,kind,subject,content,status,confidence,source,metadata,client_key)
    values(u,'episodic','conversation checkpoint',p_summary,'active',0.65,'compaction_flush',jsonb_build_object('derived',true,'accepted_fact',false,'conversation_id',p_conversation_id,'checkpoint_message_at',last_at,'checkpoint_message_id',last_id,'flush_id',saved.id),'flush:'||p_conversation_id||':'||last_id)
    on conflict(user_id,client_key) do update set content=excluded.content,metadata=excluded.metadata,updated_at=now();
  end if;
  return to_jsonb(saved);
end $function$;
REVOKE ALL ON FUNCTION public.minds_save_memory_checkpoint(p_agent text, p_conversation_id uuid, p_message_ids uuid[], p_summary text, p_open_loops jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_save_memory_checkpoint(p_agent text, p_conversation_id uuid, p_message_ids uuid[], p_summary text, p_open_loops jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_save_memory_checkpoint(p_agent text, p_conversation_id uuid, p_message_ids uuid[], p_summary text, p_open_loops jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_ensure_commitment_workspace(p_commitment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_commitment public.minds_commitments%rowtype;
  v_workspace public.minds_commitment_workspaces%rowtype;
begin
  if v_uid is null then return jsonb_build_object('status','unauthorized'); end if;

  select * into v_commitment
  from public.minds_commitments
  where id=p_commitment_id and user_id=v_uid and status in ('active','waiting','paused');

  if not found then return jsonb_build_object('status','missing'); end if;

  insert into public.minds_commitment_workspaces(
    user_id,commitment_id,project_id,title,objective_snapshot,completion_criteria_snapshot,status,metadata
  ) values (
    v_uid,v_commitment.id,v_commitment.project_id,v_commitment.title,v_commitment.objective,v_commitment.completion_criteria,
    case when v_commitment.status='paused' then 'paused' else 'active' end,
    jsonb_build_object('commitment_status_at_open',v_commitment.status,'opened_from','isabella')
  )
  on conflict(user_id,commitment_id) do update set
    project_id=excluded.project_id,
    title=excluded.title,
    objective_snapshot=excluded.objective_snapshot,
    completion_criteria_snapshot=excluded.completion_criteria_snapshot,
    updated_at=now()
  returning * into v_workspace;

  return jsonb_build_object('status','ok','workspace',to_jsonb(v_workspace));
end $function$;
REVOKE ALL ON FUNCTION public.minds_ensure_commitment_workspace(p_commitment_id uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_ensure_commitment_workspace(p_commitment_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_ensure_commitment_workspace(p_commitment_id uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_append_commitment_workspace_item(p_workspace_id uuid, p_kind text, p_content text, p_provenance_class text DEFAULT 'agent'::text, p_source_kind text DEFAULT 'conversation'::text, p_source_ref text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_workspace public.minds_commitment_workspaces%rowtype;
  v_item public.minds_commitment_workspace_items%rowtype;
  v_provenance text;
  v_status text;
begin
  if v_uid is null then return jsonb_build_object('status','unauthorized'); end if;
  if p_kind not in ('plan','finding','source','question','decision','note') then return jsonb_build_object('status','invalid_kind'); end if;
  if length(trim(coalesce(p_content,''))) < 1 or length(trim(coalesce(p_content,''))) > 16000 then return jsonb_build_object('status','invalid_content'); end if;
  if p_source_kind not in ('user','conversation','work','document','web','specialist','system') then return jsonb_build_object('status','invalid_source_kind'); end if;
  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object' then return jsonb_build_object('status','invalid_metadata'); end if;

  select * into v_workspace
  from public.minds_commitment_workspaces
  where id=p_workspace_id and user_id=v_uid and status in ('active','paused');

  if not found then return jsonb_build_object('status','missing'); end if;

  v_provenance:=case
    when p_source_kind='user' then 'user'
    when p_source_kind in ('work','document') then 'project_source'
    when p_source_kind='web' then 'external'
    when p_provenance_class in ('user','project_source','external','inferred','agent') then p_provenance_class
    else 'agent'
  end;
  v_status:=case when p_kind='decision' then 'proposed' else 'working' end;

  insert into public.minds_commitment_workspace_items(
    workspace_id,user_id,kind,status,content,provenance_class,source_kind,source_ref,metadata
  ) values (
    p_workspace_id,v_uid,p_kind,v_status,trim(p_content),v_provenance,p_source_kind,nullif(trim(coalesce(p_source_ref,'')),''),
    coalesce(p_metadata,'{}'::jsonb)
  ) returning * into v_item;

  update public.minds_commitment_workspaces
  set updated_at=now()
  where id=p_workspace_id and user_id=v_uid;

  return jsonb_build_object('status','ok','item',to_jsonb(v_item));
end $function$;
REVOKE ALL ON FUNCTION public.minds_append_commitment_workspace_item(p_workspace_id uuid, p_kind text, p_content text, p_provenance_class text, p_source_kind text, p_source_ref text, p_metadata jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_append_commitment_workspace_item(p_workspace_id uuid, p_kind text, p_content text, p_provenance_class text, p_source_kind text, p_source_ref text, p_metadata jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_append_commitment_workspace_item(p_workspace_id uuid, p_kind text, p_content text, p_provenance_class text, p_source_kind text, p_source_ref text, p_metadata jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_update_commitment_workspace_summary(p_workspace_id uuid, p_summary text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_workspace public.minds_commitment_workspaces%rowtype;
begin
  if v_uid is null then return jsonb_build_object('status','unauthorized'); end if;
  if length(coalesce(p_summary,'')) > 12000 then return jsonb_build_object('status','invalid_summary'); end if;

  update public.minds_commitment_workspaces
  set summary=coalesce(p_summary,''),updated_at=now()
  where id=p_workspace_id and user_id=v_uid and status in ('active','paused')
  returning * into v_workspace;

  if not found then return jsonb_build_object('status','missing'); end if;
  return jsonb_build_object('status','ok','workspace',to_jsonb(v_workspace));
end $function$;
REVOKE ALL ON FUNCTION public.minds_update_commitment_workspace_summary(p_workspace_id uuid, p_summary text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_update_commitment_workspace_summary(p_workspace_id uuid, p_summary text) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_update_commitment_workspace_summary(p_workspace_id uuid, p_summary text) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_propose_operating_model_hypothesis(p_dimension text, p_claim_type text, p_statement text, p_rationale text DEFAULT ''::text, p_source_kind text DEFAULT 'conversation'::text, p_source_ref text DEFAULT NULL::text, p_evidence_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u uuid:=auth.uid();
  o public.minds_operating_model_observations;
  h public.minds_operating_model_hypotheses;
  obs_fp text;
  pkey text;
begin
  if u is null then raise exception 'Authentication required';end if;
  if p_dimension not in ('scheduling','task_management','work_rhythm','interruptions','planning','decision_style','communication','tooling','review') then
    raise exception 'Operating model dimension invalid';
  end if;
  if p_claim_type not in ('preference','habit','pattern','goal','priority','value','working_style','interaction','constraint','other') then
    raise exception 'Operating model claim type invalid';
  end if;
  if p_source_kind not in ('conversation','manual') then
    raise exception 'Operating model source invalid';
  end if;
  if length(trim(coalesce(p_statement,'')))=0 or length(p_statement)>2000
     or length(coalesce(p_rationale,''))>4000
     or length(coalesce(p_source_ref,''))>500
     or length(coalesce(p_evidence_note,''))>2000 then
    raise exception 'Operating model proposal invalid';
  end if;
  if minds_private.operating_model_sensitive(p_statement||' '||coalesce(p_rationale,'')||' '||coalesce(p_evidence_note,'')) then
    raise exception 'Sensitive operating model inference not allowed';
  end if;

  obs_fp:=md5(u::text||'|'||p_source_kind||'|'||coalesce(p_source_ref,'')||'|'||lower(trim(p_statement))||'|'||coalesce(p_evidence_note,''));
  insert into public.minds_operating_model_observations(
    user_id,dimension,signal_type,source_kind,source_ref,signal,payload,fingerprint,observed_at
  ) values (
    u,p_dimension,'conversation_inference',p_source_kind,nullif(trim(coalesce(p_source_ref,'')),''),
    trim(p_statement),
    jsonb_build_object('evidence_note',nullif(trim(coalesce(p_evidence_note,'')),'')),
    obs_fp,now()
  )
  on conflict(user_id,fingerprint) do update
    set observed_at=excluded.observed_at
  returning * into o;

  pkey:='conversation:'||md5(p_dimension||'|'||p_claim_type||'|'||lower(trim(p_statement)));

  select * into h
  from public.minds_operating_model_hypotheses
  where user_id=u and pattern_key=pkey and status<>'stale'
  order by proposed_at desc
  limit 1;

  if not found then
    insert into public.minds_operating_model_hypotheses(
      user_id,dimension,claim_type,statement,inference_kind,pattern_key,
      rationale,evidence_summary,status,metadata
    ) values (
      u,p_dimension,p_claim_type,trim(p_statement),'conversation_inference',pkey,
      trim(coalesce(p_rationale,'')),
      jsonb_build_object(
        'support_count',1,
        'contradict_count',0,
        'source_types',jsonb_build_array(p_source_kind),
        'transparent',true
      ),
      'proposed',
      jsonb_build_object('requires_explicit_review',true)
    )
    returning * into h;
  end if;

  if h.status='proposed' then
    insert into public.minds_operating_model_evidence(user_id,hypothesis_id,observation_id,stance)
    values(u,h.id,o.id,'supports')
    on conflict(hypothesis_id,observation_id) do nothing;
  end if;

  return jsonb_build_object(
    'status',h.status,
    'hypothesis_id',h.id,
    'statement',h.statement,
    'requires_review',h.status='proposed'
  );
end $function$;
REVOKE ALL ON FUNCTION public.minds_propose_operating_model_hypothesis(p_dimension text, p_claim_type text, p_statement text, p_rationale text, p_source_kind text, p_source_ref text, p_evidence_note text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_propose_operating_model_hypothesis(p_dimension text, p_claim_type text, p_statement text, p_rationale text, p_source_kind text, p_source_ref text, p_evidence_note text) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_propose_operating_model_hypothesis(p_dimension text, p_claim_type text, p_statement text, p_rationale text, p_source_kind text, p_source_ref text, p_evidence_note text) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_get_contextual_autonomy()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid();
begin
 if u is null then raise exception 'Authentication required';end if;
 return jsonb_build_object(
  'units',(select coalesce(jsonb_agg(e),'[]') from minds_private.contextual_evidence(u) e),
  'permissions',(select coalesce(jsonb_agg(p order by p.reviewed_at desc),'[]') from public.minds_contextual_permissions p where p.user_id=u),
  'reviews',(select coalesce(jsonb_agg(r),'[]') from (select * from public.minds_permission_reviews where user_id=u order by created_at desc limit 20) r),
  'executions',(select coalesce(jsonb_agg(r),'[]') from (select * from public.minds_autonomy_executions where user_id=u order by created_at desc limit 20) r),
  'post_action_candidates',(select coalesce(jsonb_agg(r),'[]') from (
    select * from public.minds_post_action_feedback_candidates
    where user_id=u and created_at>=now()-interval '30 days'
    order by created_at desc limit 30
  ) r),
  'outcome_feedback',(select coalesce(jsonb_agg(r),'[]') from (
    select * from public.minds_outcome_feedback
    where user_id=u and created_at>=now()-interval '30 days'
    order by created_at desc limit 30
  ) r),
  'rules',jsonb_build_object(
    'window_days',30,'min_unchanged',12,'min_review_days',3,'max_age_days',7,
    'max_edits',0,'max_rejections',0,'grant_days',30,
    'post_action_candidate_hours',48,'post_action_review_days',14,
    'post_action_correction_window_days',30
  )
 );
end $function$;
REVOKE ALL ON FUNCTION public.minds_get_contextual_autonomy() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_get_contextual_autonomy() TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_get_contextual_autonomy() TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_validate_presence_reply_v01(p_attention_id uuid, p_request_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_event public.minds_attention_events%rowtype;
  v_mission public.minds_mission_runs%rowtype;
begin
  if v_uid is null then raise exception 'authentication_required' using errcode='42501'; end if;

  select * into v_event
  from public.minds_attention_events
  where id=p_attention_id and user_id=v_uid;

  if not found then
    return jsonb_build_object('status','stale','reason','attention_missing');
  end if;

  if coalesce(p_request_revision,0)<>v_event.request_revision then
    return jsonb_build_object(
      'status','stale','reason','revision_mismatch',
      'current_revision',v_event.request_revision
    );
  end if;

  if v_event.status not in ('pending','delivered')
     or v_event.route<>'interrupt'
     or v_event.requires_user is not true then
    return jsonb_build_object(
      'status','stale','reason','request_not_live',
      'current_status',v_event.status,'current_revision',v_event.request_revision
    );
  end if;

  if v_event.source_type='mission' then
    begin
      select * into v_mission
      from public.minds_mission_runs
      where id=v_event.source_id::uuid and user_id=v_uid;
    exception when invalid_text_representation then
      return jsonb_build_object('status','stale','reason','mission_source_invalid');
    end;

    if not found or v_mission.status<>'waiting_for_user' then
      return jsonb_build_object(
        'status','stale','reason','mission_no_longer_waiting',
        'current_revision',v_event.request_revision
      );
    end if;
  end if;

  return jsonb_build_object(
    'status','ok',
    'reply_context',jsonb_build_object(
      'attention_id',v_event.id,
      'request_revision',v_event.request_revision,
      'source_type',v_event.source_type,
      'source_id',v_event.source_id,
      'mission_run_id',case when v_event.source_type='mission' then v_event.source_id else null end,
      'title',v_event.title,
      'question',v_event.body
    )
  );
end $function$;
REVOKE ALL ON FUNCTION public.minds_validate_presence_reply_v01(p_attention_id uuid, p_request_revision integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_validate_presence_reply_v01(p_attention_id uuid, p_request_revision integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_validate_presence_reply_v01(p_attention_id uuid, p_request_revision integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_start_mission_run(p_workspace_id uuid, p_instruction text, p_request_id uuid, p_max_iterations integer DEFAULT 12)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_workspace public.minds_commitment_workspaces%rowtype;
  v_commitment public.minds_commitments%rowtype;
  v_existing public.minds_mission_runs%rowtype;
  v_run public.minds_mission_runs%rowtype;
  v_max integer:=greatest(1,least(coalesce(p_max_iterations,12),32));
begin
  if v_uid is null then return jsonb_build_object('status','unauthorized'); end if;
  if p_request_id is null then return jsonb_build_object('status','invalid_request_id'); end if;
  if length(trim(coalesce(p_instruction,'')))<1 or length(trim(coalesce(p_instruction,'')))>6000 then return jsonb_build_object('status','invalid_instruction'); end if;

  select * into v_existing from public.minds_mission_runs
  where user_id=v_uid and request_id=p_request_id;
  if found then return jsonb_build_object('status','ok','run',to_jsonb(v_existing),'idempotent',true); end if;

  select * into v_workspace from public.minds_commitment_workspaces
  where id=p_workspace_id and user_id=v_uid and status='active';
  if not found then return jsonb_build_object('status','workspace_unavailable'); end if;

  select * into v_commitment from public.minds_commitments
  where id=v_workspace.commitment_id and user_id=v_uid and status in ('active','waiting');
  if not found then return jsonb_build_object('status','commitment_unavailable'); end if;

  select * into v_existing from public.minds_mission_runs
  where workspace_id=p_workspace_id and user_id=v_uid
    and status in ('queued','running','waiting','waiting_for_user','paused')
  order by created_at desc limit 1;
  if found then return jsonb_build_object('status','already_active','run',to_jsonb(v_existing)); end if;

  insert into public.minds_mission_runs(
    user_id,workspace_id,request_id,instruction,max_iterations,status,phase,metadata
  ) values (
    v_uid,p_workspace_id,p_request_id,trim(p_instruction),v_max,
    'queued','queued',
    jsonb_build_object(
      'origin','isabella',
      'commitment_id',v_workspace.commitment_id,
      'persistent_work',true,
      'persistent_work_version','persistent-work-v0.1',
      'notify_mode',coalesce(nullif(v_commitment.metadata->>'notify_mode',''),'policy'),
      'skill_trace',coalesce(v_commitment.metadata->'skill_trace','[]'::jsonb)
    )
  ) returning * into v_run;

  insert into public.minds_mission_run_events(run_id,user_id,event_type,payload)
  values(v_run.id,v_uid,'queued',jsonb_build_object('instruction',v_run.instruction,'max_iterations',v_run.max_iterations,'persistent_work',true));

  return jsonb_build_object('status','ok','run',to_jsonb(v_run));
end $function$;
REVOKE ALL ON FUNCTION public.minds_start_mission_run(p_workspace_id uuid, p_instruction text, p_request_id uuid, p_max_iterations integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_start_mission_run(p_workspace_id uuid, p_instruction text, p_request_id uuid, p_max_iterations integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_start_mission_run(p_workspace_id uuid, p_instruction text, p_request_id uuid, p_max_iterations integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_start_mission_run_with_attention(p_workspace_id uuid, p_instruction text, p_request_id uuid, p_max_iterations integer, p_notify_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_result jsonb;
  v_run public.minds_mission_runs%rowtype;
  v_mode text:=case when p_notify_mode in ('policy','interrupt_on_complete','silent_on_complete') then p_notify_mode else 'policy' end;
begin
  v_result:=public.minds_start_mission_run(p_workspace_id,p_instruction,p_request_id,p_max_iterations);
  if v_result->>'status' not in ('ok','already_active') then return v_result; end if;
  if v_result->'run'->>'id' is null then return v_result; end if;

  select * into v_run from public.minds_mission_runs
  where id=(v_result->'run'->>'id')::uuid and user_id=auth.uid()
  for update;
  if not found then return jsonb_build_object('status','unavailable'); end if;

  if v_result->>'status'='ok' then
    update public.minds_mission_runs
    set metadata=metadata||jsonb_build_object('notify_mode',v_mode),updated_at=now()
    where id=v_run.id
    returning * into v_run;
  end if;

  return (v_result-'run')||jsonb_build_object('run',to_jsonb(v_run));
end $function$;
REVOKE ALL ON FUNCTION public.minds_start_mission_run_with_attention(p_workspace_id uuid, p_instruction text, p_request_id uuid, p_max_iterations integer, p_notify_mode text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_start_mission_run_with_attention(p_workspace_id uuid, p_instruction text, p_request_id uuid, p_max_iterations integer, p_notify_mode text) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_start_mission_run_with_attention(p_workspace_id uuid, p_instruction text, p_request_id uuid, p_max_iterations integer, p_notify_mode text) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_pause_mission_run(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_uid uuid:=auth.uid();v_run public.minds_mission_runs%rowtype;
begin
  if v_uid is null then return jsonb_build_object('status','unauthorized'); end if;
  update public.minds_mission_runs
  set status=case when status in ('queued','waiting','waiting_for_user') then 'paused' else status end,
      phase=case when status in ('queued','waiting','waiting_for_user') then 'paused' else phase end,
      metadata=metadata||jsonb_build_object('pause_requested',true),
      next_attempt_at=case when status in ('queued','waiting','waiting_for_user') then null else next_attempt_at end,
      wait_kind=case when status in ('queued','waiting','waiting_for_user') then null else wait_kind end,
      wait_ref=case when status in ('queued','waiting','waiting_for_user') then null else wait_ref end,
      wake_at=case when status in ('queued','waiting','waiting_for_user') then null else wake_at end,
      updated_at=now()
  where id=p_run_id and user_id=v_uid and status in ('queued','running','waiting','waiting_for_user')
  returning * into v_run;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  insert into public.minds_mission_run_events(run_id,user_id,event_type,payload)
  values(v_run.id,v_uid,'paused',jsonb_build_object('requested',true,'effective',v_run.status='paused'));
  return jsonb_build_object('status','ok','run',to_jsonb(v_run));
end $function$;
REVOKE ALL ON FUNCTION public.minds_pause_mission_run(p_run_id uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_pause_mission_run(p_run_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_pause_mission_run(p_run_id uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_resume_mission_run(p_run_id uuid, p_instruction text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_run public.minds_mission_runs%rowtype;
  v_input text:=nullif(trim(coalesce(p_instruction,'')),'');
begin
  if v_uid is null then return jsonb_build_object('status','unauthorized'); end if;
  if v_input is not null and length(v_input)>6000 then return jsonb_build_object('status','invalid_instruction'); end if;

  update public.minds_mission_runs
  set status='queued',
      phase='resumed',
      next_attempt_at=now(),
      lease_token=null,
      lease_until=null,
      wait_kind=null,
      wait_ref=null,
      wake_at=null,
      blocker_question=null,
      last_error=null,
      completed_at=null,
      max_iterations=least(32,greatest(max_iterations,iteration+6)),
      metadata=(metadata-'pause_requested'-'wait')
        || case when v_input is null then '{}'::jsonb
                else jsonb_build_object('last_user_input',v_input,'last_user_input_at',now()) end,
      updated_at=now()
  where id=p_run_id
    and user_id=v_uid
    and status in ('waiting','waiting_for_user','paused','failed')
  returning * into v_run;

  if not found then return jsonb_build_object('status','unavailable'); end if;

  update public.minds_attention_events
  set status='resolved',
      consumed_at=coalesce(consumed_at,now()),
      updated_at=now()
  where user_id=v_uid
    and source_type='mission'
    and source_id=v_run.id::text
    and requires_user=true
    and status in ('pending','delivered')
    and coalesce(metadata->>'mission_event','')='waiting_for_user';

  if v_input is not null then
    insert into public.minds_commitment_workspace_items(
      workspace_id,user_id,kind,status,content,provenance_class,source_kind,metadata
    )
    values(
      v_run.workspace_id,v_uid,'note','working',v_input,'user','user',
      jsonb_build_object('mission_run_id',v_run.id,'resume_input',true)
    );

    insert into public.minds_mission_run_events(run_id,user_id,event_type,payload)
    values(v_run.id,v_uid,'user_input',jsonb_build_object('content',v_input));
  end if;

  insert into public.minds_mission_run_events(run_id,user_id,event_type,payload)
  values(v_run.id,v_uid,'resumed',jsonb_build_object('max_iterations',v_run.max_iterations));

  return jsonb_build_object('status','ok','run',to_jsonb(v_run));
end
$function$;
REVOKE ALL ON FUNCTION public.minds_resume_mission_run(p_run_id uuid, p_instruction text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_resume_mission_run(p_run_id uuid, p_instruction text) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_resume_mission_run(p_run_id uuid, p_instruction text) TO authenticated;

CREATE OR REPLACE FUNCTION public.minds_cancel_mission_run(p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_uid uuid:=auth.uid();v_run public.minds_mission_runs%rowtype;
begin
  if v_uid is null then return jsonb_build_object('status','unauthorized'); end if;
  update public.minds_mission_runs
  set status='cancelled',phase='cancelled',lease_token=null,lease_until=null,next_attempt_at=null,
      wait_kind=null,wait_ref=null,wake_at=null,completed_at=now(),updated_at=now()
  where id=p_run_id and user_id=v_uid and status in ('queued','running','waiting','waiting_for_user','paused','failed')
  returning * into v_run;
  if not found then return jsonb_build_object('status','unavailable'); end if;
  insert into public.minds_mission_run_events(run_id,user_id,event_type,payload)
  values(v_run.id,v_uid,'cancelled','{}'::jsonb);
  return jsonb_build_object('status','ok','run',to_jsonb(v_run));
end $function$;
REVOKE ALL ON FUNCTION public.minds_cancel_mission_run(p_run_id uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_cancel_mission_run(p_run_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.minds_cancel_mission_run(p_run_id uuid) TO authenticated;
commit;
