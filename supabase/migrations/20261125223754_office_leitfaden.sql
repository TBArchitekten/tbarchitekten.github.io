-- TBA Office · Leitfaden «Was darf auf den Desktop?» mit Bestätigung «Gelesen» (25.11.2026, Claude; Wunsch von Gari
-- am 25.11.2026).
--
-- Gari: Wer ins Office kommt, bekommt den Leitfaden beim ersten Öffnen zu lesen und bestätigt mit «Gelesen». So steht
-- fest, dass alle im Büro die Regeln kennen, ohne eigene Einweisung (das Büro ist klein, Gari bespricht ihn ohnehin mit
-- allen, die er aufnimmt).
--
-- office_leitfaeden                je Leitfaden eine Zeile: der geltende Stand (version) und ob das Office ihn zeigt
--                                  (aktiv). Lesen alle Mitglieder; freischalten und ausschalten nur Admins, und nur
--                                  aktiv: den Stand ändert eine Migration, zusammen mit dem Text im Office. Wer zuletzt
--                                  geändert hat und wann, setzt die Datenbank.
-- office_leitfaden_bestaetigungen  wer welchen Stand wann bestätigt hat. Jede Person bestätigt nur für sich und nur den
--                                  geltenden Stand eines freigeschalteten Leitfadens; die Zeit setzt die Datenbank.
--                                  Lesen die Person selbst und die Admins. Ändern und löschen niemand: es ist der Beleg.
--
-- Der Leitfaden «desktop» beginnt ausgeschaltet: Gari schaltet ihn in «Mitglieder» frei, wenn die Büroleitung
-- zugestimmt hat und die Konten auf das Büro laufen. Ändert sich der Text, bekommt er einen neuen Stand, und alle
-- bestätigen ihn noch einmal.
--
-- Nichts Destruktives: zwei neue Tabellen mit Policies, eine Triggerfunktion und eine Zeile.

create table public.office_leitfaeden (
  leitfaden text primary key check (leitfaden in ('desktop')),
  version text not null check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  aktiv boolean not null default false,
  geaendert_am timestamptz not null default now(),
  geaendert_von uuid references auth.users(id) on delete set null
);
alter table public.office_leitfaeden enable row level security;
revoke all on public.office_leitfaeden from public, anon, authenticated;
grant select on public.office_leitfaeden to authenticated;
-- Nur «aktiv»: den Stand ändert eine Migration.
grant update (aktiv) on public.office_leitfaeden to authenticated;
create policy office_leitfaeden_lesen on public.office_leitfaeden
  for select to authenticated using ((select private.office_is_member()));
create policy office_leitfaeden_freischalten on public.office_leitfaeden
  for update to authenticated using ((select private.office_is_admin())) with check ((select private.office_is_admin()));

create function private.office_leitfaeden_geaendert() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.geaendert_am := now();
  new.geaendert_von := (select auth.uid());
  return new;
end
$$;
revoke all on function private.office_leitfaeden_geaendert() from public, anon, authenticated;
create trigger office_leitfaeden_geaendert before update on public.office_leitfaeden
  for each row execute function private.office_leitfaeden_geaendert();

create table public.office_leitfaden_bestaetigungen (
  user_id uuid not null references public.office_members(user_id) on delete cascade,
  leitfaden text not null references public.office_leitfaeden(leitfaden),
  version text not null,
  bestaetigt_am timestamptz not null default now(),
  primary key (user_id, leitfaden, version)
);
alter table public.office_leitfaden_bestaetigungen enable row level security;
revoke all on public.office_leitfaden_bestaetigungen from public, anon, authenticated;
grant select on public.office_leitfaden_bestaetigungen to authenticated;
-- Nur diese drei Spalten: die Zeit der Bestätigung setzt die Datenbank.
grant insert (user_id, leitfaden, version) on public.office_leitfaden_bestaetigungen to authenticated;
create policy office_leitfaden_bestaetigungen_lesen on public.office_leitfaden_bestaetigungen
  for select to authenticated using (user_id = (select auth.uid()) or (select private.office_is_admin()));
create policy office_leitfaden_bestaetigungen_bestaetigen on public.office_leitfaden_bestaetigungen
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (select private.office_is_member())
    and exists (select 1 from public.office_leitfaeden l
                 where l.leitfaden = office_leitfaden_bestaetigungen.leitfaden
                   and l.version = office_leitfaden_bestaetigungen.version
                   and l.aktiv));

insert into public.office_leitfaeden (leitfaden, version, aktiv) values ('desktop', '2026-11-25', false);
