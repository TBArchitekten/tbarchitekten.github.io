-- TBA Office · Controlling: Sätze, Gehälter und Stunden je Person nur für die Liste (25.11.2026, Claude; Wunsch von
-- Gari am 25.11.2026).
--
-- Gari: Sätze und Gehälter sehen nur er und die Buchhaltung; der Chef kommt dazu, sobald er im Office ist. Bisher hatte
-- jeder Admin vollen Zugang, und wer später Admin würde, sähe die Gehälter von selbst. Jetzt zählt nur die Liste
-- office_controlling_zugang.
--
-- 1. Wer heute aktiver Admin ist, kommt auf die Liste: an seinem Zugang ändert sich heute nichts.
-- 2. private.office_controlling_voll(): nur noch die Liste.
-- 3. Einschränkende Policies (AND mit den bisherigen): Sätze mit den Gehältern, Stunden je Person und die Annahmen nur
--    mit vollem Zugang, auch für Admins; die Liste ändern nur Admins, die selbst darauf stehen (ein Admin setzt sich
--    nicht selbst darauf).
-- Pakete, Stände und Zahlungen bleiben, wie sie sind: lesen das Projektteam und die Liste, schreiben Admins und die Liste.
--
-- Nichts Destruktives: Zeilen nur in office_controlling_zugang, eine Funktion mit neuem Körper bei gleicher Signatur,
-- neue Policies; keine Policy wird entfernt.

insert into public.office_controlling_zugang (user_id, created_by)
select m.user_id, m.user_id from public.office_members m where m.role = 'admin' and m.is_active
on conflict (user_id) do nothing;

create or replace function private.office_controlling_voll() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.office_controlling_zugang z
                 join public.office_members m on m.user_id = z.user_id
                 where z.user_id = (select auth.uid()) and m.is_active)
$$;
revoke all on function private.office_controlling_voll() from public, anon;
grant execute on function private.office_controlling_voll() to authenticated;

create policy office_controlling_saetze_nur_liste on public.office_controlling_saetze
  as restrictive for all to authenticated
  using ((select private.office_controlling_voll())) with check ((select private.office_controlling_voll()));
create policy office_controlling_stunden_nur_liste on public.office_controlling_stunden
  as restrictive for all to authenticated
  using ((select private.office_controlling_voll())) with check ((select private.office_controlling_voll()));
create policy office_controlling_einstellungen_nur_liste on public.office_controlling_einstellungen
  as restrictive for all to authenticated
  using ((select private.office_controlling_voll())) with check ((select private.office_controlling_voll()));
create policy office_controlling_zugang_nur_liste_vergeben on public.office_controlling_zugang
  as restrictive for insert to authenticated with check ((select private.office_controlling_voll()));
create policy office_controlling_zugang_nur_liste_entziehen on public.office_controlling_zugang
  as restrictive for delete to authenticated using ((select private.office_controlling_voll()));
