-- Romy · Phase 1 · scoped routine and Watch RPC dependencies.
-- Window catalog-only source; executable definitions contain no records or credentials.
-- Worker mutations are callable by service_role only; Watch catalog read is user-scoped.
-- VAPID generation is intentionally excluded: Office has no mobile push.
BEGIN;

-- claim_due_isabella_routines
CREATE OR REPLACE FUNCTION public.claim_due_isabella_routines(p_limit integer DEFAULT 20)
 RETURNS SETOF isabella_routines
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare r public.isabella_routines; d public.minds_routine_deliveries; n integer:=0;
begin
  for r in select x.* from public.isabella_routines x where x.enabled and (
    x.next_run_at<=now() or exists(select 1 from public.minds_routine_deliveries z where z.routine_id=x.id and z.status<>'delivered' and z.attempts<5 and coalesce(z.lease_until,'epoch')<=now() and coalesce(z.retry_at,'epoch')<=now())
  ) order by x.next_run_at nulls first for update of x skip locked limit greatest(1,least(coalesce(p_limit,20),50)) loop
    -- Never overlap a still-live worker, even if the next scheduled time is due.
    if exists(select 1 from public.minds_routine_deliveries where routine_id=r.id and lease_until>now() and status<>'delivered') then continue; end if;
    select * into d from public.minds_routine_deliveries where routine_id=r.id and status<>'delivered' and attempts<5 and coalesce(lease_until,'epoch')<=now() and coalesce(retry_at,'epoch')<=now() order by scheduled_at for update limit 1;
    if not found then
      if r.next_run_at is null or r.next_run_at>now() then continue; end if;
      insert into public.minds_routine_deliveries(user_id,routine_id,scheduled_at) values(r.user_id,r.id,r.next_run_at) on conflict(routine_id,scheduled_at) do nothing returning * into d;
      if not found then continue; end if;
      update public.isabella_routines set next_run_at=public.isabella_next_routine_run(r.schedule,r.timezone,now()+interval '5 seconds') where id=r.id;
    end if;
    update public.minds_routine_deliveries set status=case when output is null then 'generating' else 'generated' end,attempts=attempts+1,lease_until=now()+interval '10 minutes',claimed_at=now(),retry_at=null where id=d.id returning * into d;
    update public.isabella_routines set last_run_at=now(),updated_at=now() where id=r.id returning * into r;
    r.metadata:=r.metadata||jsonb_build_object('delivery_id',d.id,'scheduled_at',d.scheduled_at,'delivery_output',d.output,'delivery_sources',d.sources,'delivery_model',d.model,'delivery_attempt',d.attempts);
    return next r;n:=n+1;
  end loop;
end $function$
;
REVOKE ALL ON FUNCTION public.claim_due_isabella_routines(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_isabella_routines(integer) TO service_role;

-- minds_finalize_watch_fire
CREATE OR REPLACE FUNCTION public.minds_finalize_watch_fire(p_user uuid, p_watch uuid, p_check uuid, p_publication jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  w public.minds_standing_intents;
  ck public.minds_watch_checks;
  v_count integer;
begin
  select * into w from public.minds_standing_intents
  where id=p_watch and user_id=p_user and mode='watch'
  for update;
  if not found then raise exception 'Watch unavailable'; end if;

  select * into ck from public.minds_watch_checks
  where id=p_check and watch_id=w.id and user_id=p_user
    and observation_status='ok' and condition_state='matched';
  if not found then raise exception 'Matched Watch check unavailable'; end if;

  if w.status<>'fired' then
    return jsonb_build_object('status','already_finalized','watch_id',w.id,'trigger_count',w.trigger_count);
  end if;

  v_count:=w.trigger_count+1;
  update public.minds_standing_intents
  set
    trigger_count=v_count,
    last_trigger_at=now(),
    status=case when v_count>=max_triggers then 'done' else 'armed' end,
    done_at=case when v_count>=max_triggers then now() else null end,
    armed_at=case when v_count<max_triggers then now() else armed_at end,
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'last_watch_check_id',ck.id,
      'last_attention_publication',coalesce(p_publication,'{}'::jsonb)
    ),
    updated_at=now()
  where id=w.id;

  return jsonb_build_object(
    'status',case when v_count>=w.max_triggers then 'done' else 'armed' end,
    'watch_id',w.id,
    'trigger_count',v_count,
    'check_id',ck.id
  );
end $function$
;
REVOKE ALL ON FUNCTION public.minds_finalize_watch_fire(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_finalize_watch_fire(uuid,uuid,uuid,jsonb) TO service_role;

-- minds_record_watch_check
CREATE OR REPLACE FUNCTION public.minds_record_watch_check(p_user uuid, p_watch uuid, p_channel uuid, p_result jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  w public.minds_standing_intents;
  ch public.minds_watch_channels;
  ck public.minds_watch_checks;
  v_status text:=lower(trim(coalesce(p_result->>'observation_status','error')));
  v_state text:=lower(trim(coalesce(p_result->>'condition_state','unknown')));
  v_observed timestamptz:=nullif(p_result->>'observed_at','')::timestamptz;
  v_fresh integer:=nullif(p_result->>'freshness_minutes','')::integer;
begin
  select * into w from public.minds_standing_intents
  where id=p_watch and user_id=p_user and mode='watch'
  for update;
  if not found then raise exception 'Watch unavailable'; end if;

  select * into ch from public.minds_watch_channels
  where id=p_channel and user_id=p_user
  for update;
  if not found then raise exception 'Watch channel unavailable'; end if;
  if w.channel_ref is distinct from ch.id::text then raise exception 'Watch/channel mismatch'; end if;

  if v_status not in ('ok','stale','error') then v_status:='error'; end if;
  if v_state not in ('matched','not_matched','unknown') then v_state:='unknown'; end if;
  if v_status<>'ok' then v_state:='unknown'; end if;
  if v_status='ok' and v_observed is null then v_observed:=now(); end if;
  if v_status='ok' and v_fresh is null then
    v_fresh:=greatest(0,ceil(extract(epoch from (now()-v_observed))/60.0)::integer);
  end if;
  if v_status='ok' and v_fresh>w.freshness_minutes then
    v_status:='stale';v_state:='unknown';
  end if;

  insert into public.minds_watch_checks(
    user_id,watch_id,channel_id,observation_status,condition_state,observed_at,
    freshness_minutes,result_fingerprint,evidence,error
  ) values (
    p_user,w.id,ch.id,v_status,v_state,v_observed,v_fresh,
    nullif(trim(coalesce(p_result->>'result_fingerprint','')),''),
    case when jsonb_typeof(p_result->'evidence')='object' then p_result->'evidence' else '{}'::jsonb end,
    nullif(left(trim(coalesce(p_result->>'error','')),1600),'')
  ) returning * into ck;

  update public.minds_standing_intents
  set
    last_checked_at=ck.checked_at,
    last_observed_at=case when v_status='ok' then v_observed else last_observed_at end,
    status=case when status='armed' and v_status='ok' and v_state='matched' then 'fired' else status end,
    fired_at=case when status='armed' and v_status='ok' and v_state='matched' then now() else fired_at end,
    updated_at=now()
  where id=w.id and user_id=p_user;

  update public.minds_watch_channels
  set
    last_error=case when v_status='error' then ck.error when v_status='stale' then 'watch_check_stale' else null end,
    updated_at=now()
  where id=ch.id and user_id=p_user;

  return jsonb_build_object(
    'status',v_status,
    'condition_state',v_state,
    'check_id',ck.id,
    'watch_id',w.id,
    'fire_ready',(v_status='ok' and v_state='matched')
  );
end $function$
;
REVOKE ALL ON FUNCTION public.minds_record_watch_check(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_record_watch_check(uuid,uuid,uuid,jsonb) TO service_role;

-- minds_watch_capabilities
CREATE OR REPLACE FUNCTION public.minds_watch_capabilities()
 RETURNS TABLE(channel_key text, label text, provider text, adapter_kind text, freshness_minutes integer, last_verified_at timestamp with time zone, available boolean, reason text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select
    c.channel_key,c.label,c.provider,c.adapter_kind,c.freshness_minutes,c.last_verified_at,
    (
      c.status='enabled'
      and c.verification_status='verified'
      and c.last_verified_at is not null
      and c.last_verified_at >= now() - make_interval(mins=>greatest(c.freshness_minutes*2,60))
    ) as available,
    case
      when c.status<>'enabled' then 'channel_disabled'
      when c.verification_status<>'verified' then 'channel_not_verified'
      when c.last_verified_at is null then 'channel_never_verified'
      when c.last_verified_at < now() - make_interval(mins=>greatest(c.freshness_minutes*2,60)) then 'channel_verification_stale'
      else 'available'
    end as reason
  from public.minds_watch_channels c
  where c.user_id=auth.uid()
  order by c.label,c.channel_key;
$function$
;
REVOKE ALL ON FUNCTION public.minds_watch_capabilities() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.minds_watch_capabilities() TO authenticated;

COMMIT;
