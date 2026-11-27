-- Fehler aus dem Browser (Gari, 27.11.2026): was in den Seiten des Office schiefgeht (eine Ausnahme im Skript, ein
-- abgelehntes Versprechen), landet hier, damit die tägliche Codeprüfung mit echten Fehlern arbeitet statt mit
-- Vermutungen. Gespeichert wird nur das Technische: Meldung, Ort im Code, Seite ohne Parameter, Browser in Kurzform.
-- E-Mail-Adressen, Tokens und Parameter in Adressen werden vor dem Speichern entfernt. Melden dürfen nur aktive
-- Mitglieder, gedrosselt (höchstens 50 verschiedene Fehler je Person und Tag, gleiche zählen nur hoch). Lesen darf
-- niemand über die App: nur der Dienst (die geplanten Prüfungen fragen die Datenbank direkt ab).

create table public.office_client_fehler (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tag date not null default ((now() at time zone 'Europe/Berlin')::date),
  fingerabdruck text not null check (fingerabdruck ~ '^[0-9a-f]{32}$'),
  seite text not null check (char_length(seite) between 1 and 120),
  art text not null check (art in ('fehler', 'promise')),
  nachricht text not null check (char_length(nachricht) between 1 and 300),
  ort text check (char_length(ort) <= 200),
  stapel text check (char_length(stapel) <= 1200),
  browser text check (char_length(browser) <= 120),
  version text check (char_length(version) <= 40),
  anzahl integer not null default 1 check (anzahl between 1 and 100000),
  erstes_mal timestamptz not null default now(),
  letztes_mal timestamptz not null default now(),
  unique (user_id, tag, fingerabdruck)
);
comment on table public.office_client_fehler is
  'Fehler aus dem Browser (Skriptfehler, abgelehnte Versprechen) für die Codeprüfung. Nur Technisches, bereinigt; melden über office_client_fehler_melden, lesen nur der Dienst.';
create index office_client_fehler_letztes_mal on public.office_client_fehler (letztes_mal desc);

alter table public.office_client_fehler enable row level security;
revoke all on public.office_client_fehler from public, anon, authenticated;

-- Entfernt, was nicht in ein Fehlerprotokoll gehört: Parameter in Adressen (können Tokens tragen), E-Mail-Adressen und
-- JWTs. Kürzt auf die erlaubte Länge; leer wird NULL.
create or replace function private.office_fehler_saeubern(p_text text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p_text, ''), '(https?://[^[:space:]?#''")]+)[?#][^[:space:]''")]*', '\1', 'g'),
        '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[E-Mail]', 'g'),
      'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*', '[Token]', 'g'),
    greatest(p_max, 0)), '')
$$;
revoke all on function private.office_fehler_saeubern(text, integer) from public, anon, authenticated;

create or replace function public.office_client_fehler_melden(
  p_seite text,
  p_art text,
  p_nachricht text,
  p_ort text default null,
  p_stapel text default null,
  p_browser text default null,
  p_version text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tag date := (now() at time zone 'Europe/Berlin')::date;
  v_art text;
  v_seite text;
  v_nachricht text;
  v_ort text;
  v_fp text;
  v_heute integer;
begin
  if v_uid is null or not (select private.office_is_member()) then
    return;
  end if;
  v_art := case when p_art = 'promise' then 'promise' else 'fehler' end;
  v_seite := coalesce(nullif(left(regexp_replace(coalesce(p_seite, ''), '[?#].*$', ''), 120), ''), '/');
  v_nachricht := coalesce(private.office_fehler_saeubern(p_nachricht, 300), '(ohne Meldung)');
  v_ort := private.office_fehler_saeubern(p_ort, 200);
  v_fp := md5(v_art || '|' || v_seite || '|' || left(v_nachricht, 200) || '|' || coalesce(v_ort, ''));
  -- Gedrosselt: höchstens 50 verschiedene Fehler je Person und Tag; ein schon bekannter zählt nur hoch.
  select count(*) into v_heute from public.office_client_fehler where user_id = v_uid and tag = v_tag;
  if v_heute >= 50 and not exists (
    select 1 from public.office_client_fehler where user_id = v_uid and tag = v_tag and fingerabdruck = v_fp
  ) then
    return;
  end if;
  insert into public.office_client_fehler (user_id, tag, fingerabdruck, seite, art, nachricht, ort, stapel, browser, version)
  values (v_uid, v_tag, v_fp, v_seite, v_art, v_nachricht, v_ort,
          private.office_fehler_saeubern(p_stapel, 1200),
          nullif(left(coalesce(p_browser, ''), 120), ''),
          nullif(left(coalesce(p_version, ''), 40), ''))
  on conflict (user_id, tag, fingerabdruck) do update
    set anzahl = least(public.office_client_fehler.anzahl + 1, 100000),
        letztes_mal = now();
exception when others then
  -- Ein Fehler beim Melden darf die Seite nie stören.
  raise warning 'office_client_fehler_melden: %', sqlerrm;
end;
$$;
revoke all on function public.office_client_fehler_melden(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.office_client_fehler_melden(text, text, text, text, text, text, text) to authenticated;
