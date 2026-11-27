-- TBA Office · KI-Verbrauch der eigenen Funktionen (Gari, 27.11.2026): Kostenberechnung, Dokumente, Produkte,
-- Terminplan und Romys Office-Wege schreiben den Verbrauch jedes Aufrufs bei OpenAI hierher, damit Administratoren das
-- Guthaben täglich im Office im Blick haben. Gezählt wird je Funktion und Projekt, NIE je Person: die Tabelle hat keine
-- Spalte für die Person. Schreiben darf nur der Dienst (die Edge Functions); lesen über die App niemand direkt (keine
-- Policy), die Übersicht für Administratoren liest nur Summen über eine eigene Funktion.

create table public.office_ki_verbrauch (
  id uuid primary key default gen_random_uuid(),
  funktion text not null check (funktion ~ '^[a-z][a-z0-9_]{1,40}$'),
  modell text not null check (char_length(modell) between 1 and 80),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0 and cached_input_tokens <= input_tokens),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  project_id uuid references public.office_projects(id) on delete set null,
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 2000),
  created_at timestamptz not null default now()
);
comment on table public.office_ki_verbrauch is
  'KI-Verbrauch der Office-Funktionen je Aufruf: Funktion, Modell, Tokens, Projekt. Ohne Person. Schreibt nur der Dienst.';
create index office_ki_verbrauch_zeit on public.office_ki_verbrauch (created_at desc);
create index office_ki_verbrauch_projekt on public.office_ki_verbrauch (project_id, created_at desc) where project_id is not null;
-- Ein Lauf, der mehrmals abgeglichen wird (Romys Fähigkeiten), zählt nur einmal.
create unique index office_ki_verbrauch_einmal on public.office_ki_verbrauch (funktion, (details->>'einmal'))
  where details ? 'einmal';

alter table public.office_ki_verbrauch enable row level security;
revoke all on public.office_ki_verbrauch from public, anon, authenticated;
grant select, insert on public.office_ki_verbrauch to service_role;
