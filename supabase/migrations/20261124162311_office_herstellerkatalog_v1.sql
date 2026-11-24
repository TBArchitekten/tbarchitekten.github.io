-- TBA Office · Herstellerkatalog (24.11.2026, Claude; Wunsch von Gari am 24.11.2026).
--
-- Gari: Das Büro hat keinen Herstellerkatalog, und man fragt sich immer gegenseitig nach den Kontakten. Der Katalog
-- bekommt eine eigene Seite wie die Produktbibliothek; jede Produktkarte zeigt den Kontakt ihres Herstellers. Je Firma:
-- Firma, Produkt, Typ (optional), Kontakt und die Projekte, in denen jemand aus dem Büro Kontakt hatte, damit man zuerst
-- mit der Kollegin oder dem Kollegen sprechen kann, die ihn schon hatten.
--
-- office_hersteller            eine Firma: Hersteller, Systemhersteller, Ausführender, Vertrieb oder Verband, mit dem,
--                              was sie anbietet, Adresse, Telefon, E-Mail, Website und Ansprechpartnern.
-- office_hersteller_kontakte   ein Kontakt in einem Projekt: wer im Büro, wann, welche Art (Recherche, Anfrage,
--                              Unterlagen, Muster, Angebot, Beratung, Auftrag) und eine Notiz.
-- office_produkte.hersteller_id  die Firma eines Produkts der Bibliothek (das Textfeld «hersteller» bleibt).
-- office_import_tokens         einmalige Schlüssel für die Edge Function office-produkt-import, mit der Claude Unterlagen
--                              in die Bibliothek legt, die Gari ihm gibt. Gespeichert wird nur der SHA-256 des
--                              Schlüssels mit Ablaufzeit; lesen kann die Tabelle nur der Server.
--
-- Wer was darf: Der Katalog gehört dem Office (wie die Bibliothek). Jedes aktive Mitglied liest alles, legt Firmen an
-- und verbessert sie; gelöscht wird keine Firma, nur archiviert. Einen Kontakt trägt jedes Mitglied ein; ändern oder
-- entfernen, wer ihn eingetragen hat, oder ein Admin.
-- Nichts Destruktives; nur neue Tabellen, eine neue Spalte, Trigger und Policies.

create table public.office_hersteller (
  id uuid primary key default gen_random_uuid(),
  firma text not null check (char_length(btrim(firma)) between 1 and 200),
  typ text check (typ is null or typ in ('hersteller','systemhersteller','ausfuehrender','vertrieb','verband')),
  produkte text check (produkte is null or char_length(produkte) <= 1000),
  kategorien text[] not null default '{}'::text[]
    check (kategorien <@ array['bodenbelag','wandbelag','decke','fassade','fenster_tueren','sanitaer','licht','beschlaege','sonstiges']::text[]),
  adresse text check (adresse is null or char_length(adresse) <= 300),
  telefon text check (telefon is null or char_length(telefon) <= 300),
  email text check (email is null or char_length(email) <= 300),
  website text check (website is null or (website ~ '^https://' and char_length(website) <= 300)),
  ansprechpartner text check (ansprechpartner is null or char_length(ansprechpartner) <= 600),
  notiz text check (notiz is null or char_length(notiz) <= 2000),
  archiviert boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Eine Firma steht nur einmal im Katalog (Groß- und Kleinschreibung egal), archivierte ausgenommen.
create unique index office_hersteller_firma_key on public.office_hersteller (lower(btrim(firma))) where not archiviert;

create table public.office_hersteller_kontakte (
  id uuid primary key default gen_random_uuid(),
  hersteller_id uuid not null references public.office_hersteller(id) on delete cascade,
  projekt_id uuid references public.office_projects(id) on delete set null,
  projekt_bezeichnung text check (projekt_bezeichnung is null or char_length(projekt_bezeichnung) <= 160),
  person_id uuid references auth.users(id) on delete set null,
  art text not null check (art in ('recherche','anfrage','unterlagen','muster','angebot','beratung','auftrag')),
  datum date,
  notiz text check (notiz is null or char_length(notiz) <= 1000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint office_hersteller_kontakte_projekt_check check (projekt_id is not null or projekt_bezeichnung is not null)
);
create index office_hersteller_kontakte_hersteller_idx on public.office_hersteller_kontakte(hersteller_id, datum desc);
create index office_hersteller_kontakte_projekt_idx on public.office_hersteller_kontakte(projekt_id);

alter table public.office_produkte add column hersteller_id uuid references public.office_hersteller(id) on delete set null;
create index office_produkte_hersteller_idx on public.office_produkte(hersteller_id);

create table public.office_import_tokens (
  id uuid primary key default gen_random_uuid(),
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  zweck text not null check (char_length(btrim(zweck)) between 1 and 200),
  gueltig_bis timestamptz not null,
  created_at timestamptz not null default now()
);

-- Wer etwas angelegt hat, bleibt unverändert; ein Kontakt bleibt an seiner Firma.
create function private.office_hersteller_fest() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Wer einen Eintrag angelegt hat, bleibt unverändert.' using errcode = '23514';
  end if;
  if tg_table_name = 'office_hersteller_kontakte' then
    if new.hersteller_id is distinct from old.hersteller_id then
      raise exception 'Ein Kontakt bleibt an seiner Firma.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.office_hersteller_fest() from public, anon, authenticated;

create trigger office_hersteller_fest before update on public.office_hersteller
  for each row execute function private.office_hersteller_fest();
create trigger office_hersteller_touch before update on public.office_hersteller
  for each row execute function public.office_touch_updated_at();
create trigger office_hersteller_kontakte_fest before update on public.office_hersteller_kontakte
  for each row execute function private.office_hersteller_fest();

alter table public.office_hersteller enable row level security;
alter table public.office_hersteller_kontakte enable row level security;
alter table public.office_import_tokens enable row level security;
revoke all on public.office_hersteller, public.office_hersteller_kontakte, public.office_import_tokens
  from public, anon, authenticated;
grant select, insert, update on public.office_hersteller to authenticated;
grant select, insert, update, delete on public.office_hersteller_kontakte to authenticated;
-- office_import_tokens: keine Rechte für anon und authenticated, keine Policy; nur der Server (service_role) liest.

-- Katalog: lesen, anlegen und verbessern jedes aktive Mitglied; kein Löschen, nur archivieren.
create policy office_hersteller_lesen on public.office_hersteller
  for select to authenticated using ((select private.office_is_member()));
create policy office_hersteller_anlegen on public.office_hersteller
  for insert to authenticated
  with check ((select private.office_is_member()) and created_by = (select auth.uid()));
create policy office_hersteller_aendern on public.office_hersteller
  for update to authenticated
  using ((select private.office_is_member())) with check ((select private.office_is_member()));

-- Kontakte: lesen jedes Mitglied; eintragen jedes Mitglied; ändern und entfernen, wer ihn eingetragen hat, oder ein Admin.
create policy office_hersteller_kontakte_lesen on public.office_hersteller_kontakte
  for select to authenticated using ((select private.office_is_member()));
create policy office_hersteller_kontakte_anlegen on public.office_hersteller_kontakte
  for insert to authenticated
  with check ((select private.office_is_member()) and created_by = (select auth.uid()));
create policy office_hersteller_kontakte_aendern on public.office_hersteller_kontakte
  for update to authenticated
  using ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_is_admin())))
  with check ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_is_admin())));
create policy office_hersteller_kontakte_entfernen on public.office_hersteller_kontakte
  for delete to authenticated
  using ((select private.office_is_member()) and (created_by = (select auth.uid()) or (select private.office_is_admin())));
