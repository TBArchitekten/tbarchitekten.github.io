-- TBA Office · KI-Nutzung mit Monatslimit (Gari, 27.11.2026: «Sobre el Monatslimit, sí prepáralo como propones»).
-- Das OpenAI-Konto des Büros arbeitet nicht mit Guthaben, sondern mit einem Limit je Monat; was als Guthaben eingetragen
-- war, war der Verbrauch des Monats. Eine Administratorin oder ein Administrator trägt das Limit ein, «warnen ab» in
-- Prozent und, solange die Seite die Kosten nicht selbst bei OpenAI liest (office-ki-kosten), was OpenAI für den
-- laufenden Monat zeigt. Verlauf wie beim Guthaben: jede Eingabe eine Zeile, die neueste gilt. office_ki_guthaben
-- bleibt mit seinem Verlauf; die Seite zeigt es nicht mehr.

create table public.office_ki_monatslimit (
  id uuid primary key default gen_random_uuid(),
  limit_usd numeric(10,2) not null check (limit_usd > 0 and limit_usd < 1000000),
  warnen_ab_prozent integer not null default 80 check (warnen_ab_prozent between 10 and 100),
  -- Was OpenAI für den laufenden Monat zeigte, als die Zeile eingetragen wurde (leer: nur Limit oder «warnen ab» geändert).
  ausgegeben_usd numeric(10,2) check (ausgegeben_usd is null or (ausgegeben_usd >= 0 and ausgegeben_usd < 1000000)),
  -- Uhrzeit des Eintrags selbst (nicht der Transaktion): mehrere Einträge bleiben in der richtigen Reihenfolge.
  stand_am timestamptz not null default clock_timestamp()
);
comment on table public.office_ki_monatslimit is
  'Monatslimit bei OpenAI, «warnen ab» und abgelesener Verbrauch des Monats, wie eine Administratorin oder ein Administrator sie eingetragen hat (Verlauf). Nur über Funktionen.';
create index office_ki_monatslimit_stand on public.office_ki_monatslimit (stand_am desc);
alter table public.office_ki_monatslimit enable row level security;
revoke all on public.office_ki_monatslimit from public, anon, authenticated;

-- Monatslimit eintragen: eine neue Zeile je Eingabe. Limit und «warnen ab» bleiben, wenn nicht neu angegeben;
-- der Verbrauch gilt nur für die Zeile, in der er steht (leer: keine neue Ablesung).
create or replace function public.office_ki_monatslimit_eintragen(p_limit numeric default null, p_ausgegeben numeric default null,
  p_warnen_ab_prozent integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_letzte public.office_ki_monatslimit;
  v public.office_ki_monatslimit;
begin
  if not (select private.office_is_admin()) then
    raise exception 'Nur für Administratoren.' using errcode = '42501';
  end if;
  select * into v_letzte from public.office_ki_monatslimit m order by m.stand_am desc limit 1;
  if (p_limit is null and v_letzte.id is null) or (p_limit is not null and (p_limit <= 0 or p_limit >= 1000000)) then
    raise exception 'Bitte das Monatslimit in US-Dollar eingeben.' using errcode = '22023';
  end if;
  if p_ausgegeben is not null and (p_ausgegeben < 0 or p_ausgegeben >= 1000000) then
    raise exception 'Bitte den Verbrauch des Monats in US-Dollar eingeben.' using errcode = '22023';
  end if;
  if p_warnen_ab_prozent is not null and (p_warnen_ab_prozent < 10 or p_warnen_ab_prozent > 100) then
    raise exception 'Warnen ab: zwischen 10 und 100 Prozent.' using errcode = '22023';
  end if;
  insert into public.office_ki_monatslimit (limit_usd, warnen_ab_prozent, ausgegeben_usd)
  values (round(coalesce(p_limit, v_letzte.limit_usd), 2), coalesce(p_warnen_ab_prozent, v_letzte.warnen_ab_prozent, 80),
          round(p_ausgegeben, 2))
  returning * into v;
  return jsonb_build_object('limit_usd', v.limit_usd, 'warnen_ab_prozent', v.warnen_ab_prozent,
    'ausgegeben_usd', v.ausgegeben_usd, 'stand_am', v.stand_am);
end
$$;

-- KI-Nutzung: wie bisher, dazu das Monatslimit, die Ablesung dieses Monats und der Monatsbeginn (Berlin).
-- Sie reicht immer mindestens bis zum Monatsbeginn zurück.
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
  v_monat date := date_trunc('month', (now() at time zone 'Europe/Berlin'))::date;
  v_limit public.office_ki_monatslimit;
  v_ablesung public.office_ki_monatslimit;
  v_monatslimit jsonb;
begin
  if not (select private.office_is_admin()) then
    raise exception 'Nur für Administratoren.' using errcode = '42501';
  end if;
  select jsonb_build_object('betrag_usd', g.betrag_usd, 'warnen_ab_tage', g.warnen_ab_tage, 'stand_am', g.stand_am), g.stand_am
    into v_guthaben, v_stand
    from public.office_ki_guthaben g order by g.stand_am desc limit 1;
  -- Mit Monatslimit zählt «nach dem Stand» ab der Ablesung dieses Monats; ohne Ablesung ist der ganze Monat Schätzung.
  -- Ohne Monatslimit bleibt es beim Guthaben (Verlauf vor dem 27.11.2026).
  select * into v_limit from public.office_ki_monatslimit m order by m.stand_am desc limit 1;
  if v_limit.id is not null then
    select * into v_ablesung from public.office_ki_monatslimit m
     where m.ausgegeben_usd is not null and m.stand_am >= (v_monat::timestamp at time zone 'Europe/Berlin')
     order by m.stand_am desc limit 1;
    v_monatslimit := jsonb_build_object('limit_usd', v_limit.limit_usd, 'warnen_ab_prozent', v_limit.warnen_ab_prozent,
      'gesetzt_am', v_limit.stand_am, 'ausgegeben_usd', v_ablesung.ausgegeben_usd, 'abgelesen_am', v_ablesung.stand_am);
    v_stand := v_ablesung.stand_am;
  end if;
  v_seit := least((v_heute - (v_tage - 1))::timestamp at time zone 'Europe/Berlin', v_monat::timestamp at time zone 'Europe/Berlin');
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
    'guthaben', v_guthaben, 'monatslimit', v_monatslimit, 'monat_beginn', v_monat,
    'zeilen', v_zeilen, 'projekte', v_projekte);
end
$$;

revoke all on function public.office_ki_monatslimit_eintragen(numeric, numeric, integer) from public, anon;
grant execute on function public.office_ki_monatslimit_eintragen(numeric, numeric, integer) to authenticated;
