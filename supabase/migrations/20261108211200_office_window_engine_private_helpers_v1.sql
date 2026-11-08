-- Office Phase 1: private helper functions of the shared Window motor.
-- Catalog-only DDL, no data. Reproduces vetted source permissions, not public RPC exposure.
-- The minds_private schema remains unavailable through the public PostgREST API.
begin;
CREATE SCHEMA IF NOT EXISTS minds_private;
REVOKE ALL ON SCHEMA minds_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA minds_private TO authenticated, service_role;
CREATE OR REPLACE FUNCTION minds_private.operating_model_sensitive(t text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(t,'') ~* '(health|medical|diagnos|religio|politic|sexual|financ|password|contrase|bank|banco|criminal|race|ethnic|salud|m[eé]dic|religi[oó]n|pol[ií]tic|sexualidad|raza|etnia)';
$function$;
REVOKE ALL ON FUNCTION minds_private.operating_model_sensitive(t text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.operating_model_sensitive(t text) TO service_role;

CREATE OR REPLACE FUNCTION minds_private.post_action_changed_fields(a jsonb, b jsonb, act text)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare k text;out text[]:='{}';
begin
  if act='delete' then return array['deleted']; end if;
  foreach k in array array['title','date','categoryId','notes'] loop
    if coalesce(a->k,'null'::jsonb) is distinct from coalesce(b->k,'null'::jsonb) then
      out:=array_append(out,k);
    end if;
  end loop;
  return out;
end $function$;
REVOKE ALL ON FUNCTION minds_private.post_action_changed_fields(a jsonb, b jsonb, act text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.post_action_changed_fields(a jsonb, b jsonb, act text) TO service_role;

CREATE OR REPLACE FUNCTION minds_private.shadow_changed_fields(a jsonb, b jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(k order by k),'[]') from (
  select k from (select jsonb_object_keys(coalesce(a,'{}')) k union select jsonb_object_keys(coalesce(b,'{}')) k) keys
  where k not in ('request_id','_review') and coalesce(a->k,'null'::jsonb) is distinct from coalesce(b->k,'null'::jsonb)
  union
  select jsonb_array_elements_text(case when jsonb_typeof(b->'_review'->'changed_fields')='array' then b->'_review'->'changed_fields' else '[]'::jsonb end)
 ) changes;
$function$;
REVOKE ALL ON FUNCTION minds_private.shadow_changed_fields(a jsonb, b jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.shadow_changed_fields(a jsonb, b jsonb) TO service_role;

CREATE OR REPLACE FUNCTION minds_private.shadow_class(u uuid, a text, p jsonb, c jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare cat uuid;proj uuid;cn text;pn text;ctx text;reason text;simple boolean;vdate date;
begin
 cn:=nullif(trim(p->>'category'),'');pn:=coalesce(nullif(trim(p->>'project'),''),nullif(trim(c->>'project'),''));
 select case when count(*)=1 then (array_agg(id))[1] end into cat from public.isabella_categories where user_id=u and lower(name)=lower(cn);
 select case when count(*)=1 then (array_agg(id))[1] end into proj from public.isabella_projects where user_id=u and lower(name)=lower(pn) and not archived;
 simple:=a='create_task' and p->>'kind'='task' and p->>'action'='create'
  and length(trim(coalesce(p->>'title',''))) between 1 and 500
  and coalesce(p->>'recurrence','')='' and coalesce(p->>'reminder_time','')=''
  and coalesce(p->>'target_id','')='' and coalesce(p->>'time','')='';
 if nullif(p->>'date','') is not null then
  begin vdate:=(p->>'date')::date;simple:=simple and to_char(vdate,'YYYY-MM-DD')=p->>'date';
  exception when others then simple:=false;end;
 end if;
 ctx:=case
  when c->>'source_tainted'='true' then 'source_derived'
  when c->>'background'='true' then 'background'
  when c->>'autonomy_contract'='fast_task_v1' and c->>'direct_request'='true'
   and c->>'fast_path'='true' and c->>'one_round'='true' and c->>'source_tainted'='false' and c->>'background'='false' and simple
   then case when vdate is null then 'fast_task_undated_v1' else 'fast_task_dated_v1' end
  when c->>'fast_path'='true' then 'fast_unverified'
  when c->>'background'='false' and c->>'source_tainted'='false' then 'interactive_review'
  else 'unknown_context' end;
 reason:=case when a<>'create_task' then 'excluded_action'
  when pn is not null then 'excluded_project_scope'
  when cat is null then 'unresolved_category'
  when ctx not in ('fast_task_undated_v1','fast_task_dated_v1') then 'unverified_or_complex_context'
  else null end;
 return jsonb_build_object('action',a,'context_key',ctx,
  'scope_key','category:'||coalesce(cat::text,'unknown:'||md5(coalesce(cn,'')))||':project:'||coalesce(proj::text,case when pn is null then 'none' else 'unknown:'||md5(pn) end),
  'scope_label',coalesce(cn,'Sin categoría')||' · '||coalesce(pn,'sin proyecto'),
  'category_id',cat,'project_id',proj,'eligible_class',reason is null,'exclusion_reason',reason);
end $function$;
REVOKE ALL ON FUNCTION minds_private.shadow_class(u uuid, a text, p jsonb, c jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.shadow_class(u uuid, a text, p jsonb, c jsonb) TO service_role;

CREATE OR REPLACE FUNCTION minds_private.contextual_evidence(u uuid)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 with corrections as (
  select action,context_key ctx,scope_key scope,
   count(*) corrections,
   max(created_at) last_correction,
   md5(string_agg(id::text,',' order by id)) correction_version
  from public.minds_outcome_feedback
  where user_id=u and created_at>=now()-interval '30 days'
  group by action,context_key,scope_key
 ), classified as (
  select d.*,coalesce(d.context->'autonomy_class',minds_private.shadow_class(u,d.action,d.candidate,d.context)) cls,
   minds_private.shadow_changed_fields(d.candidate,d.reviewed_candidate) fields
  from public.minds_shadow_decisions d where d.user_id=u and d.created_at>=now()-interval '30 days'
 ), observations as (
  select *,case when status='accepted' and jsonb_array_length(fields)>0 then 'edited' else status end outcome from classified
 ), grouped as (
  select action,cls->>'context_key' ctx,cls->>'scope_key' scope,
   (jsonb_agg(cls order by created_at desc)->0) cls,
   count(*) filter(where outcome='accepted') accepted,
   count(*) filter(where outcome='edited') edited,count(*) filter(where outcome='rejected') rejected,
   count(*) filter(where outcome='pending') pending,count(*) filter(where outcome='expired') expired,
   count(*) filter(where outcome='executed') executions,
   count(distinct (resolved_at at time zone 'UTC')::date) filter(where outcome in ('accepted','edited','rejected')) days,
   min(resolved_at) filter(where outcome in ('accepted','edited','rejected')) first_review,
   max(resolved_at) filter(where outcome in ('accepted','edited','rejected')) last_review,
   coalesce(jsonb_agg(jsonb_build_object('id',id,'outcome',outcome,'resolved_at',resolved_at,'changed_fields',fields) order by id) filter(where outcome in ('accepted','edited','rejected')),'[]') evidence
  from observations group by action,cls->>'context_key',cls->>'scope_key'
 )
 select g.cls||jsonb_build_object(
  'accepted_unchanged',g.accepted,'edited',g.edited,'rejected',g.rejected,'pending',g.pending,'expired',g.expired,
  'executed',g.executions,'observations',g.accepted+g.edited+g.rejected,'review_days',g.days,
  'first_review_at',g.first_review,'last_review_at',g.last_review,
  'outcome_corrections',coalesce(c.corrections,0),
  'last_outcome_correction_at',c.last_correction,
  'changed_fields',coalesce((select jsonb_object_agg(field,n) from (
    select f.field,count(*) n from jsonb_array_elements(g.evidence) item cross join lateral jsonb_array_elements_text(item->'changed_fields') f(field)
    where item->>'outcome'='edited' group by f.field) counts),'{}'),
  'evidence_version',md5(g.action||g.ctx||g.scope||g.evidence::text||coalesce(c.correction_version,'')),
  'evidence_ids',(select coalesce(jsonb_agg(item->'id'),'[]') from jsonb_array_elements(g.evidence) item),
  'eligibility',case when g.cls->>'eligible_class'<>'true' then 'excluded'
   when coalesce(c.corrections,0)>0 then 'needs_review'
   when g.edited+g.rejected>0 then 'needs_review'
   when g.accepted<12 or g.days<3 then 'insufficient_evidence'
   when g.last_review<now()-interval '7 days' then 'stale_evidence' else 'eligible' end,
  'suggestion',case when g.cls->>'eligible_class'='true'
    and coalesce(c.corrections,0)=0
    and g.accepted>=12 and g.days>=3 and g.edited+g.rejected=0 and g.last_review>=now()-interval '7 days'
   then 'Puedes autorizar esta clase concreta durante 30 días. Solo tu aprobación cambia el permiso.' else null end)
 from grouped g
 left join corrections c on c.action=g.action and c.ctx=g.ctx and c.scope=g.scope
 order by g.action,g.ctx,g.scope;
$function$;
REVOKE ALL ON FUNCTION minds_private.contextual_evidence(u uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.contextual_evidence(u uuid) TO service_role;

CREATE OR REPLACE FUNCTION minds_private.expectation_due_at(p_date text, p_time text, p_precision text, p_timezone text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_date date; v_time time;
  v_tz text:=coalesce(nullif(trim(p_timezone),''),'Europe/Berlin');
  v_precision text:=case when p_precision='datetime' then 'datetime' else 'date' end;
begin
  begin v_date:=p_date::date; exception when others then raise exception 'Expectation date invalid'; end;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_tz) then raise exception 'Expectation timezone invalid'; end if;
  if v_precision='datetime' then
    if nullif(trim(coalesce(p_time,'')),'') is null then raise exception 'Expectation time required'; end if;
    begin v_time:=p_time::time; exception when others then raise exception 'Expectation time invalid'; end;
  else
    v_time:='23:59:59'::time;
  end if;
  return (v_date+v_time) at time zone v_tz;
end $function$;
REVOKE ALL ON FUNCTION minds_private.expectation_due_at(p_date text, p_time text, p_precision text, p_timezone text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.expectation_due_at(p_date text, p_time text, p_precision text, p_timezone text) TO service_role;
GRANT EXECUTE ON FUNCTION minds_private.expectation_due_at(p_date text, p_time text, p_precision text, p_timezone text) TO authenticated;

CREATE OR REPLACE FUNCTION minds_private.insert_confirmed_model_claim(u uuid, p_claim_type text, p_claim text, p_source_type text, p_evidence jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  x public.isabella_model_claims;
begin
  if u is null or p_claim is null or length(trim(p_claim))=0 then
    raise exception 'model_claim_invalid';
  end if;
  if p_claim_type not in ('preference','habit','pattern','goal','priority','value','working_style','interaction','constraint','other') then
    raise exception 'model_claim_type_invalid';
  end if;
  if p_source_type not in ('explicit','observed') then
    raise exception 'model_claim_source_invalid';
  end if;
  if minds_private.operating_model_sensitive(p_claim) then
    raise exception 'sensitive_model_claim_not_allowed';
  end if;

  select * into x
  from public.isabella_model_claims
  where user_id=u and claim=trim(p_claim) and status='confirmed'
  order by confirmed_at desc nulls last
  limit 1
  for update;

  if found then
    update public.isabella_model_claims
    set claim_type=p_claim_type,
        source_type=case when source_type='explicit' then 'explicit' else p_source_type end,
        evidence=(coalesce(evidence,'[]'::jsonb) || jsonb_build_array(p_evidence)),
        last_seen_at=now(),
        confirmed_at=coalesce(confirmed_at,now()),
        confidence=1
    where id=x.id
    returning * into x;
    return x.id;
  end if;

  insert into public.isabella_model_claims(
    user_id,claim_type,claim,status,confidence,source_type,evidence,
    first_seen_at,last_seen_at,confirmed_at,metadata
  ) values (
    u,p_claim_type,trim(p_claim),'confirmed',1,p_source_type,
    jsonb_build_array(p_evidence),now(),now(),now(),
    jsonb_build_object('operating_model_v','74')
  )
  returning * into x;
  return x.id;
end $function$;
REVOKE ALL ON FUNCTION minds_private.insert_confirmed_model_claim(u uuid, p_claim_type text, p_claim text, p_source_type text, p_evidence jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.insert_confirmed_model_claim(u uuid, p_claim_type text, p_claim text, p_source_type text, p_evidence jsonb) TO service_role;

CREATE OR REPLACE FUNCTION minds_private.create_expectation(p_expectation jsonb, p_request_id uuid, p_confirmed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u uuid:=auth.uid(); e public.minds_expectations;
  v_project uuid:=nullif(p_expectation->>'project_id','')::uuid;
  v_due timestamptz;
  v_precision text:=case when p_expectation->>'due_precision'='datetime' then 'datetime' else 'date' end;
  v_tz text:=coalesce(nullif(trim(p_expectation->>'timezone'),''),'Europe/Berlin');
  v_type text:=coalesce(nullif(trim(p_expectation->>'expectation_type'),''),'other');
  v_source text:=coalesce(nullif(trim(p_expectation->>'source_kind'),''),'conversation');
begin
  if u is null or p_request_id is null or p_confirmed is distinct from true then raise exception 'Explicit expectation confirmation required'; end if;
  if jsonb_typeof(coalesce(p_expectation,'{}'::jsonb))<>'object' then raise exception 'Expectation payload invalid'; end if;
  if length(trim(coalesce(p_expectation->>'title',''))) not between 1 and 500 then raise exception 'Expectation title invalid'; end if;
  if length(trim(coalesce(p_expectation->>'expected_event',''))) not between 1 and 4000 then raise exception 'Expectation event invalid'; end if;
  if v_type not in ('reply','delivery','decision','document','external_event','other') then raise exception 'Expectation type invalid'; end if;
  if v_source not in ('conversation','work','external','manual','system') then raise exception 'Expectation source invalid'; end if;
  if jsonb_typeof(coalesce(p_expectation->'metadata','{}'::jsonb))<>'object' then raise exception 'Expectation metadata invalid'; end if;

  perform pg_advisory_xact_lock(hashtextextended('expectation:'||u::text||':'||p_request_id::text,0));
  select * into e from public.minds_expectations where user_id=u and request_id=p_request_id;
  if found then return jsonb_build_object('status','already_created','expectation',to_jsonb(e)); end if;

  if v_project is not null and not exists(
    select 1 from public.isabella_projects where id=v_project and user_id=u and archived=false
  ) then raise exception 'Expectation project unavailable'; end if;

  v_due:=minds_private.expectation_due_at(
    p_expectation->>'due_date',p_expectation->>'due_time',v_precision,v_tz
  );
  if v_due<=now() then raise exception 'Expectation must describe a future proposition'; end if;

  insert into public.minds_expectations(
    user_id,request_id,project_id,title,expected_event,expectation_type,due_at,due_precision,timezone,
    observability,status,source_kind,source_ref,due_detected_at,resolution_source,metadata
  ) values (
    u,p_request_id,v_project,trim(p_expectation->>'title'),trim(p_expectation->>'expected_event'),
    v_type,v_due,v_precision,v_tz,'manual','active',
    v_source,nullif(trim(coalesce(p_expectation->>'source_ref','')),''),
    null,null,coalesce(p_expectation->'metadata','{}'::jsonb)
  ) returning * into e;

  return jsonb_build_object('status','created','expectation',to_jsonb(e));
end $function$;
REVOKE ALL ON FUNCTION minds_private.create_expectation(p_expectation jsonb, p_request_id uuid, p_confirmed boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.create_expectation(p_expectation jsonb, p_request_id uuid, p_confirmed boolean) TO service_role;
GRANT EXECUTE ON FUNCTION minds_private.create_expectation(p_expectation jsonb, p_request_id uuid, p_confirmed boolean) TO authenticated;

CREATE OR REPLACE FUNCTION minds_private.review_expectation(p_expectation_id uuid, p_decision text, p_note text DEFAULT NULL::text, p_occurred_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_next_date text DEFAULT NULL::text, p_next_time text DEFAULT NULL::text, p_next_precision text DEFAULT NULL::text, p_timezone text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid, p_confirmed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u uuid:=auth.uid(); e public.minds_expectations; r public.minds_expectation_reviews;
  v_prev text; v_previous_due timestamptz; v_due timestamptz; v_precision text; v_tz text;
begin
  if u is null or p_expectation_id is null or p_request_id is null or p_confirmed is distinct from true then raise exception 'Explicit expectation review required'; end if;
  if p_decision not in ('fulfilled','not_occurred','cancel','reschedule') then raise exception 'Expectation decision invalid'; end if;
  if length(coalesce(p_note,''))>4000 then raise exception 'Expectation review note too long'; end if;

  select * into r from public.minds_expectation_reviews where user_id=u and request_id=p_request_id;
  if found then
    if r.expectation_id<>p_expectation_id or r.decision<>p_decision then raise exception 'Expectation request id already used'; end if;
    select * into e from public.minds_expectations where id=r.expectation_id and user_id=u;
    return jsonb_build_object('status','already_reviewed','expectation',to_jsonb(e),'review',to_jsonb(r));
  end if;

  select * into e from public.minds_expectations where id=p_expectation_id and user_id=u for update;
  if not found then return jsonb_build_object('status','missing'); end if;
  if e.status not in ('active','due_unconfirmed') then raise exception 'Expectation already resolved'; end if;
  v_prev:=e.status; v_previous_due:=e.due_at;

  if p_decision='fulfilled' then
    if p_occurred_at is not null and p_occurred_at>now()+interval '5 minutes' then raise exception 'Expectation occurrence cannot be future'; end if;
    update public.minds_expectations
    set status='fulfilled',fulfilled_at=coalesce(p_occurred_at,now()),
        not_occurred_at=null,cancelled_at=null,resolution_source='user',updated_at=now()
    where id=e.id returning * into e;
  elsif p_decision='not_occurred' then
    if e.status<>'due_unconfirmed' or e.due_at>now() then raise exception 'Expectation is not due and unconfirmed'; end if;
    update public.minds_expectations
    set status='not_occurred',not_occurred_at=now(),
        fulfilled_at=null,cancelled_at=null,resolution_source='user',updated_at=now()
    where id=e.id returning * into e;
  elsif p_decision='cancel' then
    update public.minds_expectations
    set status='cancelled',cancelled_at=now(),
        fulfilled_at=null,not_occurred_at=null,resolution_source='user',updated_at=now()
    where id=e.id returning * into e;
  else
    v_precision:=case when p_next_precision='datetime' then 'datetime' else 'date' end;
    v_tz:=coalesce(nullif(trim(p_timezone),''),e.timezone);
    v_due:=minds_private.expectation_due_at(p_next_date,p_next_time,v_precision,v_tz);
    if v_due<=now() then raise exception 'Rescheduled expectation must be future'; end if;
    update public.minds_expectations
    set due_at=v_due,due_precision=v_precision,timezone=v_tz,status='active',
        due_detected_at=null,fulfilled_at=null,not_occurred_at=null,cancelled_at=null,
        resolution_source=null,updated_at=now()
    where id=e.id returning * into e;
  end if;

  insert into public.minds_expectation_reviews(
    user_id,expectation_id,request_id,decision,from_status,to_status,previous_due_at,next_due_at,occurred_at,note
  ) values (
    u,e.id,p_request_id,p_decision,v_prev,e.status,v_previous_due,
    case when p_decision='reschedule' then e.due_at else null end,
    case when p_decision='fulfilled' then e.fulfilled_at else p_occurred_at end,
    nullif(trim(coalesce(p_note,'')),'')
  ) returning * into r;

  update public.minds_attention_events
  set status='resolved',updated_at=now()
  where user_id=u and source_type='expectation' and source_id=e.id::text
    and status in ('pending','delivered','suppressed');

  return jsonb_build_object('status','reviewed','expectation',to_jsonb(e),'review',to_jsonb(r));
end $function$;
REVOKE ALL ON FUNCTION minds_private.review_expectation(p_expectation_id uuid, p_decision text, p_note text, p_occurred_at timestamp with time zone, p_next_date text, p_next_time text, p_next_precision text, p_timezone text, p_request_id uuid, p_confirmed boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.review_expectation(p_expectation_id uuid, p_decision text, p_note text, p_occurred_at timestamp with time zone, p_next_date text, p_next_time text, p_next_precision text, p_timezone text, p_request_id uuid, p_confirmed boolean) TO service_role;
GRANT EXECUTE ON FUNCTION minds_private.review_expectation(p_expectation_id uuid, p_decision text, p_note text, p_occurred_at timestamp with time zone, p_next_date text, p_next_time text, p_next_precision text, p_timezone text, p_request_id uuid, p_confirmed boolean) TO authenticated;

CREATE OR REPLACE FUNCTION minds_private.review_model_claim(p_claim_id uuid, p_status text, p_replacement text DEFAULT NULL::text, p_claim_type text DEFAULT 'other'::text, p_evidence text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid, p_confirmed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u uuid:=auth.uid();
  c public.isabella_model_claims;
  r public.minds_model_claim_reviews;
  replacement_id uuid;
begin
  if u is null or p_claim_id is null or p_confirmed is distinct from true or p_request_id is null then
    raise exception 'Explicit model claim review required';
  end if;
  if p_status not in ('confirmed','contradicted','stale') then raise exception 'Model claim status invalid';end if;
  if length(coalesce(p_replacement,''))>2000 or length(coalesce(p_evidence,''))>2000 then raise exception 'Model claim review too long';end if;
  if p_status<>'contradicted' and nullif(trim(coalesce(p_replacement,'')),'') is not null then raise exception 'Replacement only allowed with contradicted status';end if;

  select * into r from public.minds_model_claim_reviews
  where user_id=u and request_id=p_request_id;
  if found then
    if r.claim_id<>p_claim_id or r.decision<>p_status then raise exception 'Model claim request id already used';end if;
    return jsonb_build_object('status','already_reviewed','claim_id',r.claim_id,'replacement_claim_id',r.replacement_claim_id,'review_id',r.id);
  end if;

  select * into c from public.isabella_model_claims
  where id=p_claim_id and user_id=u for update;
  if not found then return jsonb_build_object('status','missing');end if;

  update public.isabella_model_claims
  set status=p_status,last_seen_at=now(),
      confidence=case when p_status='confirmed' then 1 else confidence end,
      source_type=case when p_status='confirmed' then 'explicit' else source_type end,
      confirmed_at=case when p_status='confirmed' then coalesce(confirmed_at,now()) else confirmed_at end,
      evidence=coalesce(evidence,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
        'source','explicit_user_review','outcome',p_status,'note',nullif(trim(coalesce(p_evidence,'')),''),
        'request_id',p_request_id,'at',now()
      ))
  where id=c.id;

  if p_status='contradicted' and nullif(trim(coalesce(p_replacement,'')),'') is not null then
    replacement_id:=minds_private.insert_confirmed_model_claim(
      u,p_claim_type,trim(p_replacement),'explicit',
      jsonb_build_object('source','user_correction','replaces_claim_id',c.id,'note',nullif(trim(coalesce(p_evidence,'')),''),
        'request_id',p_request_id,'at',now())
    );
  end if;

  insert into public.minds_model_claim_reviews(
    user_id,claim_id,request_id,decision,replacement_claim_id,note
  ) values (u,c.id,p_request_id,p_status,replacement_id,nullif(trim(coalesce(p_evidence,'')),''))
  returning * into r;

  return jsonb_build_object('status','updated','claim_id',c.id,'replacement_claim_id',replacement_id,'review_id',r.id);
end $function$;
REVOKE ALL ON FUNCTION minds_private.review_model_claim(p_claim_id uuid, p_status text, p_replacement text, p_claim_type text, p_evidence text, p_request_id uuid, p_confirmed boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.review_model_claim(p_claim_id uuid, p_status text, p_replacement text, p_claim_type text, p_evidence text, p_request_id uuid, p_confirmed boolean) TO service_role;
GRANT EXECUTE ON FUNCTION minds_private.review_model_claim(p_claim_id uuid, p_status text, p_replacement text, p_claim_type text, p_evidence text, p_request_id uuid, p_confirmed boolean) TO authenticated;

CREATE OR REPLACE FUNCTION minds_private.review_operating_model_hypothesis(p_hypothesis_id uuid, p_decision text, p_replacement text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid, p_confirmed boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u uuid:=auth.uid();
  h public.minds_operating_model_hypotheses;
  r public.minds_operating_model_reviews;
  cid uuid;
begin
  if u is null or p_hypothesis_id is null or p_confirmed is distinct from true or p_request_id is null then
    raise exception 'Explicit operating model review required';
  end if;
  if p_decision not in ('accept','reject','replace','retire') then raise exception 'Operating model review decision invalid';end if;
  if p_decision='replace' and (nullif(trim(coalesce(p_replacement,'')),'') is null or length(p_replacement)>2000) then
    raise exception 'Replacement statement required';
  end if;
  if p_decision<>'replace' and nullif(trim(coalesce(p_replacement,'')),'') is not null then
    raise exception 'Replacement only allowed with replace decision';
  end if;
  if p_decision='replace' and minds_private.operating_model_sensitive(p_replacement) then
    raise exception 'Sensitive operating model replacement not allowed';
  end if;

  select * into r from public.minds_operating_model_reviews
  where user_id=u and request_id=p_request_id;
  if found then
    if r.hypothesis_id<>p_hypothesis_id or r.decision<>p_decision then raise exception 'Operating model request id already used';end if;
    select * into h from public.minds_operating_model_hypotheses where id=r.hypothesis_id and user_id=u;
    return jsonb_build_object('status','already_reviewed','hypothesis',to_jsonb(h),'review',to_jsonb(r));
  end if;

  select * into h from public.minds_operating_model_hypotheses
  where id=p_hypothesis_id and user_id=u for update;
  if not found then return jsonb_build_object('status','missing');end if;

  if p_decision='retire' then
    if h.status not in ('accepted','superseded') or h.accepted_claim_id is null then
      raise exception 'Only active accepted operating rules can be retired';
    end if;
    update public.isabella_model_claims
    set status='stale',last_seen_at=now(),
        evidence=coalesce(evidence,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
          'source','operating_model_retire','hypothesis_id',h.id,'request_id',p_request_id,'at',now()
        ))
    where id=h.accepted_claim_id and user_id=u;
    update public.minds_operating_model_hypotheses
    set status='stale',reviewed_at=now(),updated_at=now()
    where id=h.id returning * into h;
    insert into public.minds_operating_model_reviews(
      user_id,hypothesis_id,decision,replacement_statement,resulting_claim_id,request_id
    ) values (u,h.id,'retire',null,h.accepted_claim_id,p_request_id)
    returning * into r;
    return jsonb_build_object('status','reviewed','decision','retire','hypothesis',to_jsonb(h),'review',to_jsonb(r));
  end if;

  if h.status<>'proposed' then
    select * into r from public.minds_operating_model_reviews where hypothesis_id=h.id order by created_at desc limit 1;
    return jsonb_build_object('status','already_reviewed','hypothesis_status',h.status,'review',case when r.id is null then null else to_jsonb(r) end);
  end if;

  if p_decision='accept' then
    cid:=minds_private.insert_confirmed_model_claim(
      u,h.claim_type,h.statement,'observed',
      jsonb_build_object('source','operating_model_hypothesis','hypothesis_id',h.id,'accepted_by_user',true,'request_id',p_request_id,'evidence_summary',h.evidence_summary,'at',now())
    );
    update public.minds_operating_model_hypotheses
    set status='accepted',accepted_claim_id=cid,reviewed_at=now(),accepted_at=now(),updated_at=now()
    where id=h.id returning * into h;
  elsif p_decision='reject' then
    update public.minds_operating_model_hypotheses
    set status='rejected',reviewed_at=now(),rejected_at=now(),updated_at=now()
    where id=h.id returning * into h;
  else
    cid:=minds_private.insert_confirmed_model_claim(
      u,h.claim_type,trim(p_replacement),'explicit',
      jsonb_build_object('source','operating_model_replacement','hypothesis_id',h.id,'accepted_by_user',true,'request_id',p_request_id,'at',now())
    );
    update public.minds_operating_model_hypotheses
    set status='superseded',accepted_claim_id=cid,reviewed_at=now(),updated_at=now()
    where id=h.id returning * into h;
  end if;

  insert into public.minds_operating_model_reviews(
    user_id,hypothesis_id,decision,replacement_statement,resulting_claim_id,request_id
  ) values (u,h.id,p_decision,case when p_decision='replace' then trim(p_replacement) else null end,cid,p_request_id)
  returning * into r;

  return jsonb_build_object('status','reviewed','decision',p_decision,'hypothesis',to_jsonb(h),'review',to_jsonb(r),'resulting_claim_id',cid);
end $function$;
REVOKE ALL ON FUNCTION minds_private.review_operating_model_hypothesis(p_hypothesis_id uuid, p_decision text, p_replacement text, p_request_id uuid, p_confirmed boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.review_operating_model_hypothesis(p_hypothesis_id uuid, p_decision text, p_replacement text, p_request_id uuid, p_confirmed boolean) TO service_role;
GRANT EXECUTE ON FUNCTION minds_private.review_operating_model_hypothesis(p_hypothesis_id uuid, p_decision text, p_replacement text, p_request_id uuid, p_confirmed boolean) TO authenticated;

CREATE OR REPLACE FUNCTION minds_private.refresh_task_timing_hypothesis(u uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  total_n integer;
  all_day_n integer;
  timed_n integer;
  days_n integer;
  dominant text;
  ratio numeric;
  h public.minds_operating_model_hypotheses;
  obs_ids uuid[];
  stmt text;
  rationale_text text;
begin
  if u is null then return;end if;

  select count(*),
         count(*) filter(where payload->>'timing_mode'='all_day'),
         count(*) filter(where payload->>'timing_mode'='timed'),
         count(distinct (observed_at at time zone 'UTC')::date),
         array_agg(id order by observed_at)
  into total_n,all_day_n,timed_n,days_n,obs_ids
  from public.minds_operating_model_observations
  where user_id=u
    and dimension='task_management'
    and signal_type='proposal_outcome'
    and source_kind='shadow_decision'
    and payload->>'outcome' in ('accepted','edited')
    and payload->>'timing_mode' in ('all_day','timed')
    and observed_at>=now()-interval '60 days';

  if coalesce(total_n,0)<8 or coalesce(days_n,0)<3 then return;end if;
  if all_day_n>=timed_n then dominant:='all_day'; ratio:=all_day_n::numeric/total_n;
  else dominant:='timed'; ratio:=timed_n::numeric/total_n;end if;
  if ratio<0.80 then return;end if;

  if exists(
    select 1 from public.minds_operating_model_hypotheses
    where user_id=u and pattern_key='task_timing_mode'
      and status in ('proposed','accepted','rejected')
  ) then return;end if;

  if dominant='all_day' then
    stmt:='Para tareas con fecha, suelo preferir que Isabella las trate como tareas de día completo salvo que yo indique una hora.';
  else
    stmt:='Para tareas con fecha, suelo preferir que Isabella proponga una hora concreta cuando la información disponible lo permite.';
  end if;

  rationale_text:=format(
    '%s de %s decisiones de tarea con forma temporal explícita siguieron el patrón %s, observadas en %s días durante los últimos 60 días.',
    case when dominant='all_day' then all_day_n else timed_n end,total_n,dominant,days_n
  );

  insert into public.minds_operating_model_hypotheses(
    user_id,dimension,claim_type,statement,inference_kind,pattern_key,
    rationale,evidence_summary,status,metadata
  ) values (
    u,'task_management','working_style',stmt,'deterministic_pattern','task_timing_mode',
    rationale_text,
    jsonb_build_object(
      'support_count',case when dominant='all_day' then all_day_n else timed_n end,
      'total_clear_observations',total_n,
      'observation_days',days_n,
      'dominant_pattern',dominant,
      'ratio',ratio,
      'window_days',60,
      'transparent',true
    ),
    'proposed',
    jsonb_build_object('requires_explicit_review',true,'rule_version','74.0')
  )
  returning * into h;

  insert into public.minds_operating_model_evidence(user_id,hypothesis_id,observation_id,stance)
  select u,h.id,x,'supports'
  from unnest(obs_ids) x
  on conflict(hypothesis_id,observation_id) do nothing;
end $function$;
REVOKE ALL ON FUNCTION minds_private.refresh_task_timing_hypothesis(u uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.refresh_task_timing_hypothesis(u uuid) TO service_role;

CREATE OR REPLACE FUNCTION minds_private.model_claim_review_integrity_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cu uuid;ru uuid;
begin
  select user_id into cu from public.isabella_model_claims where id=new.claim_id;
  if cu is null or cu<>new.user_id then raise exception 'model_claim_review_user_mismatch';end if;
  if new.replacement_claim_id is not null then
    select user_id into ru from public.isabella_model_claims where id=new.replacement_claim_id;
    if ru is null or ru<>new.user_id then raise exception 'model_claim_review_replacement_user_mismatch';end if;
  end if;
  return new;
end $function$;
REVOKE ALL ON FUNCTION minds_private.model_claim_review_integrity_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.model_claim_review_integrity_guard() TO service_role;

CREATE OR REPLACE FUNCTION minds_private.operating_model_integrity_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  hu uuid;
  ou uuid;
  cu uuid;
begin
  if tg_table_name='minds_operating_model_evidence' then
    select user_id into hu from public.minds_operating_model_hypotheses where id=new.hypothesis_id;
    select user_id into ou from public.minds_operating_model_observations where id=new.observation_id;
    if hu is null or ou is null or new.user_id<>hu or new.user_id<>ou then
      raise exception 'operating_model_evidence_user_mismatch';
    end if;
  elsif tg_table_name='minds_operating_model_reviews' then
    select user_id into hu from public.minds_operating_model_hypotheses where id=new.hypothesis_id;
    if hu is null or new.user_id<>hu then
      raise exception 'operating_model_review_user_mismatch';
    end if;
    if new.resulting_claim_id is not null then
      select user_id into cu from public.isabella_model_claims where id=new.resulting_claim_id;
      if cu is null or cu<>new.user_id then
        raise exception 'operating_model_review_claim_user_mismatch';
      end if;
    end if;
  elsif tg_table_name='minds_operating_model_hypotheses' then
    if new.accepted_claim_id is not null then
      select user_id into cu from public.isabella_model_claims where id=new.accepted_claim_id;
      if cu is null or cu<>new.user_id then
        raise exception 'operating_model_hypothesis_claim_user_mismatch';
      end if;
    end if;
  end if;
  return new;
end $function$;
REVOKE ALL ON FUNCTION minds_private.operating_model_integrity_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.operating_model_integrity_guard() TO service_role;

CREATE OR REPLACE FUNCTION minds_private.capture_operating_model_outcome_feedback()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare fp text;
begin
  fp:=md5('outcome_feedback|'||new.id::text);
  insert into public.minds_operating_model_observations(
    user_id,dimension,signal_type,source_kind,source_ref,signal,payload,fingerprint,observed_at
  ) values (
    new.user_id,'task_management','confirmed_correction','outcome_feedback',new.id::text,
    'confirmed post-action correction',
    jsonb_build_object(
      'action',new.action,
      'context_key',new.context_key,
      'scope_key',new.scope_key,
      'changed_fields',to_jsonb(new.changed_fields)
    ),
    fp,new.created_at
  )
  on conflict(user_id,fingerprint) do nothing;
  return new;
end $function$;
REVOKE ALL ON FUNCTION minds_private.capture_operating_model_outcome_feedback() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.capture_operating_model_outcome_feedback() TO service_role;

CREATE OR REPLACE FUNCTION minds_private.capture_operating_model_proposal_feedback()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  kind text;
  fp text;
begin
  kind:=coalesce(new.proposal->>'kind',new.proposal->>'type',new.proposal->>'action','unknown');
  fp:=md5('proposal_feedback|'||new.id::text);
  insert into public.minds_operating_model_observations(
    user_id,dimension,signal_type,source_kind,source_ref,signal,payload,fingerprint,observed_at
  ) values (
    new.user_id,
    case when kind in ('task','event','routine') then 'planning' else 'review' end,
    'proposal_outcome','proposal_feedback',new.id::text,
    'proposal '||new.outcome,
    jsonb_build_object('proposal_kind',kind,'outcome',new.outcome),
    fp,new.created_at
  )
  on conflict(user_id,fingerprint) do nothing;
  return new;
end $function$;
REVOKE ALL ON FUNCTION minds_private.capture_operating_model_proposal_feedback() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.capture_operating_model_proposal_feedback() TO service_role;

CREATE OR REPLACE FUNCTION minds_private.capture_operating_model_shadow_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  final jsonb;
  mode text:='unspecified';
  fp text;
begin
  if new.status is not distinct from old.status then return new;end if;
  if new.action not in ('create_task','update_task') or new.status not in ('accepted','edited','rejected') then return new;end if;

  final:=coalesce(new.reviewed_candidate,new.candidate,'{}'::jsonb);
  if coalesce((final->>'all_day')::boolean,false) then mode:='all_day';
  elsif nullif(trim(final->>'time'),'') is not null then mode:='timed';
  end if;

  fp:=md5('shadow_decision|'||new.id::text||'|'||new.status);
  insert into public.minds_operating_model_observations(
    user_id,dimension,signal_type,source_kind,source_ref,signal,payload,fingerprint,observed_at
  ) values (
    new.user_id,'task_management','proposal_outcome','shadow_decision',new.id::text,
    'task proposal '||new.status,
    jsonb_build_object(
      'action',new.action,
      'outcome',new.status,
      'timing_mode',mode,
      'duration_present',(final ? 'duration_minutes' and final->'duration_minutes' is not null),
      'recurrence_present',(final ? 'recurrence' and final->'recurrence' is not null)
    ),
    fp,coalesce(new.resolved_at,now())
  )
  on conflict(user_id,fingerprint) do nothing;

  perform minds_private.refresh_task_timing_hypothesis(new.user_id);
  return new;
end $function$;
REVOKE ALL ON FUNCTION minds_private.capture_operating_model_shadow_decision() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.capture_operating_model_shadow_decision() TO service_role;

CREATE OR REPLACE FUNCTION minds_private.capture_post_action_feedback_candidate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  x public.minds_autonomy_executions;
  p public.minds_contextual_permissions;
  fields text[];
begin
  if new.source<>'manual' or new.entity_type<>'task' or new.action not in ('update','delete') then
    return new;
  end if;

  select * into x
  from public.minds_autonomy_executions
  where user_id=new.user_id
    and ('autonomy:'||request_id::text)=new.entity_key
    and created_at<=new.created_at
    and created_at>=new.created_at-interval '48 hours'
  order by created_at desc
  limit 1;

  if not found then return new; end if;

  if exists(
    select 1
    from public.minds_post_action_feedback_candidates c
    where c.user_id=new.user_id
      and c.autonomy_execution_id=x.id
  ) then
    return new;
  end if;

  fields:=minds_private.post_action_changed_fields(new.before_state,new.after_state,new.action);
  if cardinality(fields)=0 then return new; end if;

  select * into p from public.minds_contextual_permissions
  where id=x.permission_id and user_id=new.user_id;
  if not found then return new; end if;

  insert into public.minds_post_action_feedback_candidates(
    user_id,autonomy_execution_id,activity_id,permission_id,permission_revision,
    action,context_key,scope_key,scope_label,entity_type,entity_key,mutation_action,
    changed_fields,before_state,after_state
  ) values (
    new.user_id,x.id,new.id,x.permission_id,x.permission_revision,
    p.action,p.context_key,p.scope_key,p.scope_label,'task',new.entity_key,new.action,
    fields,new.before_state,new.after_state
  )
  on conflict(autonomy_execution_id) do nothing;

  return new;
end $function$;
REVOKE ALL ON FUNCTION minds_private.capture_post_action_feedback_candidate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.capture_post_action_feedback_candidate() TO service_role;

CREATE OR REPLACE FUNCTION minds_private.stamp_shadow_class()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 new.context:=coalesce(new.context,'{}')||jsonb_build_object('autonomy_class',minds_private.shadow_class(new.user_id,new.action,new.candidate,new.context));
 return new;
end $function$;
REVOKE ALL ON FUNCTION minds_private.stamp_shadow_class() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION minds_private.stamp_shadow_class() TO service_role;
commit;
