-- TBA Office · KI-Nutzung: Guthaben und Monatslimit zusammen (Gari, 27.11.2026, abends: «creo que solo tengo eso de
-- créditos, aunque tenga un limit de 50?»). Das OpenAI-Konto ist vorausbezahlt: bei 0 $ hält OpenAI alle Anfragen an,
-- solange die automatische Aufladung aus ist; das Monatslimit ist nur eine Obergrenze. Die Seite zeigt deshalb wieder
-- beides. Jede Zeile der KI-Nutzung sagt jetzt zusätzlich, ob sie nach der letzten Ablesung des Guthabens liegt
-- (nach_guthaben); nach_stand bleibt, wie es war (nach der Ablesung des Monats, ohne Monatslimit nach dem Guthaben).
-- Die Summen reichen bis zur älteren der beiden Ablesungen zurück, höchstens 120 Tage. Sonst ändert sich nichts:
-- nur Administratoren, keine Person in den Zeilen.

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
  v_guthaben_stand timestamptz;
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
    into v_guthaben, v_guthaben_stand
    from public.office_ki_guthaben g order by g.stand_am desc limit 1;
  v_stand := v_guthaben_stand;
  -- Mit Monatslimit zählt «nach dem Stand» ab der Ablesung dieses Monats; ohne Ablesung ist der ganze Monat Schätzung.
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
  if v_stand is not null or v_guthaben_stand is not null then
    v_seit := greatest(least(v_seit, coalesce(v_stand, v_seit), coalesce(v_guthaben_stand, v_seit)), now() - interval '120 days');
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
           (v_guthaben_stand is not null and a.created_at >= v_guthaben_stand) as nach_guthaben,
           count(*) as aufrufe,
           sum(a.input_tokens)::bigint as input, sum(a.cached_input_tokens)::bigint as cached,
           sum(a.output_tokens)::bigint as output, sum(a.total_tokens)::bigint as total,
           sum(a.websuchen)::bigint as websuchen, sum(a.container)::bigint as container
      from alle a
     group by 1, 2, 3, 4, 5, 6, 7, 8
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'tag', g.tag, 'quelle', g.quelle, 'funktion', g.funktion, 'modell', g.modell, 'projekt_id', g.project_id,
           'lang', g.lang, 'nach_stand', g.nach_stand, 'nach_guthaben', g.nach_guthaben, 'aufrufe', g.aufrufe,
           'input', g.input, 'cached', g.cached, 'output', g.output, 'total', g.total,
           'websuchen', g.websuchen, 'container', g.container)
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

revoke all on function public.office_ki_nutzung(integer) from public, anon;
grant execute on function public.office_ki_nutzung(integer) to authenticated;
