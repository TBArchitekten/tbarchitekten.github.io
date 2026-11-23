-- TBA Office · Romys Vorschläge lassen sich speichern; der Heartbeat läuft wieder (23.11.2026, Claude).
--
-- Gari (23.11.2026): den Fehler bei «Wissen» beheben und das Office gründlich nach Fehlern derselben Art
-- durchsehen; was sich findet, beheben. Geprüft wurde jede Funktion, Tabelle und Spalte, die App und
-- Server-Funktionen aufrufen, gegen die Office-Datenbank. Zwei Befunde ändern hier die Datenbank:
--
-- 1. Acht Funktionen ruft die App auf, es gab sie aber nur in Window, nie in der Office-Datenbank. Die
--    Phase-1-Migration 20261108211200 übernahm bewusst nur die privaten Helfer (minds_private), nicht die
--    öffentlichen Aufrufe. Folge: Bestätigte ein Mitglied im Gespräch einen Vorschlag von Romy (künftige
--    Erinnerung, Erwartung, Ziel, Projektwissen, Fähigkeit), kam «Funktion nicht gefunden» zurück und der
--    Vorschlag war weg; ebenso beim Quittieren einer Erinnerung nach Romys Antwort und in den verborgenen
--    Panels für Erwartungen und Erinnerungen. Übernommen aus Window, angepasst an das Office:
--    - Das Mitglied darf diese Tabellen im Office nur lesen, und nur die eigenen Zeilen; geschrieben wird über
--      diese Funktionen (security definer, leerer search_path). Jede prüft selbst: angemeldet, aktives
--      Office-Mitglied, nur eigene Zeilen.
--    - Ein Projekt gehört im Office nicht einer Person (isabella_projects.user_id ist die Projektleitung).
--      Persönliches (Erinnerung, Erwartung, Ziel) darf sich auf jedes aktive Office-Projekt beziehen, so wie
--      jedes Mitglied jedes Projekt sieht. Projektwissen gehört dem Projektteam: speichern und prüfen kann es,
--      wer im Team eines aktiven Projekts ist (dieselbe Regel wie die Lese-Policy von minds_work_claims). Eine
--      Prüfung behält die vorige Fassung und hinterlässt eine Quittung mit der prüfenden Person.
--    - Fähigkeiten gibt es im Office nur für Romy (intern «isabella»); ein anderer Name wird nicht verworfen.
--    - Meldungen auf Deutsch, weil die App sie dem Mitglied wörtlich zeigt.
-- 2. minds_publish_heartbeat scheiterte seit dem 14.11. abends alle 15 Minuten: Der Fingerabdruck der
--    Übersicht «überfällige Aufgaben» reiht die Kennungen aller überfälligen Aufgaben aneinander (bei 18
--    Aufgaben rund 680 Zeichen); Aufmerksamkeit und Kontinuität erlauben höchstens 500. Weil diese Übersicht
--    als erste veröffentlicht wird, fiel jedes Mal der ganze Lauf aus (Hinweise zu Terminen und fälligen
--    Erwartungen, Abgleich, Pflege des Gesprächskontexts). Lange Fingerabdrücke werden dort jetzt auf Anfang
--    plus md5 gekürzt. Die Heartbeat-Tabelle behält den vollen Wert, deshalb bleibt das Abgleichen
--    (resolveAbsent) unverändert; derselbe Fingerabdruck ergibt immer denselben Schlüssel.
--
-- Nichts wird gelöscht, keine Policy und keine Tabelle geändert.

-- ---------------------------------------------------------------------------------------------------------
-- Künftige Erinnerungen (minds_standing_intents)
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.minds_create_prospective_memory(
  p_spec jsonb,
  p_request_id uuid,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
  x public.minds_standing_intents;
  ch public.minds_watch_channels;
  v_mode text := lower(trim(coalesce(p_spec->>'mode','reminder')));
  v_observation text := lower(trim(coalesce(p_spec->>'observation_mode','via_user')));
  v_channel text := lower(trim(coalesce(p_spec->>'channel_kind','conversation')));
  v_trigger text := trim(coalesce(p_spec->>'trigger_text',''));
  v_reminder text := trim(coalesce(p_spec->>'reminder_text',''));
  v_project uuid := nullif(trim(coalesce(p_spec->>'project_id','')),'')::uuid;
  v_terms text[] := array[]::text[];
  v_condition jsonb := coalesce(p_spec->'condition','{}'::jsonb);
  v_return jsonb := coalesce(p_spec->'return_rule','{"route":"conversation"}'::jsonb);
  v_fresh integer := nullif(p_spec->>'freshness_minutes','')::integer;
  v_cooldown integer := greatest(0,least(525600,coalesce(nullif(p_spec->>'cooldown_minutes','')::integer,1440)));
  v_max integer := greatest(1,least(12,coalesce(nullif(p_spec->>'max_triggers','')::integer,3)));
  v_expires timestamptz := nullif(p_spec->>'expires_at','')::timestamptz;
  v_source_conversation uuid := nullif(trim(coalesce(p_spec->>'source_conversation_id','')),'')::uuid;
begin
  if u is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  if p_request_id is null or p_confirmed is distinct from true then
    raise exception 'Eine künftige Erinnerung wird erst nach ausdrücklicher Bestätigung gespeichert.';
  end if;
  if jsonb_typeof(coalesce(p_spec,'{}'::jsonb)) <> 'object' then raise exception 'Die Erinnerung ist ungültig.'; end if;
  if v_mode not in ('reminder','watch') then raise exception 'Unbekannte Art der Erinnerung.'; end if;
  if v_observation not in ('autonomous','via_user','unobserved') then raise exception 'Unbekannte Art der Beobachtung.'; end if;
  if length(v_trigger) not between 1 and 1200 then raise exception 'Die Situation fehlt oder ist zu lang (höchstens 1200 Zeichen).'; end if;
  if length(v_reminder) not between 1 and 4000 then raise exception 'Der Erinnerungstext fehlt oder ist zu lang (höchstens 4000 Zeichen).'; end if;
  if jsonb_typeof(v_condition) <> 'object' or jsonb_typeof(v_return) <> 'object' then raise exception 'Bedingung oder Rückweg sind ungültig.'; end if;

  if jsonb_typeof(p_spec->'trigger_terms') = 'array' then
    select coalesce(array_agg(left(trim(value),120)) filter (where length(trim(value)) > 0),array[]::text[])
      into v_terms
      from jsonb_array_elements_text(p_spec->'trigger_terms');
  end if;
  v_terms := (coalesce(v_terms,array[]::text[]))[1:12];

  if v_project is not null and not exists(
    select 1 from public.office_projects p where p.id = v_project and p.status = 'aktiv'
  ) then raise exception 'Projekt nicht verfügbar.'; end if;

  if v_source_conversation is not null and not exists(
    select 1 from public.conversations c where c.id = v_source_conversation and c.user_id = u
  ) then raise exception 'Gespräch nicht verfügbar.'; end if;

  if v_expires is null then v_expires := now() + interval '90 days'; end if;
  if v_expires <= now() then raise exception 'Das Ablaufdatum muss in der Zukunft liegen.'; end if;
  if v_expires > now() + interval '365 days' then raise exception 'Das Ablaufdatum liegt mehr als ein Jahr entfernt.'; end if;

  if v_mode = 'watch' then
    if v_observation <> 'autonomous' or v_channel = 'conversation' or v_condition = '{}'::jsonb or v_return = '{}'::jsonb then
      raise exception 'Eine Beobachtung braucht einen eigenständigen Kanal, eine Bedingung und einen Rückweg.';
    end if;
    select * into ch from public.minds_watch_channels w
     where w.user_id = u and w.channel_key = v_channel
     for share;
    if not found then raise exception 'Beobachtungskanal nicht verfügbar.'; end if;
    if ch.status <> 'enabled' then raise exception 'Der Beobachtungskanal ist ausgeschaltet.'; end if;
    if ch.verification_status <> 'verified' or ch.last_verified_at is null then raise exception 'Der Beobachtungskanal ist nicht geprüft.'; end if;
    if ch.last_verified_at < now() - make_interval(mins => greatest(ch.freshness_minutes*2,60)) then
      raise exception 'Die Prüfung des Beobachtungskanals ist veraltet.';
    end if;
    if v_fresh is null then v_fresh := ch.freshness_minutes; end if;
    if v_fresh < ch.freshness_minutes then raise exception 'Die gewünschte Aktualität übersteigt, was der Kanal liefert.'; end if;
    v_observation := 'autonomous';
  else
    v_observation := 'via_user';
    v_channel := 'conversation';
    v_fresh := null;
    if v_condition = '{}'::jsonb then
      v_condition := jsonb_build_object('type','conversation_terms','terms',to_jsonb(v_terms));
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('prospective:'||u::text||':'||p_request_id::text,0));
  select * into x from public.minds_standing_intents s where s.user_id = u and s.request_id = p_request_id;
  if found then return jsonb_build_object('status','already_created','item',to_jsonb(x)); end if;

  insert into public.minds_standing_intents(
    user_id,trigger_text,reminder_text,trigger_terms,project_id,status,cooldown_minutes,
    max_triggers,trigger_count,last_trigger_at,expires_at,source_conversation_id,metadata,request_id,
    mode,observation_mode,channel_kind,channel_ref,freshness_minutes,last_checked_at,last_observed_at,
    condition_json,return_rule,armed_at
  ) values (
    u,v_trigger,v_reminder,v_terms,v_project,'armed',v_cooldown,
    v_max,0,null,v_expires,v_source_conversation,
    coalesce(p_spec->'metadata','{}'::jsonb)||jsonb_build_object(
      'prospective_memory_version','v0.2',
      'coverage_label',case when v_mode = 'watch' then 'observed_autonomously' else 'observed_through_user' end,
      'monitoring_claim',v_mode = 'watch',
      'channel_contract_id',case when v_mode = 'watch' then ch.id else null end
    ),
    p_request_id,
    v_mode,v_observation,v_channel,case when v_mode = 'watch' then ch.id::text else null end,
    v_fresh,null,null,v_condition,v_return,now()
  )
  returning * into x;

  return jsonb_build_object(
    'status','created',
    'item',to_jsonb(x),
    'human_kind',v_mode,
    'coverage',v_observation,
    'monitoring',v_mode = 'watch'
  );
end;
$$;

-- Nach Romys Antwort quittiert die App, welche Erinnerungen sie gezeigt hat (Zähler, Abkühlzeit, Ende).
create or replace function public.minds_ack_standing_intents(p_ids uuid[], p_run_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
  x public.minds_standing_intents;
  n integer := 0;
  inserted integer := 0;
  next_count integer := 0;
begin
  if u is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_run_key,''))) = 0 then raise exception 'Die Zustellung hat keine Kennung.'; end if;

  for x in
    select * from public.minds_standing_intents s
     where s.user_id = u and s.id = any(coalesce(p_ids,array[]::uuid[]))
       and s.mode = 'reminder' and s.status = 'armed'
     order by s.id
     for update
  loop
    if x.expires_at is not null and x.expires_at <= now() then
      update public.minds_standing_intents
         set status = 'expired', expired_at = coalesce(expired_at,now()), updated_at = now()
       where id = x.id;
      continue;
    end if;
    if x.trigger_count >= x.max_triggers then
      update public.minds_standing_intents
         set status = 'done', done_at = coalesce(done_at,now()), updated_at = now()
       where id = x.id;
      continue;
    end if;
    if x.last_trigger_at is not null and x.last_trigger_at + make_interval(mins => x.cooldown_minutes) > now() then
      continue;
    end if;

    insert into public.minds_intent_deliveries(user_id,intent_id,run_key,mode,channel_kind,fired_at)
    values (u,x.id,p_run_key,'reminder','conversation',now())
    on conflict do nothing;
    get diagnostics inserted = row_count;
    if inserted <> 1 then continue; end if;

    next_count := x.trigger_count + 1;
    update public.minds_standing_intents
       set status = 'fired', fired_at = now(), last_observed_at = now(), updated_at = now()
     where id = x.id;
    update public.minds_standing_intents
       set trigger_count = next_count,
           last_trigger_at = now(),
           status = case when next_count >= max_triggers then 'done' else 'armed' end,
           done_at = case when next_count >= max_triggers then now() else null end,
           armed_at = case when next_count < max_triggers then now() else armed_at end,
           updated_at = now()
     where id = x.id;
    n := n + 1;
  end loop;

  return n;
end;
$$;

create or replace function public.minds_cancel_prospective_memory(
  p_id uuid,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
  x public.minds_standing_intents;
begin
  if u is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  if p_id is null or p_confirmed is distinct from true then
    raise exception 'Eine Erinnerung wird erst nach ausdrücklicher Bestätigung beendet.';
  end if;
  select * into x from public.minds_standing_intents s where s.id = p_id and s.user_id = u for update;
  if not found then return jsonb_build_object('status','missing'); end if;
  if x.status = 'cancelled' then return jsonb_build_object('status','already_cancelled','item',to_jsonb(x)); end if;
  if x.status in ('done','expired') then return jsonb_build_object('status','already_terminal','item',to_jsonb(x)); end if;

  update public.minds_standing_intents
     set status = 'cancelled', cancelled_at = now(), updated_at = now()
   where id = x.id
  returning * into x;

  return jsonb_build_object('status','cancelled','item',to_jsonb(x));
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Erwartungen (minds_expectations). Der private Helfer kam mit Phase 1; er prüfte das Projekt noch als
-- persönliches Window-Projekt (isabella_projects.user_id). Sonst bleibt er, wie er war.
-- ---------------------------------------------------------------------------------------------------------
create or replace function minds_private.create_expectation(
  p_expectation jsonb,
  p_request_id uuid,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := auth.uid(); e public.minds_expectations;
  v_project uuid := nullif(p_expectation->>'project_id','')::uuid;
  v_due timestamptz;
  v_precision text := case when p_expectation->>'due_precision' = 'datetime' then 'datetime' else 'date' end;
  v_tz text := coalesce(nullif(trim(p_expectation->>'timezone'),''),'Europe/Berlin');
  v_type text := coalesce(nullif(trim(p_expectation->>'expectation_type'),''),'other');
  v_source text := coalesce(nullif(trim(p_expectation->>'source_kind'),''),'conversation');
begin
  if u is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  if p_request_id is null or p_confirmed is distinct from true then
    raise exception 'Eine Erwartung wird erst nach ausdrücklicher Bestätigung gespeichert.';
  end if;
  if jsonb_typeof(coalesce(p_expectation,'{}'::jsonb)) <> 'object' then raise exception 'Die Erwartung ist ungültig.'; end if;
  if length(trim(coalesce(p_expectation->>'title',''))) not between 1 and 500 then raise exception 'Der Name der Erwartung fehlt oder ist zu lang.'; end if;
  if length(trim(coalesce(p_expectation->>'expected_event',''))) not between 1 and 4000 then raise exception 'Was erwartet wird, fehlt oder ist zu lang.'; end if;
  if v_type not in ('reply','delivery','decision','document','external_event','other') then raise exception 'Unbekannte Art der Erwartung.'; end if;
  if v_source not in ('conversation','work','external','manual','system') then raise exception 'Unbekannte Quelle der Erwartung.'; end if;
  if jsonb_typeof(coalesce(p_expectation->'metadata','{}'::jsonb)) <> 'object' then raise exception 'Die Zusatzangaben der Erwartung sind ungültig.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('expectation:'||u::text||':'||p_request_id::text,0));
  select * into e from public.minds_expectations x where x.user_id = u and x.request_id = p_request_id;
  if found then return jsonb_build_object('status','already_created','expectation',to_jsonb(e)); end if;

  if v_project is not null and not exists(
    select 1 from public.office_projects p where p.id = v_project and p.status = 'aktiv'
  ) then raise exception 'Projekt nicht verfügbar.'; end if;

  v_due := minds_private.expectation_due_at(
    p_expectation->>'due_date',p_expectation->>'due_time',v_precision,v_tz
  );
  if v_due <= now() then raise exception 'Die Erwartung muss in der Zukunft liegen.'; end if;

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
end;
$$;

create or replace function public.minds_create_expectation(
  p_expectation jsonb,
  p_request_id uuid,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  return minds_private.create_expectation(p_expectation,p_request_id,p_confirmed);
end;
$$;

create or replace function public.minds_review_expectation(
  p_expectation_id uuid,
  p_decision text,
  p_note text default null,
  p_occurred_at timestamptz default null,
  p_next_date text default null,
  p_next_time text default null,
  p_next_precision text default null,
  p_timezone text default null,
  p_request_id uuid default null,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  return minds_private.review_expectation(
    p_expectation_id,p_decision,p_note,p_occurred_at,p_next_date,p_next_time,p_next_precision,p_timezone,p_request_id,p_confirmed
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Ziele, die Romy präsent hält (minds_commitments). Danach ruft die App für dauerhafte Arbeit
-- minds_ensure_commitment_workspace und minds_start_mission_run auf; beide gibt es im Office schon.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.minds_create_commitment(
  p_commitment jsonb,
  p_request_id uuid,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
  saved public.minds_commitments;
  existing public.minds_commitments;
  project uuid;
  conv uuid;
  flush public.minds_memory_flushes;
  flush_id uuid;
  open_loop text;
  prior_guard text := current_setting('minds.commitment_reviewed',true);
  v_title text := trim(coalesce(p_commitment->>'title',''));
  v_objective text := trim(coalesce(p_commitment->>'objective',''));
  v_scope text := lower(trim(coalesce(p_commitment->>'scope','global')));
  v_status text := lower(trim(coalesce(p_commitment->>'status','active')));
  v_agent text := lower(trim(coalesce(p_commitment->>'agent','isabella')));
  v_source text := lower(trim(coalesce(p_commitment->>'source_kind','user')));
  v_criteria text := nullif(trim(coalesce(p_commitment->>'completion_criteria','')),'');
  v_metadata jsonb := coalesce(p_commitment->'metadata','{}'::jsonb);
begin
  if u is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  if p_confirmed is not true then raise exception 'Ein Ziel wird erst nach ausdrücklicher Bestätigung gespeichert.'; end if;
  if p_request_id is null then raise exception 'Die Anfrage hat keine Kennung.'; end if;
  if length(v_title) not between 1 and 400 or length(v_objective) not between 1 and 6000 then
    raise exception 'Name oder Ziel fehlt oder ist zu lang.';
  end if;
  if v_scope not in ('global','personal','project','theory','other') or v_status not in ('active','waiting','paused') or v_agent not in ('isabella','sofia') then
    raise exception 'Ungültiger Zustand des Ziels.';
  end if;
  if v_source not in ('user','conversation','checkpoint','project','system') then raise exception 'Unbekannte Quelle des Ziels.'; end if;
  if jsonb_typeof(v_metadata) <> 'object' then raise exception 'Die Zusatzangaben des Ziels sind ungültig.'; end if;
  if v_criteria is not null and length(v_criteria) > 4000 then raise exception 'Die Abschlusskriterien sind zu lang (höchstens 4000 Zeichen).'; end if;

  perform pg_advisory_xact_lock(hashtextextended('commitment:'||u::text||':'||p_request_id::text,0));
  select * into existing from public.minds_commitments c where c.user_id = u and c.request_id = p_request_id;
  if found then return to_jsonb(existing); end if;

  if nullif(p_commitment->>'project_id','') is not null then
    begin project := (p_commitment->>'project_id')::uuid; exception when others then raise exception 'Ungültiges Projekt.'; end;
    if not exists(select 1 from public.office_projects p where p.id = project and p.status = 'aktiv') then
      raise exception 'Projekt nicht verfügbar.';
    end if;
    v_scope := 'project';
  elsif v_scope = 'project' then
    raise exception 'Ein Projektziel braucht ein Projekt.';
  end if;

  if nullif(p_commitment->>'source_conversation_id','') is not null then
    begin conv := (p_commitment->>'source_conversation_id')::uuid; exception when others then raise exception 'Ungültiges Gespräch.'; end;
    if not exists(select 1 from public.conversations c where c.id = conv and c.user_id = u) then
      raise exception 'Gespräch nicht verfügbar.';
    end if;
  end if;

  if nullif(p_commitment->>'source_flush_id','') is not null or nullif(p_commitment->>'source_open_loop','') is not null then
    if nullif(p_commitment->>'source_flush_id','') is null or nullif(p_commitment->>'source_open_loop','') is null then
      raise exception 'Die Herkunft aus dem Zwischenstand ist unvollständig.';
    end if;
    begin flush_id := (p_commitment->>'source_flush_id')::uuid; exception when others then raise exception 'Ungültiger Zwischenstand.'; end;
    open_loop := trim(p_commitment->>'source_open_loop');
    select * into flush from public.minds_memory_flushes f where f.id = flush_id and f.user_id = u;
    if not found then raise exception 'Zwischenstand nicht verfügbar.'; end if;
    if not exists(select 1 from jsonb_array_elements_text(coalesce(flush.open_loops,'[]'::jsonb)) x(value) where x.value = open_loop) then
      raise exception 'Dieser offene Punkt steht nicht im Zwischenstand.';
    end if;
    conv := flush.conversation_id;
    v_source := 'checkpoint';
  end if;

  perform set_config('minds.commitment_reviewed','true',true);

  insert into public.minds_commitments(
    user_id,agent,title,objective,scope,project_id,status,completion_criteria,
    source_kind,source_conversation_id,source_flush_id,source_open_loop,request_id,metadata
  ) values (
    u,v_agent,v_title,v_objective,v_scope,project,v_status,v_criteria,
    v_source,conv,flush_id,open_loop,p_request_id,v_metadata
  ) returning * into saved;

  insert into public.minds_commitment_events(user_id,commitment_id,event_type,body,to_status,source_kind,source,metadata)
  values (u,saved.id,'created',saved.objective,saved.status,v_source,
    jsonb_strip_nulls(jsonb_build_object('request_id',p_request_id,'project_id',project,'conversation_id',conv)),
    jsonb_build_object('scope',saved.scope,'agent',saved.agent));

  if flush_id is not null then
    insert into public.minds_commitment_events(user_id,commitment_id,event_type,body,to_status,source_kind,source)
    values (u,saved.id,'open_loop_linked',open_loop,saved.status,'checkpoint',
      jsonb_build_object('flush_id',flush_id,'open_loop',open_loop));
  end if;

  perform set_config('minds.commitment_reviewed',coalesce(prior_guard,''),true);
  return to_jsonb(saved);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Projektwissen (minds_work_claims, minds_work_evidence): Vorschlag im Gespräch und Prüfung in «Wissen».
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.minds_save_work_claim(
  p_claim jsonb,
  p_evidence jsonb,
  p_request_id uuid,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
  project uuid;
  old_id uuid;
  c public.minds_work_claims;
  e jsonb;
  source_file uuid;
  source_message uuid;
  provenance text;
  state text;
begin
  if u is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  if p_confirmed is not true then raise exception 'Projektwissen wird erst nach ausdrücklicher Prüfung gespeichert.'; end if;
  if p_request_id is null or length(trim(coalesce(p_claim->>'statement',''))) = 0 then raise exception 'Das Projektwissen ist unvollständig.'; end if;
  begin project := nullif(p_claim->>'project_id','')::uuid; exception when others then raise exception 'Ungültiges Projekt.'; end;
  -- Wer das Wissen eines Projekts lesen darf, darf es auch speichern und prüfen (Lese-Policy minds_work_claims).
  if project is null or not (select private.office_project_team_has_access(project)) then
    raise exception 'Projektwissen speichert nur das Team eines aktiven Projekts.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text||p_request_id::text,0));
  select c0.* into c
    from public.minds_work_claims c0
    join public.minds_review_receipts r on r.target_id = c0.id and r.kind = 'work_claim'
   where r.user_id = u and r.request_id = p_request_id and c0.project_id = project;
  if found then return to_jsonb(c); end if;
  select * into c from public.minds_work_claims w where w.user_id = u and w.metadata->>'request_id' = p_request_id::text;
  if found then return to_jsonb(c); end if;

  state := coalesce(p_claim->>'status','proposed');
  if state not in ('proposed','confirmed','disputed','resolved','rejected') then raise exception 'Ungültiger Status nach der Prüfung.'; end if;
  provenance := coalesce(p_claim->>'provenance_class','inferred');
  if provenance = 'system' then raise exception 'Ein Vorschlag kann keine Systemherkunft tragen.'; end if;
  if jsonb_typeof(p_evidence) is distinct from 'array' then raise exception 'Belege müssen eine Liste sein.'; end if;
  if exists(select 1 from jsonb_array_elements(p_evidence) x where nullif(x->>'source_file_id','') is not null) and provenance = 'user' then
    provenance := 'project_source';
  end if;

  old_id := nullif(p_claim->>'id','')::uuid;
  if old_id is not null then
    select * into c from public.minds_work_claims w where w.id = old_id and w.project_id = project for update;
    if not found then raise exception 'Dieses Projektwissen gibt es in diesem Projekt nicht.'; end if;
    -- Eine geprüfte Änderung behält die vorige Fassung samt Herkunft; wer geprüft hat, steht in der Quittung.
    update public.minds_work_claims set
      statement = p_claim->>'statement',
      claim_type = coalesce(p_claim->>'claim_type',c.claim_type),
      subject = nullif(p_claim->>'subject',''),
      topic = nullif(p_claim->>'topic',''),
      discipline = nullif(p_claim->>'discipline',''),
      status = state,
      provenance_class = provenance,
      confidence = least(1,greatest(0,coalesce((p_claim->>'confidence')::numeric,c.confidence))),
      confirmed_at = case when state = 'confirmed' then coalesce(c.confirmed_at,now()) else c.confirmed_at end,
      valid_from = nullif(p_claim->>'valid_from','')::timestamptz,
      valid_to = nullif(p_claim->>'valid_to','')::timestamptz,
      metadata = c.metadata||jsonb_build_object('request_id',p_request_id,'reviewed_at',now(),'reviewed_by',u,
        'previous_versions',coalesce(c.metadata->'previous_versions','[]'::jsonb)||jsonb_build_array(to_jsonb(c)-'metadata')),
      updated_at = now()
    where id = c.id
    returning * into c;
  else
    insert into public.minds_work_claims(user_id,project_id,claim_type,statement,subject,topic,discipline,status,confidence,
      provenance_class,confirmed_at,valid_from,valid_to,metadata)
    values (u,project,coalesce(p_claim->>'claim_type','fact'),p_claim->>'statement',nullif(p_claim->>'subject',''),
      nullif(p_claim->>'topic',''),nullif(p_claim->>'discipline',''),state,
      least(1,greatest(0,coalesce((p_claim->>'confidence')::numeric,0.7))),provenance,
      case when state = 'confirmed' then now() end,nullif(p_claim->>'valid_from','')::timestamptz,
      nullif(p_claim->>'valid_to','')::timestamptz,
      jsonb_build_object('request_id',p_request_id,'source','reviewed_proposal','reviewed_at',now()))
    returning * into c;
  end if;

  for e in select * from jsonb_array_elements(p_evidence) loop
    source_file := nullif(e->>'source_file_id','')::uuid;
    source_message := nullif(e->>'source_message_id','')::uuid;
    -- Dateien gehören im Office dem Projekt, nicht der Person, die sie hochgeladen hat.
    if source_file is not null and not exists(
      select 1 from public.minds_work_files f where f.id = source_file and f.project_id = project
    ) then raise exception 'Die Beleg-Datei gehört nicht zu diesem Projekt.'; end if;
    if source_message is not null and not exists(
      select 1 from public.conversation_messages m where m.id = source_message and m.user_id = u
    ) then raise exception 'Die Beleg-Nachricht ist nicht zugänglich.'; end if;
    insert into public.minds_work_evidence(user_id,project_id,claim_id,source_kind,source_file_id,source_message_id,
      locator,excerpt,stance,trust_level,metadata)
    values (u,project,c.id,case when source_file is not null then 'work_file' else coalesce(e->>'source_kind','manual') end,
      source_file,source_message,coalesce(e->'locator','{}'::jsonb),nullif(e->>'excerpt',''),coalesce(e->>'stance','supports'),
      case when provenance = 'inferred' then 'derived' when provenance = 'external' then 'untrusted' else 'reported' end,
      jsonb_build_object('reviewed_at',now(),'source_provenance',provenance));
  end loop;

  old_id := nullif(p_claim->>'supersedes_id','')::uuid;
  if old_id is not null then
    if state <> 'confirmed' or old_id = c.id then raise exception 'Ersetzen geht nur mit einem bestätigten neuen Eintrag.'; end if;
    update public.minds_work_claims
       set status = 'superseded', superseded_by = c.id, valid_to = now(), updated_at = now()
     where id = old_id and project_id = project;
    if not found then raise exception 'Der ersetzte Eintrag ist in diesem Projekt nicht zugänglich.'; end if;
    update public.minds_work_claims set supersedes_id = old_id where id = c.id returning * into c;
  end if;

  insert into public.minds_review_receipts(user_id,request_id,kind,target_id) values (u,p_request_id,'work_claim',c.id);
  return to_jsonb(c);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Persönliche Fähigkeiten von Romy (minds_skill_proposals, minds_user_skills, minds_user_skill_versions).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.minds_apply_personal_skill(
  p_skill jsonb,
  p_request_id uuid,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := (select auth.uid());
  a text := 'isabella';
  s text;
  p public.minds_skill_proposals;
  skill public.minds_user_skills;
  tool_names text[];
begin
  if u is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  if p_confirmed is not true then raise exception 'Eine Fähigkeit wird erst nach ausdrücklicher Prüfung aktiviert.'; end if;
  s := trim(both '-' from regexp_replace(lower(coalesce(nullif(p_skill->>'slug',''),p_skill->>'name')),'[^a-z0-9]+','-','g'));
  if length(coalesce(s,'')) = 0 or length(trim(coalesce(p_skill->>'instructions',''))) = 0
     or length(trim(coalesce(p_skill->>'name',''))) = 0 or p_request_id is null then
    raise exception 'Die Fähigkeit braucht einen Namen und Anweisungen.';
  end if;
  s := left(s,80);
  perform pg_advisory_xact_lock(hashtextextended(u::text||a||s,0));
  select * into p from public.minds_skill_proposals x where x.user_id = u and x.metadata->>'request_id' = p_request_id::text;
  if found and p.applied_skill_id is not null then
    select * into skill from public.minds_user_skills k where k.id = p.applied_skill_id and k.user_id = u;
    return to_jsonb(skill);
  end if;
  select coalesce(array_agg(value),'{}') into tool_names from jsonb_array_elements_text(coalesce(p_skill->'preferred_tools','[]'::jsonb));
  insert into public.minds_skill_proposals(user_id,agent,slug,name,description,instructions,preferred_tools,status,evidence,metadata)
  values (u,a,s,p_skill->>'name',coalesce(p_skill->>'description',''),p_skill->>'instructions',tool_names,'accepted',
    case when nullif(p_skill->>'evidence_summary','') is not null
         then jsonb_build_array(jsonb_build_object('summary',p_skill->>'evidence_summary')) else '[]'::jsonb end,
    jsonb_build_object('request_id',p_request_id,'source','reviewed_workshop'))
  returning * into p;
  select * into skill from public.minds_user_skills k where k.user_id = u and k.agent = a and k.slug = s for update;
  if found then
    insert into public.minds_user_skill_versions(user_id,skill_id,version,snapshot)
    values (u,skill.id,skill.version,to_jsonb(skill)) on conflict (skill_id,version) do nothing;
    update public.minds_user_skills
       set name = p.name, description = p.description, instructions = p.instructions, preferred_tools = tool_names,
           version = version + 1, enabled = true, source_proposal_id = p.id, updated_at = now()
     where id = skill.id
    returning * into skill;
  else
    insert into public.minds_user_skills(user_id,agent,slug,name,description,instructions,preferred_tools,source_proposal_id,metadata)
    values (u,a,s,p.name,p.description,p.instructions,tool_names,p.id,'{"source":"workshop"}'::jsonb)
    returning * into skill;
  end if;
  update public.minds_skill_proposals set status = 'applied', applied_skill_id = skill.id, applied_at = now(), updated_at = now() where id = p.id;
  insert into public.minds_user_skill_versions(user_id,skill_id,version,snapshot)
  values (u,skill.id,skill.version,to_jsonb(skill)) on conflict (skill_id,version) do nothing;
  return to_jsonb(skill);
end;
$$;

-- Nur angemeldete Mitglieder rufen diese Funktionen; die Prüfung «aktives Office-Mitglied» steckt in jeder.
revoke all on function public.minds_create_prospective_memory(jsonb, uuid, boolean) from public, anon;
grant execute on function public.minds_create_prospective_memory(jsonb, uuid, boolean) to authenticated;
revoke all on function public.minds_ack_standing_intents(uuid[], text) from public, anon;
grant execute on function public.minds_ack_standing_intents(uuid[], text) to authenticated;
revoke all on function public.minds_cancel_prospective_memory(uuid, boolean) from public, anon;
grant execute on function public.minds_cancel_prospective_memory(uuid, boolean) to authenticated;
revoke all on function public.minds_create_expectation(jsonb, uuid, boolean) from public, anon;
grant execute on function public.minds_create_expectation(jsonb, uuid, boolean) to authenticated;
revoke all on function public.minds_review_expectation(uuid, text, text, timestamptz, text, text, text, text, uuid, boolean) from public, anon;
grant execute on function public.minds_review_expectation(uuid, text, text, timestamptz, text, text, text, text, uuid, boolean) to authenticated;
revoke all on function public.minds_create_commitment(jsonb, uuid, boolean) from public, anon;
grant execute on function public.minds_create_commitment(jsonb, uuid, boolean) to authenticated;
revoke all on function public.minds_save_work_claim(jsonb, jsonb, uuid, boolean) from public, anon;
grant execute on function public.minds_save_work_claim(jsonb, jsonb, uuid, boolean) to authenticated;
revoke all on function public.minds_apply_personal_skill(jsonb, uuid, boolean) from public, anon;
grant execute on function public.minds_apply_personal_skill(jsonb, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Heartbeat: lange Fingerabdrücke passen in Aufmerksamkeit und Kontinuität (je höchstens 500 Zeichen).
-- Unverändert bis auf v_key; Rechte bleiben (create or replace behält sie: nur service_role).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.minds_publish_heartbeat(p_user uuid, p_candidate jsonb)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  e public.minds_heartbeat_events;
  fresh boolean:=false;
  a jsonb;
  continuity jsonb;
  suppress boolean:=false;
  v_key text;
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

  -- Derselbe volle Fingerabdruck ergibt immer denselben kurzen Schlüssel (höchstens 10+80+5+32 Zeichen).
  v_key:=case when length(e.fingerprint)>400 then left(e.fingerprint,80)||':md5:'||md5(e.fingerprint) else e.fingerprint end;

  suppress:=coalesce((p_candidate->>'surface')::boolean,true)=false;
  a:=public.minds_publish_attention(
    p_user,
    jsonb_build_object(
      'event_key','heartbeat:'||v_key,
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
      'fingerprint','heartbeat:'||v_key,
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
