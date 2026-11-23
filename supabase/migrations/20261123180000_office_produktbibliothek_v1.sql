-- TBA Office · Produktbibliothek, Phase 1 (23.11.2026, Claude; Entwurf von Gari am 23.11.2026 freigegeben).
--
-- Gari wünschte eine Produktbibliothek wie bei Programa, aber für Materialien (zuerst Bodenbeläge): Preise aus
-- Herstellerunterlagen, verknüpft mit Kostenberechnung und Projekten. Diese Migration legt die Daten an:
--
-- office_produkte              ein Eintrag der Bibliothek: ein Produkt eines Herstellers oder eine Leistung ohne
--                              Produkt (z. B. Heizestrich). «familie» ist das Element der Kostenberechnung, zu dem
--                              der Eintrag gehört (z. B. «Parkett, vollflächig geklebt»); so teilen Produkte einer
--                              Familie die Preise der alten Kostenberechnungen. Merkmale tragen die Seite im
--                              Datenblatt; was das Datenblatt nicht nennt, steht unter «fehlend» und wird nicht geraten.
-- office_produkt_dokumente     Datenblatt, Preisliste, Verlegeanleitung usw. im privaten Bucket «office-produkte».
-- office_produkt_preise        jeder Preis mit Art (Listenpreis, Angebot, Ansatz einer Kostenberechnung,
--                              Abrechnung), Stand, Quelle, Projekt und Menge. Ein Listenpreis ist kein eingebauter Preis.
-- office_produkt_verwendungen  ein Eintrag in einem Projekt: Code (z. B. BO-01), Stand der Bemusterung, Räume, Menge.
-- office_produkt_ai_requests   jede Anfrage an den Datenblatt-Leser wird gezählt; ein Tageslimit gibt es nicht.
--
-- Wer was darf: Die Bibliothek gehört dem Office. Jedes aktive Mitglied liest alles und kann Einträge anlegen und
-- verbessern (wie ein gemeinsamer Katalog); gelöscht wird kein Eintrag, nur archiviert. Dokumente und Preise ändert
-- oder entfernt, wer sie angelegt hat, oder ein Admin. Die Verwendung in einem Projekt sieht das ganze Office (wie
-- die Kostenberechnung); ändern kann sie das Projektteam und die Projektleitung.
-- Nichts Destruktives; nur neue Tabellen, Funktionen und Policies.

create table public.office_produkte (
  id uuid primary key default gen_random_uuid(),
  typ text not null default 'produkt' check (typ in ('produkt','leistung')),
  kategorie text not null check (kategorie in ('bodenbelag','wandbelag','decke','fassade','fenster_tueren','sanitaer','beschlaege','sonstiges')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  hersteller text check (hersteller is null or char_length(hersteller) <= 160),
  serie text check (serie is null or char_length(serie) <= 160),
  familie text check (familie is null or char_length(familie) <= 160),
  beschreibung text check (beschreibung is null or char_length(beschreibung) <= 4000),
  merkmale jsonb not null default '[]'::jsonb check (jsonb_typeof(merkmale) = 'array' and pg_column_size(merkmale) <= 32000),
  fehlend jsonb not null default '[]'::jsonb check (jsonb_typeof(fehlend) = 'array' and pg_column_size(fehlend) <= 4000),
  farbe text check (farbe is null or farbe ~ '^#[0-9a-fA-F]{6}$'),
  quelle_url text check (quelle_url is null or (quelle_url ~ '^https://' and char_length(quelle_url) <= 600)),
  bestand boolean not null default false,
  status text not null default 'entwurf' check (status in ('entwurf','geprueft')),
  geprueft_von uuid references auth.users(id) on delete set null,
  geprueft_am timestamptz,
  archiviert boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index office_produkte_kategorie_idx on public.office_produkte(kategorie, archiviert);
create index office_produkte_familie_idx on public.office_produkte(familie) where familie is not null;
comment on table public.office_produkte is
  'Produktbibliothek des Office: Produkte und Leistungen mit Merkmalen aus dem Datenblatt (mit Seite); liest jedes Mitglied.';

create table public.office_produkt_dokumente (
  id uuid primary key default gen_random_uuid(),
  produkt_id uuid not null references public.office_produkte(id) on delete cascade,
  art text not null check (art in ('datenblatt','preisliste','verlegeanleitung','pflegeanleitung','leistungserklaerung','epd','zertifikat','bild','sonstiges')),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  storage_path text not null unique check (char_length(storage_path) between 75 and 400),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  seiten integer check (seiten is null or seiten between 1 and 2000),
  gelesen_am timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index office_produkt_dokumente_produkt_idx on public.office_produkt_dokumente(produkt_id);

create table public.office_produkt_preise (
  id uuid primary key default gen_random_uuid(),
  produkt_id uuid not null references public.office_produkte(id) on delete cascade,
  art text not null check (art in ('listenpreis_material','angebot_material','angebot_eingebaut','ansatz_kobe','abrechnung')),
  betrag numeric(14,2) not null check (betrag >= 0),
  einheit text not null check (einheit in ('m²','m','m³','St','psch','kg','t','h')),
  stand date,
  quelle text check (quelle is null or char_length(quelle) <= 300),
  dokument_id uuid references public.office_produkt_dokumente(id) on delete set null,
  seite integer check (seite is null or seite between 1 and 2000),
  projekt_id uuid references public.office_projects(id) on delete set null,
  projekt_bezeichnung text check (projekt_bezeichnung is null or char_length(projekt_bezeichnung) <= 160),
  kg text check (kg is null or kg ~ '^[1-8][0-9][0-9]$'),
  gewerk text check (gewerk is null or char_length(gewerk) <= 12),
  menge numeric(14,3) check (menge is null or menge >= 0),
  kommentar text check (kommentar is null or char_length(kommentar) <= 1000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index office_produkt_preise_produkt_idx on public.office_produkt_preise(produkt_id);
create index office_produkt_preise_projekt_idx on public.office_produkt_preise(projekt_id) where projekt_id is not null;

create table public.office_produkt_verwendungen (
  id uuid primary key default gen_random_uuid(),
  produkt_id uuid not null references public.office_produkte(id) on delete cascade,
  projekt_id uuid not null references public.office_projects(id) on delete cascade,
  code text check (code is null or code ~ '^[A-Z]{1,4}-[0-9]{1,3}$'),
  status text not null default 'vorgeschlagen'
    check (status in ('vorgeschlagen','bemustert','freigegeben','ausgeschrieben','beauftragt','verworfen')),
  raeume text check (raeume is null or char_length(raeume) <= 400),
  menge numeric(14,2) check (menge is null or menge >= 0),
  einheit text check (einheit is null or einheit in ('m²','m','m³','St','psch','kg','t','h')),
  notiz text check (notiz is null or char_length(notiz) <= 1000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (projekt_id, code)
);
create index office_produkt_verwendungen_produkt_idx on public.office_produkt_verwendungen(produkt_id);

create table public.office_produkt_ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index office_produkt_ai_requests_user_idx on public.office_produkt_ai_requests(user_id, created_at desc);

-- Wer etwas angelegt hat, bleibt unverändert; ein Dokument bleibt an seinem Eintrag und Pfad, eine Verwendung an ihrem
-- Projekt. «Geprüft» stempelt die Datenbank selbst mit Person und Zeit.
create function private.office_produkt_fest() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  -- Jede Tabelle für sich (verschachtelt): PL/pgSQL kennt nur die Felder der Tabelle, die den Trigger auslöst.
  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'Wer einen Eintrag angelegt hat, bleibt unverändert.' using errcode = '23514';
    end if;
    if tg_table_name = 'office_produkt_dokumente' then
      if new.produkt_id is distinct from old.produkt_id or new.storage_path is distinct from old.storage_path
         or new.size_bytes is distinct from old.size_bytes or new.mime_type is distinct from old.mime_type then
        raise exception 'Ein Dokument bleibt an seinem Eintrag.' using errcode = '23514';
      end if;
    elsif tg_table_name = 'office_produkt_preise' then
      if new.produkt_id is distinct from old.produkt_id then
        raise exception 'Ein Preis bleibt an seinem Eintrag.' using errcode = '23514';
      end if;
    elsif tg_table_name = 'office_produkt_verwendungen' then
      if new.projekt_id is distinct from old.projekt_id or new.produkt_id is distinct from old.produkt_id then
        raise exception 'Eine Verwendung bleibt an ihrem Projekt.' using errcode = '23514';
      end if;
    end if;
  end if;
  if tg_table_name = 'office_produkte' then
    if new.status = 'geprueft' and (tg_op = 'INSERT' or old.status is distinct from 'geprueft') then
      new.geprueft_von := (select auth.uid());
      new.geprueft_am := now();
    elsif new.status = 'entwurf' then
      new.geprueft_von := null;
      new.geprueft_am := null;
    elsif tg_op = 'UPDATE' then
      new.geprueft_von := old.geprueft_von;
      new.geprueft_am := old.geprueft_am;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.office_produkt_fest() from public, anon, authenticated;

create trigger office_produkte_fest before insert or update on public.office_produkte
  for each row execute function private.office_produkt_fest();
create trigger office_produkte_touch before update on public.office_produkte
  for each row execute function public.office_touch_updated_at();
create trigger office_produkt_dokumente_fest before update on public.office_produkt_dokumente
  for each row execute function private.office_produkt_fest();
create trigger office_produkt_preise_fest before update on public.office_produkt_preise
  for each row execute function private.office_produkt_fest();
create trigger office_produkt_verwendungen_fest before update on public.office_produkt_verwendungen
  for each row execute function private.office_produkt_fest();
create trigger office_produkt_verwendungen_touch before update on public.office_produkt_verwendungen
  for each row execute function public.office_touch_updated_at();

alter table public.office_produkte enable row level security;
alter table public.office_produkt_dokumente enable row level security;
alter table public.office_produkt_preise enable row level security;
alter table public.office_produkt_verwendungen enable row level security;
alter table public.office_produkt_ai_requests enable row level security;
revoke all on public.office_produkte, public.office_produkt_dokumente, public.office_produkt_preise,
  public.office_produkt_verwendungen, public.office_produkt_ai_requests from public, anon, authenticated;
grant select, insert, update on public.office_produkte to authenticated;
grant select, insert, update, delete on public.office_produkt_dokumente to authenticated;
grant select, insert, update, delete on public.office_produkt_preise to authenticated;
grant select, insert, update, delete on public.office_produkt_verwendungen to authenticated;
grant select, insert on public.office_produkt_ai_requests to authenticated;

-- Bibliothek: lesen, anlegen und verbessern jedes aktive Mitglied; kein Löschen, nur archivieren.
create policy office_produkte_lesen on public.office_produkte
  for select to authenticated using ((select private.office_is_member()));
create policy office_produkte_anlegen on public.office_produkte
  for insert to authenticated
  with check ((select private.office_is_member()) and created_by = (select auth.uid()));
create policy office_produkte_aendern on public.office_produkte
  for update to authenticated
  using ((select private.office_is_member())) with check ((select private.office_is_member()));

-- Dokumente: lesen jedes Mitglied; hochladen jedes Mitglied unter seinem eigenen Pfad
-- (<Person>/<Eintrag>/<Datei>); ändern und entfernen, wer es hochgeladen hat, oder ein Admin.
create policy office_produkt_dokumente_lesen on public.office_produkt_dokumente
  for select to authenticated using ((select private.office_is_member()));
create policy office_produkt_dokumente_anlegen on public.office_produkt_dokumente
  for insert to authenticated
  with check ((select private.office_is_member()) and created_by = (select auth.uid())
              and split_part(storage_path, '/', 1) = (select auth.uid())::text
              and split_part(storage_path, '/', 2) = produkt_id::text);
create policy office_produkt_dokumente_aendern on public.office_produkt_dokumente
  for update to authenticated
  using ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_is_admin())))
  with check ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_is_admin())));
create policy office_produkt_dokumente_entfernen on public.office_produkt_dokumente
  for delete to authenticated
  using ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_is_admin())));

-- Preise: lesen jedes Mitglied; eintragen jedes Mitglied; ändern und entfernen, wer ihn eingetragen hat, oder ein Admin.
create policy office_produkt_preise_lesen on public.office_produkt_preise
  for select to authenticated using ((select private.office_is_member()));
create policy office_produkt_preise_anlegen on public.office_produkt_preise
  for insert to authenticated
  with check ((select private.office_is_member()) and created_by = (select auth.uid()));
create policy office_produkt_preise_aendern on public.office_produkt_preise
  for update to authenticated
  using ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_is_admin())))
  with check ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_is_admin())));
create policy office_produkt_preise_entfernen on public.office_produkt_preise
  for delete to authenticated
  using ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_is_admin())));

-- Verwendung im Projekt: sieht das ganze Office (wie die Kostenberechnung); ändern das Projektteam und die Projektleitung.
create policy office_produkt_verwendungen_lesen on public.office_produkt_verwendungen
  for select to authenticated using ((select private.office_is_member()));
create policy office_produkt_verwendungen_anlegen on public.office_produkt_verwendungen
  for insert to authenticated
  with check ((select private.office_is_member()) and created_by = (select auth.uid())
              and ((select private.office_project_team_has_access(projekt_id)) or (select private.office_leads_project(projekt_id))));
create policy office_produkt_verwendungen_aendern on public.office_produkt_verwendungen
  for update to authenticated
  using ((select private.office_is_member())
         and ((select private.office_project_team_has_access(projekt_id)) or (select private.office_leads_project(projekt_id))))
  with check ((select private.office_is_member())
              and ((select private.office_project_team_has_access(projekt_id)) or (select private.office_leads_project(projekt_id))));
create policy office_produkt_verwendungen_entfernen on public.office_produkt_verwendungen
  for delete to authenticated
  using ((select private.office_is_member())
         and ((select private.office_project_team_has_access(projekt_id)) or (select private.office_leads_project(projekt_id))));

create policy office_produkt_ai_requests_selbst_lesen on public.office_produkt_ai_requests
  for select to authenticated using (user_id = (select auth.uid()));
create policy office_produkt_ai_requests_selbst_anlegen on public.office_produkt_ai_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.office_is_member()));

-- Jede Anfrage an den Datenblatt-Leser wird vor dem bezahlten Modellaufruf gezählt (wie bei Terminplan und Kosten).
create function public.office_produkt_ai_consume_request() returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not (select private.office_is_member()) then
    return false;
  end if;
  insert into public.office_produkt_ai_requests(user_id) values (uid);
  return true;
end;
$$;
revoke all on function public.office_produkt_ai_consume_request() from public, anon;
grant execute on function public.office_produkt_ai_consume_request() to authenticated;

-- Dateien der Bibliothek: privater Bucket. Lesen jedes Mitglied; hochladen nur unter dem eigenen Pfad und zu einem
-- Eintrag, den es gibt; entfernen, wer hochgeladen hat, oder ein Admin. Kein Überschreiben.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('office-produkte', 'office-produkte', false, 26214400,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy office_produkte_dateien_lesen on storage.objects for select to authenticated
  using (bucket_id = 'office-produkte' and (select private.office_is_member()));
create policy office_produkte_dateien_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'office-produkte' and (select private.office_is_member())
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and exists (select 1 from public.office_produkte p where p.id::text = (storage.foldername(name))[2]));
create policy office_produkte_dateien_entfernen on storage.objects for delete to authenticated
  using (bucket_id = 'office-produkte' and (select private.office_is_member())
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.office_is_admin())));
