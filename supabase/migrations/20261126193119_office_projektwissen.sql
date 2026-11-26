-- Projektwissen (Gari, 26.11.2026): ein gemeinsamer Wissenspool je Projekt. Was jemand im Projekt erarbeitet (etwa in
-- einem Chat mit Claude), teilt er mit «Ins Office übernehmen»; die KI arbeitet es in Seiten ein, die das ganze
-- Projektteam liest. Niemand muss etwas ordnen: die KI legt Seiten an, führt sie zusammen, schreibt sie fort, verweist
-- zwischen ihnen und benennt Widersprüche; das Team liest, fragt und korrigiert.
-- Vorbilder: das von einer KI gepflegte Wiki (Karpathy, 2026), der Unterschied von Garten und Strom (Caulfield, 2015),
-- die Zustände der ISO 19650 (in Arbeit, geteilt, beschlossen, ersetzt) und Entscheidungsprotokolle (eine neue
-- Entscheidung ersetzt die alte; gelöscht wird nichts).
--
--   Beiträge       office_wissen_beitraege: was geteilt wurde, ganz und unverändert, mit Herkunft. Quelle der Seiten.
--   Seiten         minds_work_memory (memory_type 'document_state', metadata.kind 'wissensseite'); jede frühere
--                  Fassung bleibt in office_wissen_versionen.
--   Entscheidungen minds_work_memory (memory_type 'decision'): vorgeschlagen, bis die Projektleitung sie bestätigt.
--   Protokoll      office_wissen_protokoll: was sich wann geändert hat («Neu»).
--   Regeln         office_wissen_regeln: wie die KI schreibt (eine Zeile fürs Büro; Admins ändern sie).
-- Seiten und Entscheidungen liegen in der Projektakte (minds_work_memory): ein Register der Entscheidungen je Projekt.
-- Lesen darf das Projektteam (private.office_project_team_has_access, wie die Projektakte). Geschrieben wird nur über
-- die Funktionen unten: sie prüfen die Mitgliedschaft und lassen alle im Team dieselbe Seite fortschreiben; die
-- Tabelle minds_work_memory behält ihre Regeln (direkt nur eigene Zeilen). Nichts Destruktives.

create table public.office_wissen_beitraege (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.office_projects(id) on delete cascade,
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  art text not null default 'chat' check (art in ('chat', 'thread', 'korrektur', 'notiz')),
  titel text not null check (length(btrim(titel)) between 1 and 200),
  inhalt text not null check (length(btrim(inhalt)) between 1 and 200000),
  quelle text check (quelle is null or length(quelle) <= 500),
  seite text check (seite is null or length(seite) <= 200),
  eingearbeitet_am timestamptz,
  eingearbeitet_in text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index office_wissen_beitraege_projekt on public.office_wissen_beitraege (project_id, created_at desc);
alter table public.office_wissen_beitraege enable row level security;
create policy office_wissen_beitraege_lesen on public.office_wissen_beitraege
  for select to authenticated using ((select private.office_project_team_has_access(project_id)));

create table public.office_wissen_versionen (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.office_projects(id) on delete cascade,
  seite_id uuid not null references public.minds_work_memory(id) on delete cascade,
  titel text not null,
  inhalt text not null,
  kurz text,
  von uuid references auth.users(id) on delete set null,
  grund text,
  stand timestamptz not null,
  ersetzt_am timestamptz not null default now()
);
create index office_wissen_versionen_seite on public.office_wissen_versionen (seite_id, stand desc);
alter table public.office_wissen_versionen enable row level security;
create policy office_wissen_versionen_lesen on public.office_wissen_versionen
  for select to authenticated using ((select private.office_project_team_has_access(project_id)));

create table public.office_wissen_protokoll (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.office_projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  art text not null check (art in ('beitrag', 'seite_neu', 'seite_geaendert', 'seite_zusammengefuehrt',
    'entscheidung_vorgeschlagen', 'entscheidung_beschlossen', 'entscheidung_verworfen', 'entscheidung_ersetzt')),
  titel text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index office_wissen_protokoll_projekt on public.office_wissen_protokoll (project_id, created_at desc);
alter table public.office_wissen_protokoll enable row level security;
create policy office_wissen_protokoll_lesen on public.office_wissen_protokoll
  for select to authenticated using ((select private.office_project_team_has_access(project_id)));

create table public.office_wissen_regeln (
  id smallint primary key default 1 check (id = 1),
  text text not null check (length(btrim(text)) between 1 and 20000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.office_wissen_regeln enable row level security;
create policy office_wissen_regeln_lesen on public.office_wissen_regeln
  for select to authenticated using ((select private.office_is_member()));
create policy office_wissen_regeln_aendern on public.office_wissen_regeln
  for update to authenticated using ((select private.office_is_admin())) with check ((select private.office_is_admin()));

insert into public.office_wissen_regeln (id, text) values (1, $regeln$Regeln für das Projektwissen

Zweck: Was im Projekt erarbeitet wird, soll das ganze Projektteam wissen. Die KI schreibt und pflegt die Seiten; das Team liest, fragt und korrigiert. Niemand muss etwas ordnen.

Seiten
- Eine Seite je Sache, die man im Projekt nachschlägt, zum Beispiel «Bodenbelag Flure», «Lichtkonzept», «Brandschutz Treppenhaus» oder «Wünsche der Bauherrschaft». Lieber wenige gehaltvolle Seiten als viele kleine. Eine neue Seite nur, wenn das Neue zu keiner bestehenden passt; passen zwei Seiten zusammen, führe sie zusammen.
- Titel: kurz, sachlich, auf Deutsch, ohne Datum und ohne Namen von Personen.
- Aufbau: zuerst in zwei bis vier Sätzen, wo die Sache steht; dann die Einzelheiten (Varianten, Kennwerte, Preise, Hersteller, Bezüge zu Normen ohne Normtext); am Ende die offenen Fragen. Überschriften, Listen und Tabellen, wo sie helfen.
- «Kurz»: ein Satz, der in der Übersicht steht.
- Nichts erfinden. Unsicheres als solches kennzeichnen. Zahlen mit Einheit und Stand.
- Jede Aussage, die nicht offensichtlich ist, nennt ihre Herkunft in Klammern, zum Beispiel (Beitrag vom 26.11.2026, Recherche Bodenbeläge) oder (Protokoll Jour fixe 12.11.).
- Verweise auf andere Seiten mit [[Seitentitel]].
- Neues wird eingearbeitet, nicht angehängt: was überholt ist, wird ersetzt; frühere Fassungen bleiben im Verlauf.
- Widerspricht Neues dem Bisherigen und ist es nicht geklärt, beide Seiten nennen: «Widerspruch: … (Herkunft) – … (Herkunft)».
- Hinweise und Korrekturen aus dem Team werden eingearbeitet wie jeder Beitrag; ihre Herkunft bleibt sichtbar.

Entscheidungen
- Festhalten, was entschieden ist oder zur Entscheidung steht: was, wann, wer, Herkunft.
- «beschlossen» nur, wenn die Person es ausdrücklich entschieden hat und dazu befugt ist (Projektleitung) oder die Bauherrschaft es freigegeben hat; sonst «vorgeschlagen».
- Ändert sich eine Entscheidung, ersetzt die neue die alte; die alte bleibt sichtbar.

Was nicht hineingehört (Leitfaden «Was darf ins TBA Office?»)
- Gehälter und andere Personaldaten, Ausweis- und Bankdaten, Gesundheitsdaten, Passwörter, Normtexte (DIN) und was die Bauherrschaft nur auf Papier will.
- Private Daten von Bauherren oder Nachbarn nur, wenn das Projekt sie braucht.
- Keine Urteile über Personen.

Sprache: Deutsch, sachlich und vollständig genug für jemanden, der beim Gespräch nicht dabei war.$regeln$);

-- Zugriff wie im übrigen Office: lesen nach den Regeln oben; schreiben nur über die Funktionen unten (keine
-- Schreibrechte auf den neuen Tabellen; die Regeln ändern nur Admins).
revoke all on public.office_wissen_beitraege, public.office_wissen_versionen, public.office_wissen_protokoll,
  public.office_wissen_regeln from public, anon, authenticated;
grant select on public.office_wissen_beitraege, public.office_wissen_versionen, public.office_wissen_protokoll,
  public.office_wissen_regeln to authenticated;
grant update (text, updated_at, updated_by) on public.office_wissen_regeln to authenticated;

-- Je Projekt eine geltende Seite je Titel (Groß- und Kleinschreibung egal).
create unique index office_wissen_seite_titel on public.minds_work_memory (project_id, lower(btrim(title)))
  where memory_type = 'document_state' and metadata->>'kind' = 'wissensseite' and status = 'confirmed';

-- Teilen: ein Beitrag (ganz und unverändert) mit Herkunft.
create or replace function public.office_wissen_beitrag_teilen(p_project uuid, p_titel text, p_inhalt text,
  p_art text default 'chat', p_quelle text default null, p_seite text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if not (select private.office_project_team_has_access(p_project)) then
    raise exception 'Kein Zugang zu diesem Projekt.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_titel, ''))) not between 1 and 200 then
    raise exception 'Der Beitrag braucht einen Titel (höchstens 200 Zeichen).' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_inhalt, ''))) = 0 or length(p_inhalt) > 200000 then
    raise exception 'Der Beitrag ist leer oder zu lang (höchstens 200.000 Zeichen).' using errcode = '22023';
  end if;
  if coalesce(nullif(btrim(p_art), ''), 'chat') not in ('chat', 'thread', 'korrektur', 'notiz') then
    raise exception 'Unbekannte Art des Beitrags.' using errcode = '22023';
  end if;
  insert into public.office_wissen_beitraege (project_id, user_id, art, titel, inhalt, quelle, seite)
  values (p_project, v_uid, coalesce(nullif(btrim(p_art), ''), 'chat'), btrim(coalesce(p_titel, '')), coalesce(p_inhalt, ''),
    nullif(btrim(p_quelle), ''), nullif(btrim(p_seite), ''))
  returning id into v_id;
  insert into public.office_wissen_protokoll (project_id, user_id, art, titel, ref_id)
  values (p_project, v_uid, 'beitrag', btrim(p_titel), v_id);
  return v_id;
end $$;

-- Schreiben: eine Seite anlegen oder fortschreiben (alle im Team dieselbe Seite). Die bisherige Fassung bleibt im
-- Verlauf; mit p_basis (Stand, der gelesen wurde) wird nichts überschrieben, was inzwischen jemand anderes geschrieben
-- hat (der Stand ist die Uhrzeit des Schreibens, clock_timestamp, nicht der Beginn der Transaktion).
-- p_zusammenfuehren: Seiten, die in dieser aufgehen (sie leiten künftig hierher weiter).
create or replace function public.office_wissen_seite_schreiben(p_project uuid, p_titel text, p_inhalt text,
  p_kurz text default null, p_quellen uuid[] default '{}', p_basis timestamptz default null, p_grund text default null,
  p_zusammenfuehren text[] default '{}')
returns table (seite_id uuid, seite_titel text, seite_stand timestamptz, ist_neu boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_titel text := btrim(coalesce(p_titel, ''));
  v_ziel text;
  v_quellen uuid[];
  v_alt public.minds_work_memory%rowtype;
  v_neu public.minds_work_memory%rowtype;
  v_ist_neu boolean := false;
begin
  if not (select private.office_project_team_has_access(p_project)) then
    raise exception 'Kein Zugang zu diesem Projekt.' using errcode = '42501';
  end if;
  if length(v_titel) not between 1 and 200 then
    raise exception 'Der Titel fehlt oder ist zu lang.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_inhalt, ''))) = 0 or length(p_inhalt) > 100000 then
    raise exception 'Der Inhalt fehlt oder ist zu lang (höchstens 100.000 Zeichen).' using errcode = '22023';
  end if;
  select coalesce(array_agg(b.id), '{}') into v_quellen
    from public.office_wissen_beitraege b where b.project_id = p_project and b.id = any(coalesce(p_quellen, '{}'));

  select * into v_alt from public.minds_work_memory m
   where m.project_id = p_project and m.memory_type = 'document_state' and m.metadata->>'kind' = 'wissensseite'
     and m.status = 'confirmed' and lower(btrim(m.title)) = lower(v_titel)
   for update;
  if v_alt.id is null then
    -- Eine zusammengeführte Seite leitet auf die Seite weiter, in der sie aufgegangen ist.
    select m.metadata->>'zusammengefuehrt_in' into v_ziel from public.minds_work_memory m
     where m.project_id = p_project and m.memory_type = 'document_state' and m.metadata->>'kind' = 'wissensseite'
       and m.status = 'superseded' and lower(btrim(m.title)) = lower(v_titel) and m.metadata ? 'zusammengefuehrt_in'
     order by m.updated_at desc limit 1;
    if v_ziel is not null then
      select * into v_alt from public.minds_work_memory m
       where m.project_id = p_project and m.memory_type = 'document_state' and m.metadata->>'kind' = 'wissensseite'
         and m.status = 'confirmed' and lower(btrim(m.title)) = lower(v_ziel)
       for update;
    end if;
  end if;

  if v_alt.id is not null then
    if p_basis is not null and v_alt.updated_at <> p_basis then
      raise exception 'Die Seite «%» wurde inzwischen geändert (Stand %). Bitte neu lesen und einarbeiten.', v_alt.title, v_alt.updated_at
        using errcode = '40001';
    end if;
    insert into public.office_wissen_versionen (project_id, seite_id, titel, inhalt, kurz, von, grund, stand)
    values (p_project, v_alt.id, v_alt.title, v_alt.body, v_alt.metadata->>'kurz',
      nullif(v_alt.metadata->>'aktualisiert_von', '')::uuid, v_alt.metadata->>'grund', v_alt.updated_at);
    update public.minds_work_memory m set
      body = p_inhalt,
      metadata = m.metadata || jsonb_build_object(
        'kurz', coalesce(nullif(btrim(p_kurz), ''), m.metadata->>'kurz'),
        'quellen', (select coalesce(jsonb_agg(distinct q.q), '[]'::jsonb) from (
            select jsonb_array_elements_text(coalesce(m.metadata->'quellen', '[]'::jsonb)) as q
            union select unnest(v_quellen)::text) q),
        'aktualisiert_von', v_uid,
        'grund', nullif(btrim(p_grund), '')),
      updated_at = clock_timestamp()
     where m.id = v_alt.id
     returning * into v_neu;
  else
    insert into public.minds_work_memory (user_id, project_id, memory_type, title, body, status, confirmed_at, updated_at, metadata, provenance)
    values (v_uid, p_project, 'document_state', v_titel, p_inhalt, 'confirmed', now(), clock_timestamp(),
      jsonb_build_object('kind', 'wissensseite', 'kurz', nullif(btrim(p_kurz), ''), 'quellen', to_jsonb(v_quellen::text[]),
        'aktualisiert_von', v_uid, 'grund', nullif(btrim(p_grund), '')),
      jsonb_build_array(jsonb_build_object('kind', 'projektwissen', 'at', now())))
    returning * into v_neu;
    v_ist_neu := true;
  end if;

  update public.office_wissen_beitraege b
     set eingearbeitet_am = coalesce(b.eingearbeitet_am, now()),
         eingearbeitet_in = array(select distinct x from unnest(b.eingearbeitet_in || array[v_neu.title]) x)
   where b.project_id = p_project and b.id = any(v_quellen);

  with z as (
    update public.minds_work_memory m
       set status = 'superseded', metadata = m.metadata || jsonb_build_object('zusammengefuehrt_in', v_neu.title), updated_at = now()
     where m.project_id = p_project and m.memory_type = 'document_state' and m.metadata->>'kind' = 'wissensseite'
       and m.status = 'confirmed' and m.id <> v_neu.id
       and lower(btrim(m.title)) in (select lower(btrim(x)) from unnest(coalesce(p_zusammenfuehren, '{}')) x)
    returning m.id, m.title, m.metadata->'quellen' as quellen)
  , q as (
    update public.minds_work_memory t
       set metadata = t.metadata || jsonb_build_object('quellen', (select coalesce(jsonb_agg(distinct s.q), '[]'::jsonb) from (
             select jsonb_array_elements_text(coalesce(t.metadata->'quellen', '[]'::jsonb)) as q
             union select jsonb_array_elements_text(coalesce(z.quellen, '[]'::jsonb)) from z) s))
     where t.id = v_neu.id and exists (select 1 from z)
    returning t.id)
  insert into public.office_wissen_protokoll (project_id, user_id, art, titel, ref_id)
  select p_project, v_uid, 'seite_zusammengefuehrt', z.title || ' → ' || v_neu.title, z.id from z;

  insert into public.office_wissen_protokoll (project_id, user_id, art, titel, ref_id)
  values (p_project, v_uid, case when v_ist_neu then 'seite_neu' else 'seite_geaendert' end, v_neu.title, v_neu.id);
  return query select v_neu.id, v_neu.title, v_neu.updated_at, v_ist_neu;
end $$;

-- Eine Entscheidung festhalten: beschlossen nur, wenn ausdrücklich so gesagt und die Person das Projekt leitet;
-- sonst vorgeschlagen. Mit p_ersetzt ersetzt sie eine frühere (sobald sie beschlossen ist).
create or replace function public.office_wissen_entscheidung(p_project uuid, p_titel text, p_details text default null,
  p_datum date default null, p_quelle text default null, p_beitrag uuid default null, p_seite text default null,
  p_beschlossen boolean default false, p_ersetzt uuid default null)
returns table (entscheidung_id uuid, entscheidung_status text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_titel text := btrim(coalesce(p_titel, ''));
  v_status text;
  v_beitrag uuid;
  v_dup public.minds_work_memory%rowtype;
  v_ersetzt public.minds_work_memory%rowtype;
  v_neu public.minds_work_memory%rowtype;
begin
  if not (select private.office_project_team_has_access(p_project)) then
    raise exception 'Kein Zugang zu diesem Projekt.' using errcode = '42501';
  end if;
  if length(v_titel) not between 1 and 300 then
    raise exception 'Die Entscheidung braucht einen Titel (höchstens 300 Zeichen).' using errcode = '22023';
  end if;
  select * into v_dup from public.minds_work_memory m
   where m.project_id = p_project and m.memory_type = 'decision' and m.status in ('proposed', 'confirmed')
     and lower(btrim(m.title)) = lower(v_titel)
   limit 1;
  if v_dup.id is not null then
    return query select v_dup.id, v_dup.status;
    return;
  end if;
  if p_beitrag is not null then
    select b.id into v_beitrag from public.office_wissen_beitraege b where b.id = p_beitrag and b.project_id = p_project;
  end if;
  if p_ersetzt is not null then
    select * into v_ersetzt from public.minds_work_memory m
     where m.id = p_ersetzt and m.project_id = p_project and m.memory_type = 'decision'
     for update;
    if v_ersetzt.id is null then
      raise exception 'Die zu ersetzende Entscheidung gibt es in diesem Projekt nicht.' using errcode = '22023';
    end if;
  end if;
  v_status := case when coalesce(p_beschlossen, false) and (select private.office_leads_project(p_project))
                   then 'confirmed' else 'proposed' end;
  insert into public.minds_work_memory (user_id, project_id, memory_type, title, body, status, occurred_at, confirmed_at, metadata, provenance)
  values (v_uid, p_project, 'decision', v_titel, coalesce(p_details, ''), v_status,
    case when p_datum is not null then (p_datum::timestamp + interval '12 hours') at time zone 'UTC' end,
    case when v_status = 'confirmed' then now() end,
    jsonb_strip_nulls(jsonb_build_object('kind', 'entscheidung', 'quelle', nullif(btrim(p_quelle), ''), 'beitrag_id', v_beitrag,
      'seite', nullif(btrim(p_seite), ''), 'ersetzt', v_ersetzt.id, 'vorgeschlagen_von', v_uid,
      'entschieden_von', case when v_status = 'confirmed' then v_uid end)),
    jsonb_build_array(jsonb_build_object('kind', 'projektwissen', 'at', now())))
  returning * into v_neu;
  if v_status = 'confirmed' and v_ersetzt.id is not null and v_ersetzt.status in ('proposed', 'confirmed') then
    update public.minds_work_memory m set status = 'superseded',
      metadata = m.metadata || jsonb_build_object('ersetzt_durch', v_neu.id), updated_at = now()
     where m.id = v_ersetzt.id;
    insert into public.office_wissen_protokoll (project_id, user_id, art, titel, ref_id)
    values (p_project, v_uid, 'entscheidung_ersetzt', v_ersetzt.title, v_ersetzt.id);
  end if;
  insert into public.office_wissen_protokoll (project_id, user_id, art, titel, ref_id)
  values (p_project, v_uid, case when v_status = 'confirmed' then 'entscheidung_beschlossen' else 'entscheidung_vorgeschlagen' end,
    v_neu.title, v_neu.id);
  return query select v_neu.id, v_neu.status;
end $$;

-- Eine vorgeschlagene Entscheidung bestätigen oder verwerfen: nur die Projektleitung (oder Admins) im Projektteam.
create or replace function public.office_wissen_entscheidung_pruefen(p_id uuid, p_beschliessen boolean)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.minds_work_memory%rowtype;
begin
  select * into v_row from public.minds_work_memory m where m.id = p_id and m.memory_type = 'decision' for update;
  if v_row.id is null or not (select private.office_project_team_has_access(v_row.project_id)) then
    raise exception 'Diese Entscheidung gibt es nicht oder sie ist für dieses Konto nicht sichtbar.' using errcode = '42501';
  end if;
  if not (select private.office_leads_project(v_row.project_id)) then
    raise exception 'Bestätigen oder verwerfen kann nur die Projektleitung.' using errcode = '42501';
  end if;
  if v_row.status <> 'proposed' then
    return v_row.status;
  end if;
  if coalesce(p_beschliessen, false) then
    update public.minds_work_memory m set status = 'confirmed', confirmed_at = now(),
      metadata = m.metadata || jsonb_build_object('entschieden_von', v_uid), updated_at = now()
     where m.id = v_row.id;
    if v_row.metadata ? 'ersetzt' then
      with alt as (
        update public.minds_work_memory m set status = 'superseded',
          metadata = m.metadata || jsonb_build_object('ersetzt_durch', v_row.id), updated_at = now()
         where m.id = nullif(v_row.metadata->>'ersetzt', '')::uuid and m.project_id = v_row.project_id
           and m.memory_type = 'decision' and m.status in ('proposed', 'confirmed')
        returning m.id, m.title)
      insert into public.office_wissen_protokoll (project_id, user_id, art, titel, ref_id)
      select v_row.project_id, v_uid, 'entscheidung_ersetzt', alt.title, alt.id from alt;
    end if;
    insert into public.office_wissen_protokoll (project_id, user_id, art, titel, ref_id)
    values (v_row.project_id, v_uid, 'entscheidung_beschlossen', v_row.title, v_row.id);
    return 'confirmed';
  end if;
  update public.minds_work_memory m set status = 'rejected',
    metadata = m.metadata || jsonb_build_object('verworfen_von', v_uid), updated_at = now()
   where m.id = v_row.id;
  insert into public.office_wissen_protokoll (project_id, user_id, art, titel, ref_id)
  values (v_row.project_id, v_uid, 'entscheidung_verworfen', v_row.title, v_row.id);
  return 'rejected';
end $$;

revoke all on function public.office_wissen_beitrag_teilen(uuid, text, text, text, text, text) from public, anon;
revoke all on function public.office_wissen_seite_schreiben(uuid, text, text, text, uuid[], timestamptz, text, text[]) from public, anon;
revoke all on function public.office_wissen_entscheidung(uuid, text, text, date, text, uuid, text, boolean, uuid) from public, anon;
revoke all on function public.office_wissen_entscheidung_pruefen(uuid, boolean) from public, anon;
grant execute on function public.office_wissen_beitrag_teilen(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.office_wissen_seite_schreiben(uuid, text, text, text, uuid[], timestamptz, text, text[]) to authenticated;
grant execute on function public.office_wissen_entscheidung(uuid, text, text, date, text, uuid, text, boolean, uuid) to authenticated;
grant execute on function public.office_wissen_entscheidung_pruefen(uuid, boolean) to authenticated;
