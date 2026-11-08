-- Phase 1 Office · worker/heartbeat/attention RPCs.
-- Catalog-only Window definitions scoped to Office database and per-member state.
-- No direct browser EXECUTE; the trusted runner uses service_role.
-- Office has no Feed: ambient attention becomes a briefing candidate, never a new surface.
-- Continuity refers to Office team membership, not Window single-owner projects.
begin;
CREATE OR REPLACE FUNCTION public.minds_attention_profile(p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_pref jsonb:='{}'::jsonb;
  v_attention jsonb:='{}'::jsonb;
begin
  select value into v_pref
  from public.isabella_preferences
  where user_id=p_user and preference_key='assistant' and status<>'rejected'
  order by updated_at desc limit 1;

  if jsonb_typeof(v_pref->'attention')='object' then v_attention:=v_pref->'attention'; end if;

  return jsonb_build_object(
    'missionCompleted','briefing',
    'missionFailed','briefing',
    'imminentEvent','interrupt',
    'overdueTasks','ambient',
    'routineFailure','briefing',
    'maxInterruptionsPerHour',3,
    'quietHoursEnabled',false,
    'quietStart','22:00',
    'quietEnd','07:00'
  ) || v_attention;
end $function$;
REVOKE ALL ON FUNCTION public.minds_attention_profile(p_user uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_attention_profile(p_user uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_route_attention(p_user uuid, p_candidate jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_profile jsonb:=public.minds_attention_profile(p_user);
  v_type text:=coalesce(p_candidate->>'event_type','unknown');
  v_route text:='silent'; v_base_route text:='silent';
  v_reason text:='default_silent'; v_base_reason text:='default_silent';
  v_hard boolean:=false; v_tz text:=nullif(p_candidate->>'timezone','');
  v_local_time time; v_quiet_start time; v_quiet_end time; v_quiet boolean:=false;
  v_max integer:=greatest(0,least(12,coalesce((v_profile->>'maxInterruptionsPerHour')::integer,3)));
  v_recent integer:=0;
begin
  if coalesce((p_candidate->>'requires_user')::boolean,false) then
    v_route:='interrupt';v_reason:='needs_user_input';v_hard:=true;
  elsif coalesce((p_candidate->>'user_requested')::boolean,false) then
    v_route:='interrupt';v_reason:='explicit_user_request';v_hard:=true;
  elsif coalesce((p_candidate->>'silent_requested')::boolean,false) then
    v_route:='silent';v_reason:='explicit_silence_request';
  elsif coalesce((p_candidate->>'suppress')::boolean,false) then
    v_route:='silent';v_reason:='source_suppressed';
  else
    case v_type
      when 'chat_reply_ready' then v_route:='interrupt';v_reason:='chat_reply_ready';
      when 'mission_completed' then v_route:=coalesce(nullif(v_profile->>'missionCompleted',''),'briefing');v_reason:='mission_completed';
      when 'mission_failed' then v_route:=coalesce(nullif(v_profile->>'missionFailed',''),'briefing');v_reason:='mission_failed';
      when 'mission_waiting_for_user' then v_route:='interrupt';v_reason:='needs_user_input';v_hard:=true;
      when 'upcoming_event' then v_route:=coalesce(nullif(v_profile->>'imminentEvent',''),'interrupt');v_reason:='imminent_event';
      when 'overdue_digest' then v_route:=coalesce(nullif(v_profile->>'overdueTasks',''),'ambient');v_reason:='overdue_tasks';
      when 'routine_failure' then v_route:=coalesce(nullif(v_profile->>'routineFailure',''),'briefing');v_reason:='routine_failure';
      when 'expectation_due' then v_route:='ambient';v_reason:='expectation_due';
      when 'review_required' then v_route:='briefing';v_reason:='review_required';
      when 'review_window_closing' then v_route:='ambient';v_reason:='review_window_closing';
      when 'situational_review' then
        v_route:=case when p_candidate->>'urgency'='urgent' then 'interrupt' else 'ambient' end;
        v_reason:='contextual_reassessment';
      else v_route:='silent';v_reason:='default_silent';
    end case;
  end if;

  if v_route not in ('interrupt','briefing','ambient','silent') then v_route:='briefing'; end if;
  v_base_route:=v_route;v_base_reason:=v_reason;

  if v_route='interrupt' and not v_hard then
    if v_tz is null then
      select timezone into v_tz from public.isabella_routines where user_id=p_user and enabled order by created_at asc limit 1;
    end if;
    v_tz:=coalesce(v_tz,'Europe/Berlin');
    if coalesce((v_profile->>'quietHoursEnabled')::boolean,false) then
      begin
        v_local_time:=(now() at time zone v_tz)::time;
        v_quiet_start:=coalesce(nullif(v_profile->>'quietStart','')::time,'22:00'::time);
        v_quiet_end:=coalesce(nullif(v_profile->>'quietEnd','')::time,'07:00'::time);
        if v_quiet_start=v_quiet_end then v_quiet:=true;
        elsif v_quiet_start<v_quiet_end then v_quiet:=v_local_time>=v_quiet_start and v_local_time<v_quiet_end;
        else v_quiet:=v_local_time>=v_quiet_start or v_local_time<v_quiet_end;
        end if;
      exception when others then v_quiet:=false;
      end;
      if v_quiet then v_route:='briefing';v_reason:='quiet_hours'; end if;
    end if;
    if v_route='interrupt' then
      select count(*) into v_recent from public.minds_attention_events
      where user_id=p_user and route='interrupt' and delivered_at>=now()-interval '1 hour';
      if v_recent>=v_max then v_route:='briefing';v_reason:='interruption_budget'; end if;
    end if;
  end if;

  return jsonb_build_object(
    'route',v_route,'reason_code',v_reason,
    'reason',case v_reason
      when 'needs_user_input' then 'El trabajo está bloqueado hasta que decidas algo.'
      when 'explicit_user_request' then 'Pediste explícitamente que Isabella te avisara.'
      when 'explicit_silence_request' then 'Pediste explícitamente no recibir aviso al terminar.'
      when 'source_suppressed' then 'La fuente aún no ha alcanzado el umbral para mostrarse.'
      when 'chat_reply_ready' then 'Isabella terminó una respuesta de Chat.'
      when 'mission_completed' then 'El trabajo terminó, pero no requiere una decisión inmediata.'
      when 'mission_failed' then 'El trabajo se detuvo y conviene incluirlo en el próximo resumen.'
      when 'imminent_event' then 'Hay un evento próximo cuyo valor depende del tiempo.'
      when 'overdue_tasks' then 'Es una señal personal/productiva útil, pero no exige interrumpir.'
      when 'routine_failure' then 'Conviene conocer el fallo, pero normalmente puede esperar al briefing.'
      when 'expectation_due' then 'Algo que esperabas alcanzó su fecha límite y todavía no está confirmado.'
      when 'review_required' then 'Hay una revisión importante pendiente, pero no bloquea el trabajo inmediato.'
      when 'review_window_closing' then 'Una revisión reversible está cerca de perder utilidad por el paso del tiempo.'
      when 'contextual_reassessment' then 'Una circunstancia contrastada puede hacer recomendable revisar un plan.'
      when 'quiet_hours' then 'La señal no era bloqueante y cayó dentro de las horas silenciosas.'
      when 'interruption_budget' then 'Ya hubo suficientes interrupciones no bloqueantes durante la última hora.'
      else 'No existe una razón suficiente para ocupar tu atención ahora.'
    end,
    'base_route',v_base_route,'base_reason_code',v_base_reason,'hard_interrupt',v_hard,
    'quiet_hours_applied',v_quiet,'recent_interruptions',v_recent,
    'max_interruptions_per_hour',v_max,'policy_version','attention_v1'
  );
end $function$;
REVOKE ALL ON FUNCTION public.minds_route_attention(p_user uuid, p_candidate jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_route_attention(p_user uuid, p_candidate jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_publish_attention(p_user uuid, p_candidate jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_key text:=left(trim(coalesce(p_candidate->>'event_key','')),500);
  v_decision jsonb;
  v_event public.minds_attention_events;
  v_existing boolean:=false;
  v_route text;
  v_conv uuid;
  v_mid uuid;
  v_sid uuid;
  v_status text;
begin
  if p_user is null or v_key='' then raise exception 'attention candidate requires user and event_key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||':'||v_key,0));
  v_decision:=public.minds_route_attention(p_user,p_candidate);
  v_route:=v_decision->>'route';
  -- Office has no Feed/Orb: an ambient decision is deferred to the owner's briefing.
  if v_route='ambient' then
    v_route:='briefing';
    v_decision:=jsonb_set(v_decision,'{route}','"briefing"'::jsonb,true);
  end if;

  select * into v_event
  from public.minds_attention_events
  where user_id=p_user and event_key=v_key
  for update;

  if found then
    v_existing:=true;
    if v_event.status in ('delivered','consumed','dismissed','resolved') then
      return jsonb_build_object('status',v_event.status,'id',v_event.id,'route',v_event.route,'duplicate',true,'message_id',v_event.message_id,'surface_item_id',v_event.surface_item_id);
    end if;

    update public.minds_attention_events set
      source_type=coalesce(nullif(p_candidate->>'source_type',''),source_type),
      source_id=coalesce(nullif(p_candidate->>'source_id',''),source_id),
      event_type=coalesce(nullif(p_candidate->>'event_type',''),event_type),
      title=left(coalesce(nullif(p_candidate->>'title',''),title),500),
      body=left(coalesce(p_candidate->>'body',body),12000),
      urgency=case when p_candidate->>'urgency' in ('info','attention','urgent') then p_candidate->>'urgency' else urgency end,
      requires_user=coalesce((p_candidate->>'requires_user')::boolean,requires_user),
      user_requested=coalesce((p_candidate->>'user_requested')::boolean,user_requested),
      deadline_at=coalesce(nullif(p_candidate->>'deadline_at','')::timestamptz,deadline_at),
      route=v_route,
      reason_code=v_decision->>'reason_code',
      reason=v_decision->>'reason',
      policy_version='attention_v1',
      status=case when v_route='silent' then 'suppressed' else 'pending' end,
      factors=v_decision,
      metadata=metadata||coalesce(p_candidate->'metadata','{}'::jsonb),
      updated_at=now()
    where id=v_event.id
    returning * into v_event;
  else
    insert into public.minds_attention_events(
      user_id,event_key,source_type,source_id,event_type,title,body,urgency,requires_user,user_requested,deadline_at,
      route,reason_code,reason,policy_version,status,factors,metadata
    ) values (
      p_user,v_key,
      coalesce(nullif(p_candidate->>'source_type',''),'system'),
      nullif(p_candidate->>'source_id',''),
      coalesce(nullif(p_candidate->>'event_type',''),'unknown'),
      left(coalesce(nullif(p_candidate->>'title',''),'Actualización de Romy'),500),
      left(coalesce(p_candidate->>'body',''),12000),
      case when p_candidate->>'urgency' in ('info','attention','urgent') then p_candidate->>'urgency' else 'info' end,
      coalesce((p_candidate->>'requires_user')::boolean,false),
      coalesce((p_candidate->>'user_requested')::boolean,false),
      nullif(p_candidate->>'deadline_at','')::timestamptz,
      v_route,v_decision->>'reason_code',v_decision->>'reason','attention_v1',
      case when v_route='silent' then 'suppressed' else 'pending' end,
      v_decision,coalesce(p_candidate->'metadata','{}'::jsonb)
    ) returning * into v_event;
  end if;

  if v_route='silent' then
    return jsonb_build_object('status','suppressed','id',v_event.id,'route',v_route,'duplicate',v_existing,'reason_code',v_event.reason_code);
  elsif v_route='briefing' then
    return jsonb_build_object('status','pending','id',v_event.id,'route',v_route,'duplicate',v_existing,'reason_code',v_event.reason_code);
  else
    select id into v_conv from public.conversations
    where user_id=p_user and app_scope='isabella'
    order by updated_at desc limit 1;

    if v_conv is null then
      insert into public.conversations(user_id,app_scope,origin_kind,origin_anchor,title,mode,metadata)
      values(p_user,'isabella','global','{"type":"assistant","id":"isabella","label":"Romy"}','Romy','memory','{"app":"isabella"}')
      returning id into v_conv;
    end if;

    insert into public.conversation_messages(user_id,conversation_id,role,content,provisional,citations,metadata,client_key)
    values(
      p_user,v_conv,'assistant',v_event.body,false,'[]'::jsonb,
      jsonb_build_object(
        'app','isabella','source','attention_runtime','attention_event_id',v_event.id,'attention_route','interrupt',
        'attention_reason',v_event.reason_code,'source_type',v_event.source_type,'source_id',v_event.source_id
      )||v_event.metadata,
      'attention:'||v_event.id
    )
    on conflict(user_id,conversation_id,client_key) do update set content=excluded.content
    returning id into v_mid;

    update public.conversations set updated_at=now() where id=v_conv and user_id=p_user;
    update public.minds_attention_events
    set status='delivered',message_id=v_mid,delivered_at=now(),updated_at=now()
    where id=v_event.id returning status into v_status;
    return jsonb_build_object('status',v_status,'id',v_event.id,'route',v_route,'message_id',v_mid,'reason_code',v_event.reason_code);
  end if;
end $function$;
REVOKE ALL ON FUNCTION public.minds_publish_attention(p_user uuid, p_candidate jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_publish_attention(p_user uuid, p_candidate jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_publish_continuity_signal(p_user uuid, p_signal jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  sig public.minds_continuity_signals;
  c public.minds_commitments;
  project uuid;
  occurred timestamptz:=now();
  signal_terms text[];
  commitment_terms text[];
  overlap_count integer;
  explicit_match boolean;
  project_match boolean;
  link_id uuid;
  linked_count integer:=0;
  reactivated_count integer:=0;
  kind text;
  score numeric(4,3);
  reason text;
  source_kind text:=lower(trim(coalesce(p_signal->>'source_kind','system')));
  fp text:=trim(coalesce(p_signal->>'fingerprint',''));
  et text:=trim(coalesce(p_signal->>'event_type','change'));
  ttl text:=trim(coalesce(p_signal->>'title',''));
  bdy text:=coalesce(p_signal->>'body','');
  meta jsonb:=coalesce(p_signal->'metadata','{}'::jsonb);
  prior_status text;
  last_continuity jsonb;
begin
  if p_user is null or fp='' or ttl='' then raise exception 'Invalid continuity signal'; end if;
  if source_kind not in ('heartbeat','work','conversation','routine','project','system') then raise exception 'Invalid continuity source'; end if;
  if jsonb_typeof(meta)<>'object' then raise exception 'Invalid continuity metadata'; end if;
  if nullif(p_signal->>'project_id','') is not null then
    begin project:=(p_signal->>'project_id')::uuid; exception when others then raise exception 'Invalid continuity project'; end;
    if not exists(select 1 from public.office_projects p join public.office_project_members pm on pm.project_id=p.id where p.id=project and p.status='aktiv' and pm.user_id=p_user) then raise exception 'Continuity project not accessible'; end if;
  end if;
  if nullif(p_signal->>'occurred_at','') is not null then
    begin occurred:=(p_signal->>'occurred_at')::timestamptz; exception when others then occurred:=now(); end;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('continuity:'||p_user::text||':'||fp,0));
  select * into sig from public.minds_continuity_signals where user_id=p_user and fingerprint=fp for update;
  if not found then
    insert into public.minds_continuity_signals(user_id,source_kind,source_id,fingerprint,event_type,title,body,project_id,occurred_at,metadata)
    values(p_user,source_kind,nullif(p_signal->>'source_id',''),fp,et,ttl,bdy,project,occurred,meta)
    returning * into sig;
  else
    update public.minds_continuity_signals
    set last_seen_at=now(),title=ttl,body=bdy,event_type=et,project_id=coalesce(project,project_id),
        source_id=coalesce(nullif(p_signal->>'source_id',''),source_id),metadata=meta
    where id=sig.id returning * into sig;
  end if;

  signal_terms:=public.minds_continuity_terms(ttl||' '||bdy);

  for c in
    select * from public.minds_commitments
    where user_id=p_user and status in ('active','waiting')
    order by updated_at desc
  loop
    if c.project_id is not null and project is not null and c.project_id<>project then continue; end if;
    explicit_match:=exists(
      select 1 from jsonb_array_elements_text(
        case when jsonb_typeof(p_signal->'commitment_ids')='array' then p_signal->'commitment_ids' else '[]'::jsonb end
      ) x(value) where x.value=c.id::text
    );
    project_match:=project is not null and c.project_id=project;
    commitment_terms:=public.minds_continuity_terms(c.title||' '||c.objective||' '||coalesce(c.completion_criteria,''));
    select count(*) into overlap_count
    from (select unnest(signal_terms) intersect select unnest(commitment_terms)) z;

    if explicit_match then
      kind:='explicit';score:=1.000;reason:='Vínculo explícito con el Commitment.';
    elsif project_match then
      kind:='project';score:=0.950;reason:='Cambio dentro del mismo proyecto.';
    elsif overlap_count>=2 then
      kind:='terms';score:=least(0.900,0.550+(overlap_count::numeric*0.100));reason:=overlap_count||' términos relevantes compartidos.';
    else
      continue;
    end if;

    link_id:=null;
    insert into public.minds_commitment_signal_links(user_id,commitment_id,signal_id,match_kind,relevance,reason)
    values(p_user,c.id,sig.id,kind,score,reason)
    on conflict(commitment_id,signal_id) do nothing
    returning id into link_id;
    if link_id is null then continue; end if;

    linked_count:=linked_count+1;
    prior_status:=c.status;
    last_continuity:=jsonb_build_object(
      'signal_id',sig.id,'signal_title',sig.title,'signal_body',sig.body,'source_kind',sig.source_kind,
      'event_type',sig.event_type,'project_id',sig.project_id,'match_kind',kind,'relevance',score,
      'reason',reason,'occurred_at',sig.occurred_at,'linked_at',now()
    );

    if prior_status='waiting' then
      update public.minds_commitments
      set status='active',updated_at=now(),metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{last_continuity}',last_continuity,true)
      where id=c.id and user_id=p_user and status='waiting';
      if found then
        reactivated_count:=reactivated_count+1;
        insert into public.minds_commitment_events(user_id,commitment_id,event_type,body,from_status,to_status,source_kind,source,metadata)
        values(p_user,c.id,'reactivated','Cambio relevante: '||sig.title,'waiting','active',source_kind,
          jsonb_build_object('signal_id',sig.id,'source_id',sig.source_id,'fingerprint',sig.fingerprint),
          jsonb_build_object('match_kind',kind,'relevance',score,'reason',reason));
      end if;
    else
      update public.minds_commitments
      set updated_at=now(),metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{last_continuity}',last_continuity,true)
      where id=c.id and user_id=p_user;
      insert into public.minds_commitment_events(user_id,commitment_id,event_type,body,from_status,to_status,source_kind,source,metadata)
      values(p_user,c.id,'signal_linked','Cambio relevante: '||sig.title,prior_status,prior_status,source_kind,
        jsonb_build_object('signal_id',sig.id,'source_id',sig.source_id,'fingerprint',sig.fingerprint),
        jsonb_build_object('match_kind',kind,'relevance',score,'reason',reason));
    end if;
  end loop;

  return jsonb_build_object('signal_id',sig.id,'linked',linked_count,'reactivated',reactivated_count);
end $function$;
REVOKE ALL ON FUNCTION public.minds_publish_continuity_signal(p_user uuid, p_signal jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_publish_continuity_signal(p_user uuid, p_signal jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_publish_heartbeat(p_user uuid, p_candidate jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  e public.minds_heartbeat_events;
  fresh boolean:=false;
  a jsonb;
  continuity jsonb;
  suppress boolean:=false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||(p_candidate->>'fingerprint'),0));
  select * into e from public.minds_heartbeat_events
  where user_id=p_user and fingerprint=p_candidate->>'fingerprint'
  for update;

  if not found then
    insert into public.minds_heartbeat_events(user_id,event_type,fingerprint,severity,title,body,project_id,source,metadata)
    values(
      p_user,p_candidate->>'event_type',p_candidate->>'fingerprint',coalesce(p_candidate->>'severity','attention'),
      p_candidate->>'title',coalesce(p_candidate->>'body',''),nullif(p_candidate->>'project_id','')::uuid,
      coalesce(p_candidate->'source','{}'),coalesce(p_candidate->'metadata','{}')
    ) returning * into e;
    fresh:=true;
  else
    update public.minds_heartbeat_events set
      last_seen_at=now(),source=coalesce(p_candidate->'source','{}'),metadata=coalesce(p_candidate->'metadata','{}'),
      title=p_candidate->>'title',body=coalesce(p_candidate->>'body','')
    where id=e.id returning * into e;
  end if;

  suppress:=coalesce((p_candidate->>'surface')::boolean,true)=false;
  a:=public.minds_publish_attention(
    p_user,
    jsonb_build_object(
      'event_key','heartbeat:'||e.fingerprint,
      'source_type','heartbeat',
      'source_id',e.id::text,
      'event_type',e.event_type,
      'title',e.title,
      'body',e.body,
      'urgency',e.severity,
      'deadline_at',case when e.event_type='upcoming_event' then e.source->>'starts_at' else null end,
      'timezone',coalesce(p_candidate->>'timezone',''),
      'suppress',suppress,
      'metadata',jsonb_build_object('heartbeat_event_id',e.id,'fingerprint',e.fingerprint,'project_id',e.project_id)
    )
  );

  continuity:=public.minds_publish_continuity_signal(
    p_user,
    jsonb_build_object(
      'source_kind','heartbeat',
      'source_id',e.id::text,
      'fingerprint','heartbeat:'||e.fingerprint,
      'event_type',e.event_type,
      'title',e.title,
      'body',e.body,
      'project_id',e.project_id,
      'occurred_at',e.first_seen_at,
      'metadata',jsonb_build_object('heartbeat_event_id',e.id,'severity',e.severity,'attention_event_id',a->>'id','attention_route',a->>'route')
    )
  );

  if a->>'status' in ('delivered','consumed') and a->>'route' in ('interrupt','ambient') then
    update public.minds_heartbeat_events set status='surfaced',surfaced_at=coalesce(surfaced_at,now()) where id=e.id;
  end if;

  return jsonb_build_object(
    'id',e.id,'created',fresh,'surfaced',(a->>'status')='delivered',
    'attention_event_id',a->>'id','attention_route',a->>'route','attention_status',a->>'status',
    'continuity',continuity
  );
end $function$;
REVOKE ALL ON FUNCTION public.minds_publish_heartbeat(p_user uuid, p_candidate jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_publish_heartbeat(p_user uuid, p_candidate jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_heartbeat_users()
 RETURNS TABLE(user_id uuid, timezone text)
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with ids as (
    select user_id from public.isabella_routines where enabled
    union select user_id from public.isabella_tasks where archived_at is null
    union select user_id from public.isabella_events where starts_at>=now()-interval '1 hour'
    union select user_id from public.conversations where app_scope='isabella'
    union select user_id from public.minds_expectations where status in ('active','due_unconfirmed')
    union select user_id from public.minds_standing_intents where status in ('pending','armed','fired')
    union select user_id from public.minds_shadow_decisions where status='pending'
  )
  select i.user_id,
         coalesce(
           (select r.timezone from public.isabella_routines r where r.user_id=i.user_id and r.enabled order by r.created_at limit 1),
           (select e.timezone from public.minds_expectations e where e.user_id=i.user_id and e.status in ('active','due_unconfirmed') order by e.created_at limit 1),
           'Europe/Berlin'
         )
  from ids i;
$function$;
REVOKE ALL ON FUNCTION public.minds_heartbeat_users() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_heartbeat_users() TO service_role;

CREATE OR REPLACE FUNCTION public.minds_claim_delivery_intents(p_limit integer DEFAULT 12)
 RETURNS SETOF minds_delivery_intents
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update public.minds_delivery_intents
  set status='skipped',last_error='expired',lease_token=null,lease_until=null,updated_at=now()
  where status in ('pending','retry','processing') and expires_at<=now();

  return query
  with picked as (
    select id
    from public.minds_delivery_intents
    where expires_at>now()
      and next_attempt_at<=now()
      and (
        status in ('pending','retry')
        or (status='processing' and lease_until<now())
      )
    order by created_at asc
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,12),50))
  )
  update public.minds_delivery_intents d
  set status='processing',
      attempt_count=d.attempt_count+1,
      lease_token=gen_random_uuid(),
      lease_until=now()+interval '3 minutes',
      updated_at=now()
  from picked
  where d.id=picked.id
  returning d.*;
end $function$;
REVOKE ALL ON FUNCTION public.minds_claim_delivery_intents(p_limit integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_claim_delivery_intents(p_limit integer) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_finish_delivery_intent(p_intent_id uuid, p_lease_token uuid, p_results jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_intent public.minds_delivery_intents;
  v_result jsonb;
  v_accepted integer:=0;
  v_failed integer:=0;
  v_gone integer:=0;
  v_status text;
  v_error text:=null;
  v_delay integer:=5;
begin
  if jsonb_typeof(coalesce(p_results,'[]'::jsonb))<>'array' then raise exception 'results must be array'; end if;

  select * into v_intent
  from public.minds_delivery_intents
  where id=p_intent_id and lease_token=p_lease_token and status='processing'
  for update;
  if not found then return jsonb_build_object('status','stale'); end if;

  for v_result in select value from jsonb_array_elements(coalesce(p_results,'[]'::jsonb))
  loop
    if v_result->>'status'='accepted' then v_accepted:=v_accepted+1;
    elsif v_result->>'status'='gone' then v_gone:=v_gone+1;
    else v_failed:=v_failed+1; end if;

    insert into public.minds_delivery_attempts(
      user_id,intent_id,subscription_id,status,http_status,error,endpoint_hash
    ) values (
      v_intent.user_id,
      v_intent.id,
      nullif(v_result->>'subscription_id','')::uuid,
      case when v_result->>'status' in ('accepted','gone','failed') then v_result->>'status' else 'failed' end,
      nullif(v_result->>'http_status','')::integer,
      left(nullif(v_result->>'error',''),2000),
      left(nullif(v_result->>'endpoint_hash',''),128)
    );

    if v_result->>'status'='gone' and nullif(v_result->>'subscription_id','') is not null then
      update public.minds_push_subscriptions
      set active=false,updated_at=now()
      where id=(v_result->>'subscription_id')::uuid and user_id=v_intent.user_id;
    end if;
  end loop;

  if v_accepted>0 then
    v_status:='sent';
  elsif not exists(select 1 from public.minds_push_subscriptions where user_id=v_intent.user_id and active) then
    v_status:='skipped';
    v_error:='no_active_subscription';
  elsif v_intent.attempt_count<4 and v_intent.expires_at>now() then
    v_status:='retry';
    v_delay:=least(60,5*cast(power(2,greatest(0,v_intent.attempt_count-1)) as integer));
    v_error:=case when v_failed>0 then 'push_failed' else 'no_delivery_accepted' end;
  else
    v_status:='failed';
    v_error:=case when v_failed>0 then 'push_failed' else 'delivery_exhausted' end;
  end if;

  update public.minds_delivery_intents
  set status=v_status,
      next_attempt_at=case when v_status='retry' then now()+make_interval(mins=>v_delay) else next_attempt_at end,
      sent_at=case when v_status='sent' then now() else sent_at end,
      last_error=v_error,
      lease_token=null,
      lease_until=null,
      metadata=metadata||jsonb_build_object('accepted',v_accepted,'gone',v_gone,'failed',v_failed),
      updated_at=now()
  where id=v_intent.id;

  return jsonb_build_object(
    'status',v_status,
    'accepted',v_accepted,
    'gone',v_gone,
    'failed',v_failed,
    'retry_minutes',case when v_status='retry' then v_delay else null end
  );
end $function$;
REVOKE ALL ON FUNCTION public.minds_finish_delivery_intent(p_intent_id uuid, p_lease_token uuid, p_results jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_finish_delivery_intent(p_intent_id uuid, p_lease_token uuid, p_results jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_claim_mission_runs(p_limit integer DEFAULT 6)
 RETURNS SETOF minds_mission_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  with due as (
    select id
    from public.minds_mission_runs
    where (
      status='queued' and coalesce(next_attempt_at,now())<=now()
    ) or (
      status='running' and lease_until is not null and lease_until<now()
    )
    order by coalesce(next_attempt_at,created_at),created_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,6),12))
  ),
  claimed as (
    update public.minds_mission_runs r
    set status='running',phase='working',iteration=r.iteration+1,
        lease_token=gen_random_uuid(),lease_until=now()+interval '4 minutes',
        started_at=coalesce(r.started_at,now()),updated_at=now()
    from due where r.id=due.id
    returning r.*
  ),
  logged as (
    insert into public.minds_mission_run_events(run_id,user_id,event_type,payload)
    select id,user_id,'claimed',jsonb_build_object('iteration',iteration,'lease_until',lease_until)
    from claimed
    returning run_id
  )
  select c.* from claimed c;
end $function$;
REVOKE ALL ON FUNCTION public.minds_claim_mission_runs(p_limit integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_claim_mission_runs(p_limit integer) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_mark_mission_notified(p_run_id uuid, p_event text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_run public.minds_mission_runs%rowtype;
begin
  update public.minds_mission_runs set notified_at=coalesce(notified_at,now()),updated_at=now()
  where id=p_run_id returning * into v_run;
  if not found then return jsonb_build_object('status','missing'); end if;
  if not exists(select 1 from public.minds_mission_run_events where run_id=p_run_id and event_type='delivered' and payload->>'event'=p_event) then
    insert into public.minds_mission_run_events(run_id,user_id,event_type,payload)
    values(v_run.id,v_run.user_id,'delivered',jsonb_build_object('event',p_event));
  end if;
  return jsonb_build_object('status','ok');
end $function$;
REVOKE ALL ON FUNCTION public.minds_mark_mission_notified(p_run_id uuid, p_event text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_mark_mission_notified(p_run_id uuid, p_event text) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_reactivate_mission_waits(p_limit integer DEFAULT 12)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.minds_mission_runs%rowtype;
  v_ready boolean;
  v_dep_status text;
  n integer:=0;
begin
  for r in
    select * from public.minds_mission_runs
    where status='waiting'
    order by updated_at asc
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,12),48))
  loop
    v_ready:=false;v_dep_status:=null;
    if r.wait_kind='time' then
      v_ready:=r.wake_at is not null and r.wake_at<=now();
      if v_ready then v_dep_status:='time_elapsed'; end if;
    elsif r.wait_kind='capability' then
      select status into v_dep_status from public.minds_capability_runs
      where id::text=r.wait_ref and user_id=r.user_id;
      v_ready:=v_dep_status in ('completed','failed','cancelled');
    elsif r.wait_kind='expectation' then
      select status into v_dep_status from public.minds_expectations
      where id::text=r.wait_ref and user_id=r.user_id;
      v_ready:=v_dep_status in ('fulfilled','not_occurred','cancelled');
    end if;
    if not v_ready then continue; end if;

    update public.minds_mission_runs
    set status='queued',phase='reactivated',next_attempt_at=now(),
        metadata=(metadata-'wait')||jsonb_build_object('last_wake',jsonb_build_object(
          'kind',r.wait_kind,'ref',r.wait_ref,'status',v_dep_status,'wake_at',r.wake_at,'reactivated_at',now()
        )),
        wait_kind=null,wait_ref=null,wake_at=null,updated_at=now()
    where id=r.id and status='waiting';

    if found then
      insert into public.minds_mission_run_events(run_id,user_id,event_type,payload)
      values(r.id,r.user_id,'reactivated',jsonb_build_object('wait_kind',r.wait_kind,'wait_ref',r.wait_ref,'dependency_status',v_dep_status));
      n:=n+1;
    end if;
  end loop;
  return n;
end $function$;
REVOKE ALL ON FUNCTION public.minds_reactivate_mission_waits(p_limit integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_reactivate_mission_waits(p_limit integer) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_apply_mission_step_v2(p_run_id uuid, p_lease_token uuid, p_result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_run public.minds_mission_runs%rowtype;
  v_workspace public.minds_commitment_workspaces%rowtype;
  v_item jsonb;
  v_kind text;
  v_source text;
  v_provenance text;
  v_outcome text:=coalesce(p_result->>'status','continue');
  v_summary text:=left(coalesce(p_result->>'summary',''),12000);
  v_blocker text:=nullif(left(coalesce(p_result->>'blocker_question',''),4000),'');
  v_sources jsonb:=case when jsonb_typeof(p_result->'sources')='array' then p_result->'sources' else '[]'::jsonb end;
  v_pause boolean:=false;
  v_wait jsonb:=case when jsonb_typeof(p_result->'wait')='object' then p_result->'wait' else '{}'::jsonb end;
  v_wait_kind text:=nullif(v_wait->>'kind','');
  v_wait_ref text:=nullif(left(trim(coalesce(v_wait->>'ref','')),120),'');
  v_wake_at timestamptz:=null;
  v_event text;
begin
  select * into v_run from public.minds_mission_runs
  where id=p_run_id and status='running' and lease_token=p_lease_token and lease_until>=now()
  for update;
  if not found then return jsonb_build_object('status','stale'); end if;

  select * into v_workspace from public.minds_commitment_workspaces
  where id=v_run.workspace_id and user_id=v_run.user_id for update;
  if not found then return jsonb_build_object('status','workspace_missing'); end if;

  v_pause:=coalesce((v_run.metadata->>'pause_requested')::boolean,false);

  if jsonb_typeof(p_result->'items')='array' then
    for v_item in select value from jsonb_array_elements(p_result->'items') limit 12 loop
      v_kind:=coalesce(v_item->>'kind','note');
      if v_kind not in ('plan','finding','source','question','decision','note') then v_kind:='note'; end if;
      if length(trim(coalesce(v_item->>'content','')))<1 then continue; end if;
      v_source:=coalesce(v_item->>'source_kind','system');
      if v_source not in ('user','conversation','work','document','web','specialist','system') then v_source:='system'; end if;
      v_provenance:=case
        when v_source='user' then 'user'
        when v_source in ('work','document') then 'project_source'
        when v_source='web' then 'external'
        when v_item->>'provenance_class' in ('user','project_source','external','inferred','agent') then v_item->>'provenance_class'
        else 'agent'
      end;
      insert into public.minds_commitment_workspace_items(
        workspace_id,user_id,kind,status,content,provenance_class,source_kind,source_ref,metadata
      ) values (
        v_run.workspace_id,v_run.user_id,v_kind,case when v_kind='decision' then 'proposed' else 'working' end,
        left(trim(v_item->>'content'),16000),v_provenance,v_source,nullif(left(trim(coalesce(v_item->>'source_ref','')),2000),''),
        jsonb_build_object('mission_run_id',v_run.id,'iteration',v_run.iteration)
      );
    end loop;
  end if;

  update public.minds_commitment_workspaces
  set summary=case when v_summary<>'' then v_summary else summary end,updated_at=now()
  where id=v_run.workspace_id;

  if v_pause then
    v_outcome:='paused';
  elsif v_outcome not in ('continue','waiting','waiting_for_user','completed') then
    v_outcome:='continue';
  end if;

  if v_outcome='waiting' then
    if v_wait_kind='time' then
      begin v_wake_at:=(v_wait->>'wake_at')::timestamptz; exception when others then v_wake_at:=null; end;
      if v_wake_at is null or v_wake_at<=now()+interval '15 seconds' or v_wake_at>now()+interval '90 days' then
        v_outcome:='waiting_for_user';v_blocker:='Necesito una fecha u hora futura válida para poder retomar este trabajo.';
      end if;
      v_wait_ref:=null;
    elsif v_wait_kind='capability' then
      if v_wait_ref is null or not exists(
        select 1 from public.minds_capability_runs c where c.id::text=v_wait_ref and c.user_id=v_run.user_id
      ) then
        v_outcome:='waiting_for_user';v_blocker:='No pude identificar el trabajo material que debía esperar.';
      end if;
    elsif v_wait_kind='expectation' then
      if v_wait_ref is null or not exists(
        select 1 from public.minds_expectations e where e.id::text=v_wait_ref and e.user_id=v_run.user_id and e.status in ('active','due_unconfirmed')
      ) then
        v_outcome:='waiting_for_user';v_blocker:='No pude identificar la expectativa que debía mantener pendiente.';
      end if;
    else
      v_outcome:='waiting_for_user';v_blocker:='No tengo una condición de espera válida para continuar este trabajo.';
    end if;
  end if;

  if v_outcome='continue' and v_run.iteration>=v_run.max_iterations then
    v_outcome:='waiting_for_user';
    v_blocker:=coalesce(v_blocker,'He alcanzado el límite acotado de checkpoints de este trabajo. Puedo seguir si quieres.');
  end if;

  update public.minds_mission_runs
  set status=case
        when v_outcome='continue' then 'queued'
        when v_outcome='waiting' then 'waiting'
        when v_outcome='waiting_for_user' then 'waiting_for_user'
        when v_outcome='completed' then 'completed'
        else 'paused'
      end,
      phase=case
        when v_outcome='continue' then 'checkpointed'
        when v_outcome='waiting' then 'waiting_'||v_wait_kind
        when v_outcome='waiting_for_user' then 'waiting_for_user'
        when v_outcome='completed' then 'completed'
        else 'paused'
      end,
      result_summary=case when v_summary<>'' then v_summary else result_summary end,
      blocker_question=case when v_outcome='waiting_for_user' then v_blocker else null end,
      sources=(select coalesce(jsonb_agg(distinct x),'[]'::jsonb) from jsonb_array_elements(coalesce(sources,'[]'::jsonb)||v_sources) x),
      next_attempt_at=case when v_outcome='continue' then now()+interval '5 seconds' else null end,
      wait_kind=case when v_outcome='waiting' then v_wait_kind else null end,
      wait_ref=case when v_outcome='waiting' then v_wait_ref else null end,
      wake_at=case when v_outcome='waiting' then v_wake_at else null end,
      lease_token=null,lease_until=null,last_error=null,
      metadata=(metadata-'pause_requested'-'wait')||
        case when v_outcome='waiting'
          then jsonb_build_object('wait',jsonb_build_object('kind',v_wait_kind,'ref',v_wait_ref,'wake_at',v_wake_at))
          else '{}'::jsonb end,
      completed_at=case when v_outcome='completed' then now() else completed_at end,
      updated_at=now()
  where id=v_run.id
  returning * into v_run;

  v_event:=case v_run.status
    when 'queued' then 'checkpoint'
    when 'waiting' then 'waiting'
    when 'waiting_for_user' then 'waiting_for_user'
    when 'completed' then 'completed'
    else 'paused' end;

  insert into public.minds_mission_run_events(run_id,user_id,event_type,payload)
  values(
    v_run.id,v_run.user_id,v_event,
    jsonb_build_object(
      'iteration',v_run.iteration,'summary',v_run.result_summary,'blocker_question',v_run.blocker_question,
      'wait_kind',v_run.wait_kind,'wait_ref',v_run.wait_ref,'wake_at',v_run.wake_at
    )
  );

  return jsonb_build_object('status','ok','run',to_jsonb(v_run));
end $function$;
REVOKE ALL ON FUNCTION public.minds_apply_mission_step_v2(p_run_id uuid, p_lease_token uuid, p_result jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_apply_mission_step_v2(p_run_id uuid, p_lease_token uuid, p_result jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_fail_mission_step(p_run_id uuid, p_lease_token uuid, p_error text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_run public.minds_mission_runs%rowtype;
  v_retry integer;
  v_terminal boolean;
begin
  select * into v_run from public.minds_mission_runs
  where id=p_run_id and status='running' and lease_token=p_lease_token
  for update;
  if not found then return jsonb_build_object('status','stale'); end if;

  v_retry:=v_run.retry_count+1;
  v_terminal:=v_retry>=4;

  update public.minds_mission_runs
  set status=case when v_terminal then 'failed' else 'queued' end,
      phase=case when v_terminal then 'failed' else 'retry_wait' end,
      retry_count=v_retry,last_error=left(coalesce(p_error,'mission_step_failed'),8000),
      next_attempt_at=case when v_terminal then null else now()+(array[2,5,15]::int[])[least(v_retry,3)]*interval '1 minute' end,
      lease_token=null,lease_until=null,
      completed_at=case when v_terminal then now() else completed_at end,
      updated_at=now()
  where id=v_run.id
  returning * into v_run;

  insert into public.minds_mission_run_events(run_id,user_id,event_type,payload)
  values(v_run.id,v_run.user_id,case when v_terminal then 'failed' else 'retry_scheduled' end,
         jsonb_build_object('retry_count',v_retry,'error',v_run.last_error,'next_attempt_at',v_run.next_attempt_at));

  return jsonb_build_object('status','ok','run',to_jsonb(v_run));
end $function$;
REVOKE ALL ON FUNCTION public.minds_fail_mission_step(p_run_id uuid, p_lease_token uuid, p_error text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_fail_mission_step(p_run_id uuid, p_lease_token uuid, p_error text) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_claim_self_review_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s public.minds_self_review_settings; r public.minds_self_review_reports; k text; start_at timestamptz; end_at timestamptz; local_day date; review_day date;
begin
 for s in select * from public.minds_self_review_settings where enabled order by created_at for update skip locked loop
  if not exists(select 1 from public.isabella_projects where id=s.project_id and user_id=s.user_id and not archived) then continue; end if;
  local_day:=(now() at time zone s.timezone)::date;
  if not s.baseline_completed and coalesce((select attempts from public.minds_self_review_reports where user_id=s.user_id and review_key='baseline'),0)<3 then
   k:='baseline';start_at:=s.created_at-interval '7 days';end_at:=s.created_at;
  elsif extract(hour from now() at time zone s.timezone)>=s.local_hour then
   -- Recover missed dates after outages; exhausted failures remain visible and
   -- do not prevent subsequent daily reports. One bounded job per invocation.
   select d::date into review_day from generate_series((s.created_at at time zone s.timezone)::date::timestamp,(local_day-1)::timestamp,interval '1 day') d
   where not exists(select 1 from public.minds_self_review_reports x where x.user_id=s.user_id and x.review_key=d::date::text and (x.status='completed' or x.attempts>=3))
   order by d limit 1;
   if review_day is null then continue; end if;
   k:=review_day::text;start_at:=review_day::timestamp at time zone s.timezone;end_at:=(review_day+1)::timestamp at time zone s.timezone;
  else continue;
  end if;
  insert into public.minds_self_review_reports(user_id,project_id,review_key,window_start,window_end)
   values(s.user_id,s.project_id,k,start_at,end_at) on conflict(user_id,review_key) do nothing;
  select * into r from public.minds_self_review_reports where user_id=s.user_id and review_key=k for update;
  if r.status='completed' or r.attempts>=3 or (r.status='running' and r.lease_until>now()) then continue; end if;
  update public.minds_self_review_reports set status='running',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',error=null where id=r.id returning * into r;
  return to_jsonb(r);
 end loop;
 return null;
end $function$;
REVOKE ALL ON FUNCTION public.minds_claim_self_review_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_claim_self_review_v1() TO service_role;

CREATE OR REPLACE FUNCTION public.minds_finish_self_review_v1(p_id uuid, p_token uuid, p_report jsonb, p_evidence jsonb, p_coverage jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.minds_self_review_reports; f jsonb; ref text; pid uuid; ids jsonb:='[]';
begin
 select * into r from public.minds_self_review_reports where id=p_id for update;
 if not found or r.lease_token is distinct from p_token or r.status<>'running' or r.lease_until<now() then raise exception 'invalid_review_lease'; end if;
 if jsonb_typeof(p_report) is distinct from 'object' or jsonb_typeof(p_evidence) is distinct from 'array' or jsonb_typeof(p_report->'findings') is distinct from 'array' then raise exception 'invalid_review'; end if;
 if jsonb_array_length(p_report->'findings')>3 then raise exception 'too_many_proposals'; end if;
 for f in select * from jsonb_array_elements(p_report->'findings') loop
  if coalesce(length(btrim(f->>'problem_key')),0) not between 1 and 160 or coalesce(length(btrim(f->>'title')),0) not between 1 and 240
   or jsonb_typeof(f->'evidence_refs') is distinct from 'array' then raise exception 'invalid_finding'; end if;
  if jsonb_array_length(f->'evidence_refs')=0 then raise exception 'finding_requires_evidence'; end if;
  for ref in select jsonb_array_elements_text(f->'evidence_refs') loop
   if not exists(select 1 from jsonb_array_elements(p_evidence) e where e->>'ref'=ref) then raise exception 'unknown_review_evidence'; end if;
  end loop;
  -- The model may link an existing issue, but cannot change its owner decision.
  pid:=null;
  if nullif(f->>'existing_proposal_id','') is not null then
   select id into pid from public.minds_self_review_proposals where id=(f->>'existing_proposal_id')::uuid and user_id=r.user_id and project_id=r.project_id;
   if pid is null then raise exception 'unknown_existing_proposal'; end if;
   update public.minds_self_review_proposals set last_seen_at=now() where id=pid;
  else
   insert into public.minds_self_review_proposals(user_id,project_id,report_id,problem_key,title,details)
    values(r.user_id,r.project_id,r.id,lower(btrim(f->>'problem_key')),f->>'title',f)
    on conflict(user_id,project_id,problem_key) do update set last_seen_at=now() returning id into pid;
  end if;
  ids:=ids||jsonb_build_array(pid);
 end loop;
 update public.minds_self_review_reports set report=p_report||jsonb_build_object('proposal_ids',ids),evidence=p_evidence,coverage=p_coverage,status='completed',completed_at=now(),lease_until=null where id=r.id;
 if r.review_key='baseline' then update public.minds_self_review_settings set baseline_completed=true where user_id=r.user_id; end if;
 return jsonb_build_object('status','completed','report_id',r.id,'proposal_ids',ids);
end $function$;
REVOKE ALL ON FUNCTION public.minds_finish_self_review_v1(p_id uuid, p_token uuid, p_report jsonb, p_evidence jsonb, p_coverage jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_finish_self_review_v1(p_id uuid, p_token uuid, p_report jsonb, p_evidence jsonb, p_coverage jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_expire_prospective_memory(p_user uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count integer:=0;
  v_reminders integer:=0;
  v_watches integer:=0;
begin
  if p_user is null then raise exception 'user_required'; end if;

  with expired as (
    update public.minds_standing_intents
    set status='expired',expired_at=coalesce(expired_at,p_now),updated_at=p_now
    where user_id=p_user
      and status in ('pending','armed','fired')
      and expires_at is not null
      and expires_at<=p_now
    returning mode
  )
  select count(*),
         count(*) filter (where mode='reminder'),
         count(*) filter (where mode='watch')
  into v_count,v_reminders,v_watches
  from expired;

  return jsonb_build_object(
    'status','ok',
    'expired',v_count,
    'reminders',v_reminders,
    'watches',v_watches,
    'at',p_now
  );
end $function$;
REVOKE ALL ON FUNCTION public.minds_expire_prospective_memory(p_user uuid, p_now timestamp with time zone) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_expire_prospective_memory(p_user uuid, p_now timestamp with time zone) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_expire_review_items(p_user uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_ids uuid[]:='{}'::uuid[];
  v_count integer:=0;
begin
  if p_user is null then raise exception 'user_required'; end if;

  with eligible as (
    select q.item_id,q.review_expires_at
    from public.minds_review_queue_v2 q
    where q.user_id=p_user
      and q.item_kind='shadow_decision'
      and q.expiry_policy='stale_reversible_shadow_v1'
      and q.protected_from_expiry=false
      and q.review_expires_at is not null
      and q.review_expires_at<=p_now
  ), expired as (
    update public.minds_shadow_decisions s
    set
      status='expired',
      resolved_at=coalesce(s.resolved_at,p_now),
      updated_at=p_now,
      context=s.context||jsonb_build_object(
        'review_economy',
        coalesce(s.context->'review_economy','{}'::jsonb)||jsonb_build_object(
          'expired_at',p_now,
          'policy','stale_reversible_shadow_v1',
          'policy_version','review_economy_v01',
          'authority_changed',false
        )
      )
    from eligible e
    where s.id=e.item_id and s.user_id=p_user and s.status='pending'
    returning s.id
  )
  select coalesce(array_agg(id),'{}'::uuid[]),count(*) into v_ids,v_count from expired;

  return jsonb_build_object(
    'status','ok',
    'expired_count',v_count,
    'expired_ids',to_jsonb(v_ids),
    'policy','stale_reversible_shadow_v1',
    'authority_changed',false
  );
end $function$;
REVOKE ALL ON FUNCTION public.minds_expire_review_items(p_user uuid, p_now timestamp with time zone) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_expire_review_items(p_user uuid, p_now timestamp with time zone) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_consume_attention_briefing(p_user uuid, p_event_ids uuid[], p_delivery_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count integer:=0;
  e public.minds_attention_events;
begin
  for e in
    update public.minds_attention_events
    set status='consumed',delivery_ref='routine:'||p_delivery_id::text,
        delivered_at=coalesce(delivered_at,now()),consumed_at=now(),updated_at=now()
    where user_id=p_user and id=any(coalesce(p_event_ids,'{}'::uuid[]))
      and route='briefing' and status='pending'
    returning *
  loop
    v_count:=v_count+1;
    if e.source_type='mission' and e.source_id is not null then
      update public.minds_mission_runs
      set notified_at=coalesce(notified_at,now()),updated_at=now()
      where id=e.source_id::uuid and user_id=p_user;
      if not exists(
        select 1 from public.minds_mission_run_events
        where run_id=e.source_id::uuid and event_type='delivered'
          and payload->>'event'=coalesce(e.metadata->>'mission_event',e.event_type)
      ) then
        insert into public.minds_mission_run_events(run_id,user_id,event_type,payload)
        values(
          e.source_id::uuid,p_user,'delivered',
          jsonb_build_object('event',coalesce(e.metadata->>'mission_event',e.event_type),'attention_event_id',e.id,'route','briefing')
        );
      end if;
    elsif e.source_type='heartbeat' and e.source_id is not null then
      update public.minds_heartbeat_events
      set status='surfaced',surfaced_at=coalesce(surfaced_at,now())
      where id=e.source_id::uuid and user_id=p_user and status='new';
    end if;
  end loop;
  return v_count;
end $function$;
REVOKE ALL ON FUNCTION public.minds_consume_attention_briefing(p_user uuid, p_event_ids uuid[], p_delivery_id uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_consume_attention_briefing(p_user uuid, p_event_ids uuid[], p_delivery_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.minds_deliver_routine(p_delivery_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare d public.minds_routine_deliveries;r public.isabella_routines;conv uuid;mid uuid;
begin
  select * into d from public.minds_routine_deliveries where id=p_delivery_id;
  if not found then raise exception 'Delivery not found'; end if;
  if d.status='delivered' then return jsonb_build_object('message_id',d.message_id,'duplicate',true);end if;
  select * into r from public.isabella_routines where id=d.routine_id and user_id=d.user_id for update;
  select * into d from public.minds_routine_deliveries where id=p_delivery_id for update;
  if d.status='delivered' then return jsonb_build_object('message_id',d.message_id,'duplicate',true);end if;
  if length(coalesce(d.output,''))=0 then raise exception 'No generated output';end if;
  if not r.enabled then raise exception 'Routine disabled before delivery';end if;
  select id into conv from public.conversations where user_id=d.user_id and app_scope='isabella' order by updated_at desc limit 1;
  if conv is null then
    insert into public.conversations(user_id,app_scope,origin_kind,origin_anchor,title,mode,metadata) values(d.user_id,'isabella','global','{"type":"assistant","id":"isabella","label":"Isabella"}','Isabella','memory','{"app":"isabella"}') returning id into conv;
  end if;
  insert into public.conversation_messages(user_id,conversation_id,role,content,model,provisional,citations,metadata,client_key)
  values(d.user_id,conv,'assistant',d.output,d.model,false,d.sources,jsonb_build_object('source','isabella_routine','routine_id',r.id,'routine_title',r.title,'delivery_id',d.id,'scheduled_at',d.scheduled_at),'routine-delivery:'||d.id)
  on conflict(user_id,conversation_id,client_key) do update set content=excluded.content returning id into mid;
  update public.conversations set updated_at=now() where id=conv;
  if r.schedule->>'kind'='once' then
    update public.isabella_routines set last_output=d.output,last_error=null,metadata=metadata||'{"failure_retries":0}',enabled=false,next_run_at=null,updated_at=now() where id=r.id;
  else
    update public.isabella_routines set last_output=d.output,last_error=null,metadata=metadata||'{"failure_retries":0}',updated_at=now() where id=r.id;
  end if;
  update public.minds_routine_deliveries set status='delivered',message_id=mid,delivered_at=now(),lease_until=null,error=null where id=d.id;
  return jsonb_build_object('message_id',mid,'scheduled_at',d.scheduled_at,'delivered_at',now(),'delay_ms',greatest(0,extract(epoch from (now()-d.scheduled_at))*1000));
end $function$;
REVOKE ALL ON FUNCTION public.minds_deliver_routine(p_delivery_id uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_deliver_routine(p_delivery_id uuid) TO service_role;
commit;
