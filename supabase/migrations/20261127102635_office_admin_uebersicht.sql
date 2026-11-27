-- TBA Office · Übersicht für Administratoren (Gari, 27.11.2026): «KI-Nutzung» mit Guthaben und «Systemstatus».
-- Beides nur für Administratoren. Die KI-Nutzung zählt je Tag, Funktion, Modell und Projekt, nie je Person: aus
-- office_ki_verbrauch (die eigenen Funktionen, ohne Person) und aus minds_ai_usage (Romys Motor; die Person dort wird
-- nie ausgegeben, nur Summen). Das Guthaben trägt eine Administratorin oder ein Administrator so ein, wie es bei OpenAI
-- steht; den Verbrauch seitdem schätzt die Seite aus den Tokens. Der Systemstatus fasst zusammen, was die tägliche
-- Office-Prüfung ansieht, soweit die Datenbank es weiß.

create table public.office_ki_guthaben (
  id uuid primary key default gen_random_uuid(),
  betrag_usd numeric(10,2) not null check (betrag_usd >= 0 and betrag_usd < 1000000),
  warnen_ab_tage integer not null default 7 check (warnen_ab_tage between 1 and 60),
  -- Uhrzeit des Eintrags selbst (nicht der Transaktion): mehrere Einträge bleiben in der richtigen Reihenfolge.
  stand_am timestamptz not null default clock_timestamp()
);
comment on table public.office_ki_guthaben is
  'Guthaben bei OpenAI, wie es eine Administratorin oder ein Administrator abgelesen hat (Verlauf). Nur über Funktionen.';
create index office_ki_guthaben_stand on public.office_ki_guthaben (stand_am desc);
alter table public.office_ki_guthaben enable row level security;
revoke all on public.office_ki_guthaben from public, anon, authenticated;

-- Guthaben eintragen: eine neue Zeile je Ablesung; «warnen ab» bleibt, wenn nicht neu angegeben.
create or replace function public.office_ki_guthaben_eintragen(p_betrag numeric, p_warnen_ab_tage integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tage integer;
  v public.office_ki_guthaben;
begin
  if not (select private.office_is_admin()) then
    raise exception 'Nur für Administratoren.' using errcode = '42501';
  end if;
  if p_betrag is null or p_betrag < 0 or p_betrag >= 1000000 then
    raise exception 'Bitte einen Betrag in US-Dollar eingeben.' using errcode = '22023';
  end if;
  if p_warnen_ab_tage is not null and (p_warnen_ab_tage < 1 or p_warnen_ab_tage > 60) then
    raise exception 'Warnen ab: zwischen 1 und 60 Tagen.' using errcode = '22023';
  end if;
  v_tage := coalesce(p_warnen_ab_tage,
    (select g.warnen_ab_tage from public.office_ki_guthaben g order by g.stand_am desc limit 1), 7);
  insert into public.office_ki_guthaben (betrag_usd, warnen_ab_tage) values (round(p_betrag, 2), v_tage)
  returning * into v;
  return jsonb_build_object('betrag_usd', v.betrag_usd, 'warnen_ab_tage', v.warnen_ab_tage, 'stand_am', v.stand_am);
end
$$;

-- KI-Nutzung: Summen je Tag (Berlin), Quelle, Funktion, Modell, Projekt, langer Anfrage und vor/nach dem Guthaben.
-- Reicht so weit zurück, wie die Seite braucht (Standard 35 Tage, seit dem eingetragenen Guthaben, höchstens 120).
create or replace function public.office_ki_nutzung(p_tage integer default 35)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tage integer := least(greatest(coalesce(p_tage, 35), 1), 120);
  v_heute date := (now() at time zone 'Europe/Berlin')::date;
  v_seit timestamptz;
  v_stand timestamptz;
  v_guthaben jsonb;
  v_zeilen jsonb;
  v_projekte jsonb;
begin
  if not (select private.office_is_admin()) then
    raise exception 'Nur für Administratoren.' using errcode = '42501';
  end if;
  select jsonb_build_object('betrag_usd', g.betrag_usd, 'warnen_ab_tage', g.warnen_ab_tage, 'stand_am', g.stand_am), g.stand_am
    into v_guthaben, v_stand
    from public.office_ki_guthaben g order by g.stand_am desc limit 1;
  v_seit := (v_heute - (v_tage - 1))::timestamp at time zone 'Europe/Berlin';
  if v_stand is not null then
    v_seit := greatest(least(v_seit, v_stand), now() - interval '120 days');
  end if;

  with alle as (
    select 'office'::text as quelle, k.funktion, k.modell, k.project_id, k.created_at,
           k.input_tokens, k.cached_input_tokens, k.output_tokens, k.total_tokens,
           case when jsonb_typeof(k.details->'websuchen') = 'number' then (k.details->>'websuchen')::numeric::integer else 0 end as websuchen,
           case when jsonb_typeof(k.details->'container') = 'number' then (k.details->>'container')::numeric::integer else 0 end as container
      from public.office_ki_verbrauch k
     where k.created_at >= v_seit
    union all
    select 'romy'::text, u.feature, u.model, null::uuid, u.created_at,
           u.input_tokens, u.cached_input_tokens, u.output_tokens, u.total_tokens, 0, 0
      from public.minds_ai_usage u
     where u.created_at >= v_seit
  ), gruppen as (
    select (a.created_at at time zone 'Europe/Berlin')::date as tag, a.quelle, a.funktion, a.modell, a.project_id,
           a.input_tokens > 272000 as lang,
           (v_stand is not null and a.created_at >= v_stand) as nach_stand,
           count(*) as aufrufe,
           sum(a.input_tokens)::bigint as input, sum(a.cached_input_tokens)::bigint as cached,
           sum(a.output_tokens)::bigint as output, sum(a.total_tokens)::bigint as total,
           sum(a.websuchen)::bigint as websuchen, sum(a.container)::bigint as container
      from alle a
     group by 1, 2, 3, 4, 5, 6, 7
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'tag', g.tag, 'quelle', g.quelle, 'funktion', g.funktion, 'modell', g.modell, 'projekt_id', g.project_id,
           'lang', g.lang, 'nach_stand', g.nach_stand, 'aufrufe', g.aufrufe, 'input', g.input, 'cached', g.cached,
           'output', g.output, 'total', g.total, 'websuchen', g.websuchen, 'container', g.container)
           order by g.tag, g.quelle, g.funktion, g.modell), '[]'::jsonb)
    into v_zeilen
    from gruppen g;

  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nummer', p.number, 'name', p.name) order by p.number), '[]'::jsonb)
    into v_projekte
    from public.office_projects p
   where p.id in (select distinct k.project_id from public.office_ki_verbrauch k
                   where k.created_at >= v_seit and k.project_id is not null);

  return jsonb_build_object('stand', now(), 'seit', v_seit, 'tage', v_tage, 'heute', v_heute,
    'guthaben', v_guthaben, 'zeilen', v_zeilen, 'projekte', v_projekte);
end
$$;

-- Systemstatus: jede Prüfung für sich; schlägt eine fehl, meldet sie «unbekannt» und die anderen laufen weiter.
create or replace function public.office_systemstatus()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb := '[]'::jsonb;
  t timestamptz;
  n bigint;
  m bigint;
  k bigint;
  x jsonb;
  med numeric;
begin
  if not (select private.office_is_admin()) then
    raise exception 'Nur für Administratoren.' using errcode = '42501';
  end if;

  -- Romys Heartbeat läuft alle 15 Minuten; ohne erfolgreichen Lauf seit 45 Minuten ist er ausgefallen.
  begin
    select max(r.started_at) filter (where r.status = 'success'),
           count(*) filter (where r.status = 'success' and r.started_at > now() - interval '24 hours'),
           count(*) filter (where r.status not in ('success', 'skipped') and r.started_at > now() - interval '24 hours')
      into t, n, m
      from public.minds_agent_runs r
     where r.feature = 'heartbeat' and r.started_at > now() - interval '48 hours';
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'heartbeat',
      'status', case when t is null or t < now() - interval '45 minutes' then 'fehler'
                     when m > 3 or n < 80 then 'warnung' else 'ok' end,
      'zuletzt_ok', t, 'ok_24h', n, 'fehler_24h', m));
  exception when others then
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'heartbeat', 'status', 'unbekannt'));
  end;

  -- Romys nächtliche Pflege: einmal pro Nacht (nur wenn sie im Office schon gelaufen ist).
  begin
    select max(r.started_at) filter (where r.status = 'success'), count(*)
      into t, n
      from public.minds_agent_runs r
     where r.feature = 'isabella_dream' and r.started_at > now() - interval '30 days';
    if n > 0 then
      v := v || jsonb_build_array(jsonb_build_object('bereich', 'pflege',
        'status', case when t is null or t < now() - interval '30 hours' then 'warnung' else 'ok' end,
        'zuletzt_ok', t));
    end if;
  exception when others then
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'pflege', 'status', 'unbekannt'));
  end;

  -- Zeitpläne der Datenbank (aktive Cron-Jobs): Fehler in 24 Stunden; minütliche Jobs, die eine Stunde nicht liefen;
  -- tägliche, die 26 Stunden nicht liefen.
  begin
    with laeufe as (
      select d.jobid, max(d.start_time) as zuletzt,
             (array_agg(d.status order by d.start_time desc))[1] as letzter,
             count(*) filter (where d.status <> 'succeeded' and d.start_time > now() - interval '24 hours') as fehler
        from cron.job_run_details d
       where d.start_time > now() - interval '7 days'
       group by d.jobid
    ), jobs as (
      select j.jobname, j.schedule, l.zuletzt, l.letzter, coalesce(l.fehler, 0) as fehler,
             case when coalesce(l.fehler, 0) > 0 then 'fehler'
                  when l.zuletzt is null then 'ausstehend'
                  when j.schedule ~ '^(\*|\*/[0-9]+) \* \* \* \*$' and l.zuletzt < now() - interval '1 hour' then 'warnung'
                  when l.zuletzt < now() - interval '26 hours' then 'warnung'
                  else 'ok' end as status
        from cron.job j
        left join laeufe l on l.jobid = j.jobid
       where j.active
    )
    select coalesce(jsonb_agg(jsonb_build_object('name', jobname, 'zeitplan', schedule, 'zuletzt', zuletzt,
             'letzter_status', letzter, 'fehler_24h', fehler, 'status', status) order by jobname), '[]'::jsonb)
      into x
      from jobs;
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'zeitplaene',
      'status', case when x @> '[{"status":"fehler"}]' then 'fehler'
                     when x @> '[{"status":"warnung"}]' then 'warnung' else 'ok' end,
      'jobs', x));
  exception when others then
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'zeitplaene', 'status', 'unbekannt'));
  end;

  -- Aufrufe der Datenbank an die Funktionen (pg_net): mehr als fünf fehlgeschlagene in sechs Stunden.
  begin
    select count(*) filter (where r.status_code >= 500 or r.error_msg is not null or r.timed_out), count(*)
      into n, m
      from net._http_response r
     where r.created > now() - interval '6 hours';
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'netz',
      'status', case when n > 5 then 'warnung' else 'ok' end, 'fehlgeschlagen_6h', n, 'gesamt_6h', m));
  exception when others then
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'netz', 'status', 'unbekannt'));
  end;

  -- Mitteilungen aufs iPhone: wartet etwas länger als zehn Minuten oder schlug etwas fehl?
  begin
    select count(*) filter (where p.status = 'gesendet' and p.gesendet_am > now() - interval '24 hours'),
           count(*) filter (where p.status in ('wartet', 'wird_gesendet') and p.created_at < now() - interval '10 minutes'
                              and p.gueltig_bis > now()),
           count(*) filter (where p.status = 'fehlgeschlagen' and p.created_at > now() - interval '24 hours')
      into n, m, k
      from public.office_push_nachrichten p
     where p.created_at > now() - interval '7 days';
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'push',
      'status', case when m > 0 or k > 0 then 'warnung' else 'ok' end,
      'gesendet_24h', n, 'wartet', m, 'fehlgeschlagen_24h', k,
      'geraete', (select count(*) from public.office_push_geraete g where g.aktiv)));
  exception when others then
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'push', 'status', 'unbekannt'));
  end;

  -- Fehler aus dem Browser (24 Stunden): ein Problem, wenn ein Fehler zwei oder mehr Personen trifft oder 20-mal auftritt.
  -- Ausgegeben werden nur Meldung, Seite, Ort und Zahlen, nie wer.
  begin
    with je as (
      select f.fingerabdruck, max(f.nachricht) as nachricht, max(f.seite) as seite, max(f.ort) as ort,
             sum(f.anzahl)::bigint as anzahl, count(distinct f.user_id) as personen
        from public.office_client_fehler f
       where f.letztes_mal > now() - interval '24 hours'
       group by f.fingerabdruck
    )
    select coalesce(sum(je.anzahl), 0), count(*),
           coalesce((select jsonb_agg(jsonb_build_object('nachricht', o.nachricht, 'seite', o.seite, 'ort', o.ort,
                       'anzahl', o.anzahl, 'personen', o.personen) order by o.anzahl desc)
                       from (select * from je order by anzahl desc limit 5) o), '[]'::jsonb),
           count(*) filter (where je.personen >= 2 or je.anzahl >= 20)
      into n, m, x, k
      from je;
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'browserfehler',
      'status', case when k > 0 then 'warnung' else 'ok' end, 'meldungen_24h', n, 'verschiedene_24h', m, 'haeufigste', x));
  exception when others then
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'browserfehler', 'status', 'unbekannt'));
  end;

  -- KI-Verbrauch der letzten 24 Stunden gegen den Median der Tage davor (Office-Funktionen und Romys Motor).
  begin
    with alle as (
      select k2.created_at, k2.total_tokens from public.office_ki_verbrauch k2 where k2.created_at > now() - interval '31 days'
      union all
      select u.created_at, u.total_tokens from public.minds_ai_usage u where u.created_at > now() - interval '31 days'
    ), tage as (
      select (a.created_at at time zone 'Europe/Berlin')::date as tag, sum(a.total_tokens) as tokens
        from alle a
       where (a.created_at at time zone 'Europe/Berlin')::date < (now() at time zone 'Europe/Berlin')::date
       group by 1
    )
    select (select coalesce(sum(a.total_tokens), 0) from alle a where a.created_at > now() - interval '24 hours'),
           (select percentile_cont(0.5) within group (order by tokens) from tage)
      into n, med;
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'ki',
      'status', case when n > 500000 and n > 3 * coalesce(med, 0) then 'warnung' else 'ok' end,
      'tokens_24h', n, 'median_tag', round(coalesce(med, 0))));
  exception when others then
    v := v || jsonb_build_array(jsonb_build_object('bereich', 'ki', 'status', 'unbekannt'));
  end;

  return jsonb_build_object('stand', now(), 'pruefungen', v);
end
$$;

revoke all on function public.office_ki_guthaben_eintragen(numeric, integer) from public, anon;
revoke all on function public.office_ki_nutzung(integer) from public, anon;
revoke all on function public.office_systemstatus() from public, anon;
grant execute on function public.office_ki_guthaben_eintragen(numeric, integer) to authenticated;
grant execute on function public.office_ki_nutzung(integer) to authenticated;
grant execute on function public.office_systemstatus() to authenticated;
