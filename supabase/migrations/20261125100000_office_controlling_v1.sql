-- TBA Office · Controlling (25.11.2026, Claude; Wunsch von Gari am 25.11.2026).
--
-- Gari: Für jedes Projekt legt der Chef im Vertrag das Honorar fest und rechnet mit 85 €/h, je Mitarbeiter änderbar.
-- Daraus folgen die vorgesehenen Stunden; am Ende zeigt sich, was gegenüber der Kalkulation gewonnen wurde. Auf das
-- Honorar kommen 5 % Nebenkosten; die Auftraggeber zahlen in Abschlägen. Alle im Projekt sehen Honorar, Zahlungen,
-- Stunden und das Ergebnis; die Sätze und Gehälter der Personen sehen nur Admins (Gari und der Chef).
--
-- office_controlling_pakete         ein Honorarpaket eines Projekts (etwa LPH 3, LPH 1–2, Machbarkeitsstudie): Honorar
--                                   netto, Nebenkosten in Prozent, Kalkulationssatz (€/h) und Stand des Auftrags.
-- office_controlling_staende        ein Stand: Stichtag und der von der Projektleitung geschätzte Leistungsstand (%).
-- office_controlling_stunden        die Stunden einer Person bis zum Stichtag (kumuliert); ohne Person: das Team.
-- office_controlling_zahlungen      eine Zahlung oder Abschlagsrechnung: Datum, netto (mit Nebenkosten), MwSt, Status.
-- office_controlling_saetze         Kalkulationssatz und Monatsgehalt einer Person ab einem Datum.
-- office_controlling_einstellungen  Arbeitgeberanteil und Jahresstunden für den Stundensatz aus dem Gehalt.
-- office_controlling_summen(p)      je Stand die Stunden und ihr Wert zum Kalkulationssatz, für alle im Projekt; für
--                                   Admins zusätzlich der Wert zum Gehalt. Personen, Sätze und Gehälter bleiben verborgen.
--
-- Bewertung: Was zwischen zwei Ständen dazukommt, zählt zum Satz, der am späteren Stichtag gilt; ein späterer neuer
-- Satz bewertet frühere Stunden nicht neu. Fehlt eine Person in einem Stand, gilt ihr letzter Wert weiter.
--
-- Wer was darf: Pakete, Stände und Zahlungen lesen das Projektteam, die Projektleitung und Admins; Stunden je Person,
-- Sätze, Gehälter und Einstellungen nur Admins. Schreiben nur Admins. Nichts Destruktives: nur neue Tabellen,
-- Funktionen, Trigger und Policies.

create table public.office_controlling_pakete (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.office_projects(id) on delete cascade,
  bezeichnung text not null check (char_length(btrim(bezeichnung)) between 1 and 160),
  leistung text check (leistung is null or char_length(leistung) <= 300),
  honorar_netto numeric(12,2) not null default 0 check (honorar_netto >= 0),
  nebenkosten_prozent numeric(5,2) not null default 5 check (nebenkosten_prozent between 0 and 100),
  kalkulationssatz numeric(8,2) not null default 85 check (kalkulationssatz > 0),
  status text not null default 'beauftragt' check (status in ('angeboten','beauftragt','abgeschlossen')),
  vorlaeufig boolean not null default false,
  notiz text check (notiz is null or char_length(notiz) <= 2000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index office_controlling_pakete_projekt_idx on public.office_controlling_pakete(project_id);

create table public.office_controlling_staende (
  id uuid primary key default gen_random_uuid(),
  paket_id uuid not null references public.office_controlling_pakete(id) on delete cascade,
  stichtag date not null,
  leistungsstand numeric(5,2) check (leistungsstand is null or leistungsstand between 0 and 100),
  notiz text check (notiz is null or char_length(notiz) <= 1000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_controlling_staende_tag_key unique (paket_id, stichtag)
);

create table public.office_controlling_stunden (
  id uuid primary key default gen_random_uuid(),
  stand_id uuid not null references public.office_controlling_staende(id) on delete cascade,
  person_id uuid references auth.users(id) on delete set null,
  person_name text check (person_name is null or char_length(btrim(person_name)) between 1 and 120),
  stunden numeric(8,2) not null check (stunden >= 0 and stunden <= 100000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint office_controlling_stunden_person_check check (person_id is null or person_name is null)
);
-- Je Stand eine Zeile je Person (oder je Name, oder einmal das Team ohne Zuordnung).
create unique index office_controlling_stunden_person_key on public.office_controlling_stunden
  (stand_id, coalesce(person_id::text, 'name:' || lower(btrim(person_name)), 'team'));

create table public.office_controlling_zahlungen (
  id uuid primary key default gen_random_uuid(),
  paket_id uuid not null references public.office_controlling_pakete(id) on delete cascade,
  datum date,
  bezeichnung text check (bezeichnung is null or char_length(bezeichnung) <= 160),
  netto numeric(12,2) not null check (netto >= 0),
  mwst numeric(12,2) not null default 0 check (mwst >= 0),
  status text not null default 'bezahlt' check (status in ('gestellt','bezahlt')),
  vorlaeufig boolean not null default false,
  notiz text check (notiz is null or char_length(notiz) <= 1000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index office_controlling_zahlungen_paket_idx on public.office_controlling_zahlungen(paket_id, datum);

create table public.office_controlling_saetze (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references auth.users(id) on delete cascade,
  gueltig_ab date not null default current_date,
  kalkulationssatz numeric(8,2) check (kalkulationssatz is null or kalkulationssatz > 0),
  monatsgehalt numeric(10,2) check (monatsgehalt is null or monatsgehalt >= 0),
  notiz text check (notiz is null or char_length(notiz) <= 500),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint office_controlling_saetze_tag_key unique (person_id, gueltig_ab)
);

create table public.office_controlling_einstellungen (
  id boolean primary key default true check (id),
  arbeitgeberanteil_prozent numeric(5,2) not null default 21 check (arbeitgeberanteil_prozent between 0 and 100),
  jahresstunden numeric(7,1) not null default 1600 check (jahresstunden between 100 and 4000),
  updated_at timestamptz not null default now()
);
insert into public.office_controlling_einstellungen default values;

-- Wer etwas angelegt hat, bleibt; ein Stand und eine Zahlung bleiben an ihrem Paket, Stunden an ihrem Stand.
create function private.office_controlling_fest() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Wer einen Eintrag angelegt hat, bleibt unverändert.' using errcode = '23514';
  end if;
  if tg_table_name = 'office_controlling_pakete' and new.project_id is distinct from old.project_id then
    raise exception 'Ein Honorarpaket bleibt an seinem Projekt.' using errcode = '23514';
  end if;
  if tg_table_name in ('office_controlling_staende','office_controlling_zahlungen') and new.paket_id is distinct from old.paket_id then
    raise exception 'Ein Stand und eine Zahlung bleiben an ihrem Paket.' using errcode = '23514';
  end if;
  if tg_table_name = 'office_controlling_stunden' and new.stand_id is distinct from old.stand_id then
    raise exception 'Stunden bleiben an ihrem Stand.' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.office_controlling_fest() from public, anon, authenticated;

create trigger office_controlling_pakete_fest before update on public.office_controlling_pakete
  for each row execute function private.office_controlling_fest();
create trigger office_controlling_staende_fest before update on public.office_controlling_staende
  for each row execute function private.office_controlling_fest();
create trigger office_controlling_stunden_fest before update on public.office_controlling_stunden
  for each row execute function private.office_controlling_fest();
create trigger office_controlling_zahlungen_fest before update on public.office_controlling_zahlungen
  for each row execute function private.office_controlling_fest();
create trigger office_controlling_saetze_fest before update on public.office_controlling_saetze
  for each row execute function private.office_controlling_fest();
create trigger office_controlling_pakete_touch before update on public.office_controlling_pakete
  for each row execute function public.office_touch_updated_at();
create trigger office_controlling_staende_touch before update on public.office_controlling_staende
  for each row execute function public.office_touch_updated_at();
create trigger office_controlling_zahlungen_touch before update on public.office_controlling_zahlungen
  for each row execute function public.office_touch_updated_at();
create trigger office_controlling_saetze_touch before update on public.office_controlling_saetze
  for each row execute function public.office_touch_updated_at();
create trigger office_controlling_einstellungen_touch before update on public.office_controlling_einstellungen
  for each row execute function public.office_touch_updated_at();

-- Lesen: Projektteam, Projektleitung und Admins (office_leads_project enthält die Admins).
create function private.office_controlling_lesen(p_project uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.office_is_member())
     and ((select private.office_leads_project(p_project)) or (select private.office_in_project_team(p_project)))
$$;
revoke all on function private.office_controlling_lesen(uuid) from public, anon;
grant execute on function private.office_controlling_lesen(uuid) to authenticated;

create function private.office_controlling_paket_lesen(p_paket uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.office_controlling_pakete k
                where k.id = p_paket and (select private.office_controlling_lesen(k.project_id)))
$$;
revoke all on function private.office_controlling_paket_lesen(uuid) from public, anon;
grant execute on function private.office_controlling_paket_lesen(uuid) to authenticated;

alter table public.office_controlling_pakete enable row level security;
alter table public.office_controlling_staende enable row level security;
alter table public.office_controlling_stunden enable row level security;
alter table public.office_controlling_zahlungen enable row level security;
alter table public.office_controlling_saetze enable row level security;
alter table public.office_controlling_einstellungen enable row level security;
revoke all on public.office_controlling_pakete, public.office_controlling_staende, public.office_controlling_stunden,
  public.office_controlling_zahlungen, public.office_controlling_saetze, public.office_controlling_einstellungen
  from public, anon, authenticated;
grant select, insert, update, delete on public.office_controlling_pakete, public.office_controlling_staende,
  public.office_controlling_stunden, public.office_controlling_zahlungen, public.office_controlling_saetze
  to authenticated;
grant select, update on public.office_controlling_einstellungen to authenticated;

-- Pakete, Stände, Zahlungen: lesen das Projekt; schreiben Admins.
create policy office_controlling_pakete_lesen on public.office_controlling_pakete
  for select to authenticated using ((select private.office_controlling_lesen(project_id)));
create policy office_controlling_pakete_anlegen on public.office_controlling_pakete
  for insert to authenticated with check ((select private.office_is_admin()) and created_by = (select auth.uid()));
create policy office_controlling_pakete_aendern on public.office_controlling_pakete
  for update to authenticated using ((select private.office_is_admin())) with check ((select private.office_is_admin()));
create policy office_controlling_pakete_entfernen on public.office_controlling_pakete
  for delete to authenticated using ((select private.office_is_admin()));

create policy office_controlling_staende_lesen on public.office_controlling_staende
  for select to authenticated using ((select private.office_controlling_paket_lesen(paket_id)));
create policy office_controlling_staende_anlegen on public.office_controlling_staende
  for insert to authenticated with check ((select private.office_is_admin()) and created_by = (select auth.uid()));
create policy office_controlling_staende_aendern on public.office_controlling_staende
  for update to authenticated using ((select private.office_is_admin())) with check ((select private.office_is_admin()));
create policy office_controlling_staende_entfernen on public.office_controlling_staende
  for delete to authenticated using ((select private.office_is_admin()));

create policy office_controlling_zahlungen_lesen on public.office_controlling_zahlungen
  for select to authenticated using ((select private.office_controlling_paket_lesen(paket_id)));
create policy office_controlling_zahlungen_anlegen on public.office_controlling_zahlungen
  for insert to authenticated with check ((select private.office_is_admin()) and created_by = (select auth.uid()));
create policy office_controlling_zahlungen_aendern on public.office_controlling_zahlungen
  for update to authenticated using ((select private.office_is_admin())) with check ((select private.office_is_admin()));
create policy office_controlling_zahlungen_entfernen on public.office_controlling_zahlungen
  for delete to authenticated using ((select private.office_is_admin()));

-- Stunden je Person, Sätze, Gehälter, Einstellungen: nur Admins (jeder Admin ändert auch, was der andere eingetragen hat).
create policy office_controlling_stunden_lesen on public.office_controlling_stunden
  for select to authenticated using ((select private.office_is_admin()));
create policy office_controlling_stunden_anlegen on public.office_controlling_stunden
  for insert to authenticated with check ((select private.office_is_admin()) and created_by = (select auth.uid()));
create policy office_controlling_stunden_aendern on public.office_controlling_stunden
  for update to authenticated using ((select private.office_is_admin())) with check ((select private.office_is_admin()));
create policy office_controlling_stunden_entfernen on public.office_controlling_stunden
  for delete to authenticated using ((select private.office_is_admin()));
create policy office_controlling_saetze_lesen on public.office_controlling_saetze
  for select to authenticated using ((select private.office_is_admin()));
create policy office_controlling_saetze_anlegen on public.office_controlling_saetze
  for insert to authenticated with check ((select private.office_is_admin()) and created_by = (select auth.uid()));
create policy office_controlling_saetze_aendern on public.office_controlling_saetze
  for update to authenticated using ((select private.office_is_admin())) with check ((select private.office_is_admin()));
create policy office_controlling_saetze_entfernen on public.office_controlling_saetze
  for delete to authenticated using ((select private.office_is_admin()));
create policy office_controlling_einstellungen_admin on public.office_controlling_einstellungen
  for all to authenticated using ((select private.office_is_admin())) with check ((select private.office_is_admin()));

-- Summen je Stand für alle, die das Projekt lesen: Stunden und ihr Wert zum Kalkulationssatz (Satz der Person ab
-- Stichtag, sonst der des Pakets); für Admins zusätzlich zum Gehalt (Monatsgehalt × 12 × (1 + Arbeitgeberanteil) /
-- Jahresstunden). Der Wert zum Gehalt fehlt, solange für eine Person (oder das Team) kein Gehalt hinterlegt ist.
create function public.office_controlling_summen(p_project uuid)
returns table (stand_id uuid, paket_id uuid, stichtag date, leistungsstand numeric,
               stunden numeric, wert_kalkulation numeric, wert_gehalt numeric)
language sql stable security definer set search_path = '' as $$
  with zugang as (
    select (select private.office_controlling_lesen(p_project)) as lesen, (select private.office_is_admin()) as admin
  ), s as (
    select st.id, st.paket_id, st.stichtag, st.leistungsstand, k.kalkulationssatz as paket_satz
    from public.office_controlling_staende st
    join public.office_controlling_pakete k on k.id = st.paket_id
    where k.project_id = p_project and (select lesen from zugang)
  ), h as (
    select st.paket_id, st.stichtag, x.person_id,
           coalesce(x.person_id::text, 'name:' || lower(btrim(x.person_name)), 'team') as pkey, x.stunden
    from public.office_controlling_stunden x join s st on st.id = x.stand_id
  ), pers as (
    select distinct h.paket_id, h.pkey, h.person_id from h
  ), raster as (
    select s.id as sid, s.paket_id as pid, s.stichtag as tag, s.paket_satz, p.pkey, p.person_id,
           coalesce((select h2.stunden from h h2
                     where h2.paket_id = s.paket_id and h2.pkey = p.pkey and h2.stichtag <= s.stichtag
                     order by h2.stichtag desc limit 1), 0) as kum
    from s join pers p on p.paket_id = s.paket_id
  ), zuwachs as (
    select r.*, r.kum - coalesce(lag(r.kum) over (partition by r.pid, r.pkey order by r.tag), 0) as delta
    from raster r
  ), bewertet as (
    select z.sid, z.kum, z.delta,
           coalesce((select sa.kalkulationssatz from public.office_controlling_saetze sa
                     where z.person_id is not null and sa.person_id = z.person_id
                       and sa.kalkulationssatz is not null and sa.gueltig_ab <= z.tag
                     order by sa.gueltig_ab desc limit 1), z.paket_satz) as satz_k,
           (select sa.monatsgehalt * 12 * (1 + e.arbeitgeberanteil_prozent / 100) / e.jahresstunden
              from public.office_controlling_saetze sa cross join public.office_controlling_einstellungen e
             where z.person_id is not null and sa.person_id = z.person_id
               and sa.monatsgehalt is not null and sa.gueltig_ab <= z.tag
             order by sa.gueltig_ab desc limit 1) as satz_g
    from zuwachs z
  ), je_stand as (
    select b.sid, sum(b.kum) as stunden, sum(b.delta * b.satz_k) as wert_k,
           case when bool_and(b.satz_g is not null or b.delta = 0) then sum(b.delta * coalesce(b.satz_g, 0)) end as wert_g
    from bewertet b group by b.sid
  ), laufend as (
    select s.id, s.paket_id, s.stichtag, s.leistungsstand,
           coalesce(j.stunden, 0) as stunden,
           coalesce(sum(j.wert_k) over w, 0) as wert_k,
           bool_and(j.sid is null or j.wert_g is not null) over w as gehalt_vollstaendig,
           sum(j.wert_g) over w as wert_g
    from s left join je_stand j on j.sid = s.id
    window w as (partition by s.paket_id order by s.stichtag)
  )
  select l.id, l.paket_id, l.stichtag, l.leistungsstand, l.stunden, round(l.wert_k, 2),
         case when (select admin from zugang) and l.gehalt_vollstaendig then round(coalesce(l.wert_g, 0), 2) end
  from laufend l
  order by l.paket_id, l.stichtag
$$;
revoke all on function public.office_controlling_summen(uuid) from public, anon;
grant execute on function public.office_controlling_summen(uuid) to authenticated;
