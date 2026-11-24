-- TBA Office · Projektdokumente v1 (24.11.2026, Claude; Entwurf von Gari am 24.11.2026 freigegeben).
--
-- Die Bürovorlagen LPH 3 werden Dokumente des Projekts, im Office bearbeitet statt als Datei verschickt.
-- Erster Schritt: Klärungsliste, Entscheidungsliste und Entscheidungsvorlagen. Die Spalten stehen im Client
-- (projektdokumente-kern.js), so wie in der Bürovorlage; hier liegen nur die Daten.
--
-- office_projektdokumente              ein Dokument eines Projekts je Art; Kopfangaben in «meta».
-- office_projektdokument_zeilen        die Zeilen: eine Klärung, eine Entscheidung oder eine Vorlage. Jede Zeile wird
--                                      einzeln gespeichert, mit eigener Serverrevision; wer verschiedene Zeilen bearbeitet,
--                                      stört den anderen nicht. Die Nummer vergibt die Datenbank.
-- office_projektdokument_aenderungen   Verlauf je Zeile und Feld (wer, wann, von Hand oder aus einem Vorschlag von Romy).
--                                      Schreibt nur der Trigger; niemand kann ihn von außen ändern.
-- office_projektdokument_vorschlaege   Vorschläge von Romy, jeder mit Fundstelle. Sie ändern nichts, bis jemand aus dem
--                                      Projektteam sie übernimmt. Eine Entscheidung schlägt Romy nie vor.
-- office_projektdokument_staende       festgehaltene Stände, etwa eine Vorlage beim Vorlegen; unveränderlich.
-- office_projektdokument_ai_requests   jede Anfrage an Romy wird vor dem Modellaufruf gezählt.
--
-- Wer was darf: lesen und bearbeiten, wer das Dokument angelegt hat, das Projekt leitet (Projektleitung oder Admin)
-- oder im Projektteam ist, wie bei der Kostenberechnung. Ein Dokument wird nicht gelöscht; eine Zeile schon, der
-- Verlauf behält sie. «entschieden» braucht Datum, Entscheider und Entscheidung und kommt nie aus einem Vorschlag.
-- Nichts Destruktives; nur neue Tabellen, Funktionen und Policies.

create table public.office_projektdokumente (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.office_projects(id) on delete restrict,
  art text not null check (art in ('klaerungsliste','entscheidungsliste','entscheidungsvorlagen')),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object' and octet_length(meta::text) <= 20000),
  server_revision bigint not null default 1 check (server_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, art)
);
create index office_projektdokumente_owner_idx on public.office_projektdokumente(owner_id);

create table public.office_projektdokument_zeilen (
  id uuid primary key default gen_random_uuid(),
  dokument_id uuid not null references public.office_projektdokumente(id) on delete cascade,
  nr integer not null check (nr between 1 and 99999),
  daten jsonb not null default '{}'::jsonb check (jsonb_typeof(daten) = 'object' and octet_length(daten::text) <= 100000),
  -- «romy», wenn diese Änderung einen Vorschlag übernimmt (vorschlag_id); sonst «hand». Setzt der Trigger.
  quelle text not null default 'hand' check (quelle in ('hand','romy')),
  vorschlag_id uuid,
  server_revision bigint not null default 1 check (server_revision > 0),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dokument_id, nr)
);
create index office_projektdokument_zeilen_created_by_idx on public.office_projektdokument_zeilen(created_by);
create index office_projektdokument_zeilen_updated_by_idx on public.office_projektdokument_zeilen(updated_by);
create index office_projektdokument_zeilen_vorschlag_idx on public.office_projektdokument_zeilen(vorschlag_id);
comment on column public.office_projektdokument_zeilen.server_revision is
  'Monotone Revision je Zeile für bedingte PostgREST-Updates; der Client filtert auf die erwartete Revision.';

create table public.office_projektdokument_vorschlaege (
  id uuid primary key default gen_random_uuid(),
  dokument_id uuid not null references public.office_projektdokumente(id) on delete cascade,
  -- leer bei einer neuen Zeile, sonst die Zeile, die sich ändern soll
  zeile_id uuid references public.office_projektdokument_zeilen(id) on delete cascade,
  art text not null check (art in ('neu','aenderung')),
  daten jsonb not null check (jsonb_typeof(daten) = 'object' and octet_length(daten::text) <= 40000),
  fundstelle text not null default '' check (char_length(fundstelle) <= 400),
  begruendung text not null default '' check (char_length(begruendung) <= 2000),
  quelle text not null default '' check (char_length(quelle) <= 300),
  status text not null default 'offen' check (status in ('offen','uebernommen','verworfen')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entschieden_von uuid references auth.users(id) on delete set null,
  entschieden_am timestamptz,
  created_at timestamptz not null default now(),
  check ((art = 'neu') = (zeile_id is null)),
  check ((status = 'offen') = (entschieden_am is null)),
  -- Romy schlägt nie eine Entscheidung vor: kein «entschieden», kein Datum, Entscheider, Inhalt oder Bestätigung.
  constraint office_projektdokument_vorschlag_ohne_entscheidung check (
    not (daten ?| array['entschieden_am','entscheidung','entscheider','bestaetigt_am'])
    and coalesce(daten->>'status','') <> 'entschieden')
);
create index office_projektdokument_vorschlaege_dokument_idx on public.office_projektdokument_vorschlaege(dokument_id, status);
create index office_projektdokument_vorschlaege_zeile_idx on public.office_projektdokument_vorschlaege(zeile_id);
create index office_projektdokument_vorschlaege_created_by_idx on public.office_projektdokument_vorschlaege(created_by);
create index office_projektdokument_vorschlaege_entschieden_von_idx on public.office_projektdokument_vorschlaege(entschieden_von);

alter table public.office_projektdokument_zeilen add constraint office_projektdokument_zeilen_vorschlag_fkey
  foreign key (vorschlag_id) references public.office_projektdokument_vorschlaege(id) on delete set null;

create table public.office_projektdokument_aenderungen (
  id bigint generated always as identity primary key,
  dokument_id uuid not null references public.office_projektdokumente(id) on delete cascade,
  zeile_id uuid references public.office_projektdokument_zeilen(id) on delete set null,
  nr integer not null,
  vorgang text not null check (vorgang in ('angelegt','geaendert','geloescht')),
  feld text check (feld is null or char_length(feld) <= 80),
  alt jsonb,
  neu jsonb,
  quelle text not null default 'hand' check (quelle in ('hand','romy')),
  vorschlag_id uuid references public.office_projektdokument_vorschlaege(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index office_projektdokument_aenderungen_dokument_idx on public.office_projektdokument_aenderungen(dokument_id, id desc);
create index office_projektdokument_aenderungen_zeile_idx on public.office_projektdokument_aenderungen(zeile_id, id desc);
create index office_projektdokument_aenderungen_vorschlag_idx on public.office_projektdokument_aenderungen(vorschlag_id);
create index office_projektdokument_aenderungen_user_idx on public.office_projektdokument_aenderungen(user_id);

create table public.office_projektdokument_staende (
  id uuid primary key default gen_random_uuid(),
  dokument_id uuid not null references public.office_projektdokumente(id) on delete cascade,
  zeile_id uuid references public.office_projektdokument_zeilen(id) on delete set null,
  bezeichnung text not null check (char_length(btrim(bezeichnung)) between 1 and 200),
  inhalt jsonb not null check (jsonb_typeof(inhalt) = 'object' and octet_length(inhalt::text) <= 400000),
  html text not null default '' check (octet_length(html) <= 600000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index office_projektdokument_staende_dokument_idx on public.office_projektdokument_staende(dokument_id, created_at desc);
create index office_projektdokument_staende_zeile_idx on public.office_projektdokument_staende(zeile_id);
create index office_projektdokument_staende_created_by_idx on public.office_projektdokument_staende(created_by);

create table public.office_projektdokument_ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index office_projektdokument_ai_requests_user_idx on public.office_projektdokument_ai_requests(user_id, created_at desc);

-- ── Zugang ───────────────────────────────────────────────────────────────────
create function private.office_projektdokument_zugang(p_owner uuid, p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.office_is_member())
     and (p_owner = (select auth.uid())
          or (select private.office_leads_project(p_project))
          or (select private.office_in_project_team(p_project)))
$$;
revoke all on function private.office_projektdokument_zugang(uuid, uuid) from public, anon;
grant execute on function private.office_projektdokument_zugang(uuid, uuid) to authenticated;

create function private.office_projektdokument_zugang_id(p_dokument uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.office_projektdokumente d
                where d.id = p_dokument and private.office_projektdokument_zugang(d.owner_id, d.project_id))
$$;
revoke all on function private.office_projektdokument_zugang_id(uuid) from public, anon;
grant execute on function private.office_projektdokument_zugang_id(uuid) to authenticated;

-- ── Trigger ──────────────────────────────────────────────────────────────────
-- Projekt, Art und Ersteller eines Dokuments ändern sich nach dem Anlegen nicht.
create function private.office_projektdokument_identitaet() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.project_id is distinct from old.project_id or new.art is distinct from old.art
     or new.owner_id is distinct from old.owner_id then
    raise exception 'Projekt, Art und Ersteller eines Projektdokuments sind unveränderlich';
  end if;
  return new;
end;
$$;
revoke all on function private.office_projektdokument_identitaet() from public, anon, authenticated;
create trigger office_projektdokumente_identitaet before update on public.office_projektdokumente
  for each row execute function private.office_projektdokument_identitaet();
create trigger office_projektdokumente_revision before update on public.office_projektdokumente
  for each row execute function public.office_terminplan_advance_revision();
create trigger office_projektdokumente_touch before update on public.office_projektdokumente
  for each row execute function public.office_touch_updated_at();

-- Vor dem Speichern einer Zeile: Nummer vergeben (das Dokument wird dafür kurz gesperrt), Herkunft festlegen und die
-- Regeln der Entscheidungsliste prüfen. Definer, damit die Nummer über alle Zeilen des Dokuments vergeben wird.
create function private.office_projektdokument_zeile_vorher() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_art text;
  v_alt jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    select d.art into v_art from public.office_projektdokumente d where d.id = new.dokument_id for update;
    select coalesce(max(z.nr), 0) + 1 into new.nr from public.office_projektdokument_zeilen z where z.dokument_id = new.dokument_id;
    new.updated_by := null;
  else
    if new.dokument_id is distinct from old.dokument_id or new.nr is distinct from old.nr
       or new.created_by is distinct from old.created_by then
      raise exception 'Dokument, Nummer und Ersteller einer Zeile sind unveränderlich';
    end if;
    select d.art into v_art from public.office_projektdokumente d where d.id = new.dokument_id;
    v_alt := old.daten;
    -- Ein Vorschlag zählt nur für die Änderung, die ihn übernimmt.
    if new.vorschlag_id is not distinct from old.vorschlag_id then
      new.vorschlag_id := null;
    end if;
    new.updated_by := (select auth.uid());
  end if;
  new.quelle := case when new.vorschlag_id is null then 'hand' else 'romy' end;
  if new.vorschlag_id is not null and not exists(
       select 1 from public.office_projektdokument_vorschlaege v
       where v.id = new.vorschlag_id and v.dokument_id = new.dokument_id
         and (v.zeile_id is null or v.zeile_id = new.id)) then
    raise exception 'Der Vorschlag gehört nicht zu dieser Zeile';
  end if;
  if v_art = 'entscheidungsliste' then
    if coalesce(new.daten->>'status', '') = 'entschieden'
       and (coalesce(btrim(new.daten->>'entschieden_am'), '') = '' or coalesce(btrim(new.daten->>'entscheider'), '') = ''
            or coalesce(btrim(new.daten->>'entscheidung'), '') = '') then
      raise exception 'Eine Entscheidung braucht Datum, Entscheider und Entscheidung';
    end if;
    if new.quelle = 'romy' and (
         (coalesce(new.daten->>'status', '') = 'entschieden' and coalesce(v_alt->>'status', '') <> 'entschieden')
         or exists(select 1 from unnest(array['entschieden_am','entscheidung','entscheider','bestaetigt_am']) k
                   where (new.daten -> k) is distinct from (v_alt -> k))) then
      raise exception 'Romy trägt keine Entscheidung ein';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.office_projektdokument_zeile_vorher() from public, anon, authenticated;
create trigger office_projektdokument_zeilen_vorher before insert or update on public.office_projektdokument_zeilen
  for each row execute function private.office_projektdokument_zeile_vorher();
create trigger office_projektdokument_zeilen_revision before update on public.office_projektdokument_zeilen
  for each row execute function public.office_terminplan_advance_revision();
create trigger office_projektdokument_zeilen_touch before update on public.office_projektdokument_zeilen
  for each row execute function public.office_touch_updated_at();

-- Verlauf: jede neue, geänderte oder gelöschte Zeile, je Feld. Felder, die mit «_» beginnen, sind Ansicht und zählen
-- nicht. Ändert dieselbe Person dasselbe Feld innerhalb von zwei Minuten noch einmal von Hand, wird der letzte Eintrag
-- fortgeschrieben statt ein neuer angelegt (Tippen in zwei Schritten ist eine Änderung).
create function private.office_projektdokument_zeile_protokoll() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  uid uuid := (select auth.uid());
  v_id bigint;
  v_alt jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.office_projektdokument_aenderungen(dokument_id, zeile_id, nr, vorgang, neu, quelle, vorschlag_id, user_id)
    values (new.dokument_id, new.id, new.nr, 'angelegt', new.daten, new.quelle, new.vorschlag_id, uid);
    return null;
  elsif tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(new.daten) union select jsonb_object_keys(old.daten) loop
      continue when left(k, 1) = '_';
      continue when coalesce(new.daten -> k, '""'::jsonb) is not distinct from coalesce(old.daten -> k, '""'::jsonb);
      v_id := null;
      if new.quelle = 'hand' then
        select a.id, a.alt into v_id, v_alt from public.office_projektdokument_aenderungen a
         where a.zeile_id = new.id and a.feld = k and a.vorgang = 'geaendert'
           and a.id = (select max(b.id) from public.office_projektdokument_aenderungen b where b.zeile_id = new.id)
           and a.user_id = uid and a.quelle = 'hand' and a.created_at > now() - interval '2 minutes';
      end if;
      if v_id is not null then
        if coalesce(v_alt, '""'::jsonb) is not distinct from coalesce(new.daten -> k, '""'::jsonb) then
          delete from public.office_projektdokument_aenderungen where id = v_id;
        else
          update public.office_projektdokument_aenderungen set neu = new.daten -> k where id = v_id;
        end if;
      else
        insert into public.office_projektdokument_aenderungen(dokument_id, zeile_id, nr, vorgang, feld, alt, neu, quelle, vorschlag_id, user_id)
        values (new.dokument_id, new.id, new.nr, 'geaendert', k, old.daten -> k, new.daten -> k, new.quelle, new.vorschlag_id, uid);
      end if;
    end loop;
    return null;
  else
    -- Wird das ganze Dokument entfernt (nur durch einen Admin in der Datenbank), gibt es keinen Verlauf mehr zu führen.
    if exists(select 1 from public.office_projektdokumente d where d.id = old.dokument_id) then
      insert into public.office_projektdokument_aenderungen(dokument_id, zeile_id, nr, vorgang, alt, quelle, user_id)
      values (old.dokument_id, null, old.nr, 'geloescht', old.daten, 'hand', uid);
    end if;
    return null;
  end if;
end;
$$;
revoke all on function private.office_projektdokument_zeile_protokoll() from public, anon, authenticated;
create trigger office_projektdokument_zeilen_protokoll after insert or update or delete on public.office_projektdokument_zeilen
  for each row execute function private.office_projektdokument_zeile_protokoll();

-- Ein Vorschlag wird einmal entschieden: übernommen oder verworfen, von wem und wann setzt die Datenbank.
create function private.office_projektdokument_vorschlag_entscheiden() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.status <> 'offen' then
    raise exception 'Über diesen Vorschlag ist schon entschieden';
  end if;
  if new.status not in ('uebernommen','verworfen') then
    raise exception 'Ein Vorschlag wird übernommen oder verworfen';
  end if;
  if (new.dokument_id, new.zeile_id, new.art, new.daten, new.fundstelle, new.begruendung, new.quelle, new.created_by, new.created_at)
     is distinct from (old.dokument_id, old.zeile_id, old.art, old.daten, old.fundstelle, old.begruendung, old.quelle, old.created_by, old.created_at) then
    raise exception 'Ein Vorschlag selbst ändert sich nicht';
  end if;
  new.entschieden_von := (select auth.uid());
  new.entschieden_am := now();
  return new;
end;
$$;
revoke all on function private.office_projektdokument_vorschlag_entscheiden() from public, anon, authenticated;
create trigger office_projektdokument_vorschlaege_entscheiden before update on public.office_projektdokument_vorschlaege
  for each row execute function private.office_projektdokument_vorschlag_entscheiden();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.office_projektdokumente enable row level security;
alter table public.office_projektdokument_zeilen enable row level security;
alter table public.office_projektdokument_vorschlaege enable row level security;
alter table public.office_projektdokument_aenderungen enable row level security;
alter table public.office_projektdokument_staende enable row level security;
alter table public.office_projektdokument_ai_requests enable row level security;
revoke all on public.office_projektdokumente, public.office_projektdokument_zeilen, public.office_projektdokument_vorschlaege,
  public.office_projektdokument_aenderungen, public.office_projektdokument_staende, public.office_projektdokument_ai_requests
  from public, anon, authenticated;
grant select, insert, update on public.office_projektdokumente to authenticated;
grant select, insert, update, delete on public.office_projektdokument_zeilen to authenticated;
grant select, insert on public.office_projektdokument_vorschlaege to authenticated;
grant update (status) on public.office_projektdokument_vorschlaege to authenticated;
grant select on public.office_projektdokument_aenderungen to authenticated;
grant select, insert on public.office_projektdokument_staende to authenticated;
grant select, insert on public.office_projektdokument_ai_requests to authenticated;

create policy office_projektdokumente_select on public.office_projektdokumente
  for select to authenticated using ((select private.office_projektdokument_zugang(owner_id, project_id)));
create policy office_projektdokumente_insert on public.office_projektdokumente
  for insert to authenticated
  with check (owner_id = (select auth.uid())
              and (select private.office_is_member())
              and ((select private.office_leads_project(project_id)) or (select private.office_in_project_team(project_id)))
              and exists(select 1 from public.office_projects p where p.id = project_id and p.status = 'aktiv'));
create policy office_projektdokumente_update on public.office_projektdokumente
  for update to authenticated
  using ((select private.office_projektdokument_zugang(owner_id, project_id)))
  with check ((select private.office_projektdokument_zugang(owner_id, project_id)));

create policy office_projektdokument_zeilen_select on public.office_projektdokument_zeilen
  for select to authenticated using (private.office_projektdokument_zugang_id(dokument_id));
create policy office_projektdokument_zeilen_insert on public.office_projektdokument_zeilen
  for insert to authenticated
  with check (created_by = (select auth.uid()) and private.office_projektdokument_zugang_id(dokument_id));
create policy office_projektdokument_zeilen_update on public.office_projektdokument_zeilen
  for update to authenticated
  using (private.office_projektdokument_zugang_id(dokument_id))
  with check (private.office_projektdokument_zugang_id(dokument_id));
create policy office_projektdokument_zeilen_delete on public.office_projektdokument_zeilen
  for delete to authenticated using (private.office_projektdokument_zugang_id(dokument_id));

create policy office_projektdokument_vorschlaege_select on public.office_projektdokument_vorschlaege
  for select to authenticated using (private.office_projektdokument_zugang_id(dokument_id));
create policy office_projektdokument_vorschlaege_insert on public.office_projektdokument_vorschlaege
  for insert to authenticated
  with check (created_by = (select auth.uid()) and status = 'offen' and entschieden_von is null
              and private.office_projektdokument_zugang_id(dokument_id)
              and (zeile_id is null or exists(select 1 from public.office_projektdokument_zeilen z
                                              where z.id = office_projektdokument_vorschlaege.zeile_id
                                                and z.dokument_id = office_projektdokument_vorschlaege.dokument_id)));
create policy office_projektdokument_vorschlaege_update on public.office_projektdokument_vorschlaege
  for update to authenticated
  using (private.office_projektdokument_zugang_id(dokument_id))
  with check (private.office_projektdokument_zugang_id(dokument_id));

create policy office_projektdokument_aenderungen_select on public.office_projektdokument_aenderungen
  for select to authenticated using (private.office_projektdokument_zugang_id(dokument_id));

create policy office_projektdokument_staende_select on public.office_projektdokument_staende
  for select to authenticated using (private.office_projektdokument_zugang_id(dokument_id));
create policy office_projektdokument_staende_insert on public.office_projektdokument_staende
  for insert to authenticated
  with check (created_by = (select auth.uid()) and private.office_projektdokument_zugang_id(dokument_id)
              and (zeile_id is null or exists(select 1 from public.office_projektdokument_zeilen z
                                              where z.id = office_projektdokument_staende.zeile_id
                                                and z.dokument_id = office_projektdokument_staende.dokument_id)));

create policy office_projektdokument_ai_requests_selbst_lesen on public.office_projektdokument_ai_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy office_projektdokument_ai_requests_selbst_anlegen on public.office_projektdokument_ai_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.office_is_member()));

-- Jede Anfrage an Romy wird vor dem bezahlten Modellaufruf gezählt (wie bei Terminplan, Kosten und Produkten).
create function public.office_projektdokument_ai_consume_request() returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not (select private.office_is_member()) then
    return false;
  end if;
  insert into public.office_projektdokument_ai_requests(user_id) values (uid);
  return true;
end;
$$;
revoke all on function public.office_projektdokument_ai_consume_request() from public, anon;
grant execute on function public.office_projektdokument_ai_consume_request() to authenticated;
