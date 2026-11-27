-- Mitteilungen von Romy auf das iPhone (Push über APNs) · 27.11.2026, Claude, auf Wunsch von Gari.
-- Schreibt Romy von sich aus in den Chat (ihre eigene Nachricht oder ein dringender Hinweis), kommt die Nachricht
-- als Mitteilung auf das iPhone der Person, über die Window-App. Apple sieht nur «Romy · Neue Mitteilung»: der
-- Text reist verschlüsselt (AES-GCM) mit einem Schlüssel, den die App auf dem iPhone erzeugt und nur dem Office
-- gibt; die Mitteilungserweiterung der App entschlüsselt ihn auf dem iPhone.
--   Geräte       office_push_geraete: je iPhone das APNs-Token und sein Schlüssel. Die Person sieht, welche ihrer
--                Geräte angemeldet sind, nie Token oder Schlüssel; geschrieben wird nur über die Funktionen.
--   Mitteilungen office_push_nachrichten: die Warteschlange. Die Person sieht ihre eigenen; schreiben nur der
--                Auslöser, die Testfunktion und der Versand (office-push, mit dem Dienstschlüssel).
--   Auslöser     auf conversation_messages: Romys eigene Nachricht (nicht beim Öffnen der App: da ist die Person
--                schon da) und dringende Hinweise (Route «interrupt»; Ruhezeiten und Unterbrechungsbudget hat die
--                Aufmerksamkeitssteuerung schon angewandt). Nur wenn die Person ein angemeldetes Gerät hat; ein
--                Fehler hier hält Romys Nachricht nie auf.
--   Versand      die Funktion office-push, jede Minute, nur wenn etwas wartet (eigenes Geheimnis, in der Datenbank
--                erzeugt, nie im Repository).
-- Nichts Bestehendes wird verändert oder gelöscht.
begin;

create table public.office_push_geraete (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  geraet_id text not null check (geraet_id ~ '^[A-Za-z0-9-]{8,64}$'),
  apns_token text not null unique check (apns_token ~ '^[0-9a-f]{64,200}$'),
  umgebung text not null check (umgebung in ('production', 'development')),
  bundle_id text not null check (bundle_id ~ '^[A-Za-z0-9.-]{3,155}$'),
  schluessel text not null,
  app_version text check (app_version is null or length(app_version) <= 40),
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index office_push_geraete_user_idx on public.office_push_geraete (user_id) where aktiv;
comment on table public.office_push_geraete is
  'Je iPhone das APNs-Token und der Schlüssel für Romys Mitteilungen. Token und Schlüssel liest nur der Versand.';

create table public.office_push_nachrichten (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  art text not null check (art in ('romy', 'hinweis', 'test')),
  titel text not null check (length(titel) between 1 and 80),
  text text not null check (length(text) between 1 and 600),
  ziel text not null default 'romy' check (ziel ~ '^[a-z]{2,20}$'),
  quelle_id uuid,
  dedupe text not null unique,
  status text not null default 'wartet'
    check (status in ('wartet', 'wird_gesendet', 'gesendet', 'ohne_geraet', 'abgelaufen', 'fehlgeschlagen')),
  versuche integer not null default 0,
  naechster_versuch timestamptz not null default now(),
  lease_bis timestamptz,
  gueltig_bis timestamptz not null,
  gesendet_am timestamptz,
  ergebnis jsonb,
  created_at timestamptz not null default now()
);
create index office_push_nachrichten_faellig_idx on public.office_push_nachrichten (naechster_versuch)
  where status in ('wartet', 'wird_gesendet');
create index office_push_nachrichten_user_idx on public.office_push_nachrichten (user_id, created_at desc);
comment on table public.office_push_nachrichten is
  'Warteschlange der Mitteilungen auf das iPhone: was Romy von sich aus schreibt, dringende Hinweise und Tests.';

-- Rechte: lesen nur die eigenen Zeilen, ohne Token und Schlüssel; schreiben nur über die Funktionen.
alter table public.office_push_geraete enable row level security;
alter table public.office_push_nachrichten enable row level security;
revoke all on public.office_push_geraete, public.office_push_nachrichten from public, anon, authenticated;
grant select (id, user_id, geraet_id, umgebung, app_version, aktiv, created_at, last_seen_at)
  on public.office_push_geraete to authenticated;
grant select (id, user_id, art, titel, text, ziel, status, versuche, gueltig_bis, gesendet_am, created_at)
  on public.office_push_nachrichten to authenticated;
create policy office_push_geraete_eigene on public.office_push_geraete for select to authenticated
  using (user_id = (select auth.uid()) and (select private.office_is_member()));
create policy office_push_nachrichten_eigene on public.office_push_nachrichten for select to authenticated
  using (user_id = (select auth.uid()) and (select private.office_is_member()));

-- Die App meldet ihr iPhone an (bei jedem Start mit Office-Anmeldung, wenn sich etwas geändert hat). Ein Token
-- gehört immer nur einer Person: meldet sich auf demselben iPhone jemand anderes an, wandert es mit.
create or replace function public.office_push_geraet_anmelden(
  p_geraet_id text, p_token text, p_umgebung text, p_bundle_id text, p_schluessel text, p_app_version text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text := lower(btrim(coalesce(p_token, '')));
  v_key bytea;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Nicht angemeldet.' using errcode = '28000'; end if;
  if not private.office_is_member() then raise exception 'Kein aktiver Office-Zugang.' using errcode = '42501'; end if;
  if coalesce(p_geraet_id, '') !~ '^[A-Za-z0-9-]{8,64}$' then
    raise exception 'Unbekanntes Gerät.' using errcode = '22023';
  end if;
  if v_token !~ '^[0-9a-f]{64,200}$' then raise exception 'Ungültiges Mitteilungs-Token.' using errcode = '22023'; end if;
  if coalesce(p_umgebung, '') not in ('production', 'development') then
    raise exception 'Unbekannte Umgebung.' using errcode = '22023';
  end if;
  if coalesce(p_bundle_id, '') !~ '^[A-Za-z0-9.-]{3,155}$' then
    raise exception 'Unbekannte App.' using errcode = '22023';
  end if;
  begin
    v_key := decode(coalesce(p_schluessel, ''), 'base64');
  exception when others then
    v_key := null;
  end;
  if v_key is null or length(v_key) <> 32 then raise exception 'Ungültiger Schlüssel.' using errcode = '22023'; end if;

  insert into public.office_push_geraete as g (user_id, geraet_id, apns_token, umgebung, bundle_id, schluessel, app_version)
  values (v_uid, p_geraet_id, v_token, p_umgebung, p_bundle_id, encode(v_key, 'base64'), left(p_app_version, 40))
  on conflict (apns_token) do update
    set user_id = excluded.user_id, geraet_id = excluded.geraet_id, umgebung = excluded.umgebung,
        bundle_id = excluded.bundle_id, schluessel = excluded.schluessel, app_version = excluded.app_version,
        aktiv = true, updated_at = now(), last_seen_at = now()
  returning g.id into v_id;

  -- Dasselbe iPhone mit einem älteren Token: das alte gilt nicht mehr.
  update public.office_push_geraete set aktiv = false, updated_at = now()
   where user_id = v_uid and geraet_id = p_geraet_id and id <> v_id and aktiv;
  return v_id;
end
$$;

-- Beim Abmelden von Office in der App: keine Mitteilungen mehr auf dieses iPhone.
create or replace function public.office_push_geraet_abmelden(p_geraet_id text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_n integer;
begin
  if v_uid is null then raise exception 'Nicht angemeldet.' using errcode = '28000'; end if;
  update public.office_push_geraete set aktiv = false, updated_at = now()
   where user_id = v_uid and geraet_id = p_geraet_id and aktiv;
  get diagnostics v_n = row_count;
  return v_n;
end
$$;

-- Eine Testmitteilung an die eigenen Geräte (höchstens eine pro Minute).
create or replace function public.office_push_test()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_n integer;
begin
  if v_uid is null then raise exception 'Nicht angemeldet.' using errcode = '28000'; end if;
  if not private.office_is_member() then raise exception 'Kein aktiver Office-Zugang.' using errcode = '42501'; end if;
  if not exists (select 1 from public.office_push_geraete g where g.user_id = v_uid and g.aktiv) then
    return 'kein_geraet';
  end if;
  insert into public.office_push_nachrichten (user_id, art, titel, text, dedupe, gueltig_bis)
  values (v_uid, 'test', 'Romy', 'Testmitteilung: Mitteilungen von Romy kommen auf diesem iPhone an.',
          'test:' || v_uid::text || ':' || to_char(now() at time zone 'UTC', 'YYYYMMDDHH24MI'), now() + interval '30 minutes')
  on conflict (dedupe) do nothing;
  get diagnostics v_n = row_count;
  return case when v_n = 1 then 'wartet' else 'schon_unterwegs' end;
end
$$;

-- Romy schreibt von sich aus in den Chat: die Nachricht geht in die Warteschlange.
create or replace function public.office_push_nach_romy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_art text;
  v_text text;
begin
  begin
    if new.role <> 'assistant' or new.user_id is null then return new; end if;
    if new.metadata->>'source' = 'isabella_presence' then
      -- Beim Öffnen der App ist die Person schon da.
      if coalesce(new.metadata->>'moment', '') = 'app_abierta' then return new; end if;
      v_art := 'romy';
    elsif new.metadata->>'source' = 'attention_runtime'
          and coalesce(new.metadata->>'attention_route', 'interrupt') = 'interrupt' then
      v_art := 'hinweis';
    else
      return new;
    end if;
    if not exists (select 1 from public.office_push_geraete g where g.user_id = new.user_id and g.aktiv) then
      return new;
    end if;
    v_text := btrim(regexp_replace(coalesce(new.content, ''), '\s+', ' ', 'g'));
    if v_text = '' then return new; end if;
    if length(v_text) > 600 then v_text := left(v_text, 599) || '…'; end if;
    insert into public.office_push_nachrichten (user_id, art, titel, text, quelle_id, dedupe, gueltig_bis)
    values (new.user_id, v_art, 'Romy', v_text, new.id, 'nachricht:' || new.id::text,
            now() + case when v_art = 'hinweis' then interval '3 hours' else interval '12 hours' end)
    on conflict (dedupe) do nothing;
  exception when others then
    -- Eine Mitteilung darf Romys Nachricht nie aufhalten.
    raise warning 'office_push_nach_romy: %', sqlerrm;
  end;
  return new;
end
$$;

create trigger office_push_nach_romy
  after insert on public.conversation_messages
  for each row
  when (new.role = 'assistant' and new.metadata->>'source' in ('isabella_presence', 'attention_runtime'))
  execute function public.office_push_nach_romy();

-- Der Versand holt fällige Mitteilungen (auch solche, deren Versand hängen blieb) und reserviert sie zwei Minuten.
-- Abgelaufenes wird nicht mehr geschickt. Nur mit dem Dienstschlüssel.
create or replace function public.office_push_holen(p_limit integer default 20)
returns setof public.office_push_nachrichten
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.office_push_nachrichten set status = 'abgelaufen', lease_bis = null
   where status in ('wartet', 'wird_gesendet') and gueltig_bis < now();
  return query
  with geholt as (
    update public.office_push_nachrichten n
       set status = 'wird_gesendet', versuche = n.versuche + 1, lease_bis = now() + interval '2 minutes'
     where n.id in (
       select m.id from public.office_push_nachrichten m
        where (m.status = 'wartet' and m.naechster_versuch <= now())
           or (m.status = 'wird_gesendet' and m.lease_bis < now())
        order by m.created_at
        limit greatest(1, least(coalesce(p_limit, 20), 50))
        for update skip locked)
    returning n.*)
  select * from geholt;
end
$$;

revoke all on function public.office_push_geraet_anmelden(text, text, text, text, text, text) from public, anon;
revoke all on function public.office_push_geraet_abmelden(text) from public, anon;
revoke all on function public.office_push_test() from public, anon;
grant execute on function public.office_push_geraet_anmelden(text, text, text, text, text, text) to authenticated;
grant execute on function public.office_push_geraet_abmelden(text) to authenticated;
grant execute on function public.office_push_test() to authenticated;
revoke all on function public.office_push_nach_romy() from public, anon, authenticated;
revoke all on function public.office_push_holen(integer) from public, anon, authenticated;
grant execute on function public.office_push_holen(integer) to service_role;

-- Das Geheimnis des Versands, in der Datenbank erzeugt (nie im Repository oder im Chat); nur ein leerer Wert wird gefüllt.
insert into public.isabella_runtime_secrets (key, value) values ('office_push', '') on conflict (key) do nothing;
update public.isabella_runtime_secrets
   set value = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
 where key = 'office_push' and length(value) = 0;

-- Jede Minute, aber nur wenn etwas fällig ist: sonst ruft niemand die Funktion. Wie die Romy-Runner nur dort, wo
-- pg_cron und pg_net bestehen (Office-Supabase), und nie doppelt.
do $zeitplan$
begin
  if to_regclass('cron.job') is null
     or to_regprocedure('cron.schedule(text,text,text)') is null
     or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return;
  end if;
  if not exists (select 1 from cron.job where jobname = 'office_push_v1') then
    perform cron.schedule('office_push_v1', '* * * * *', $job$select net.http_post(
          url:='https://ynzsbemisjvfgbqcqliq.supabase.co/functions/v1/office-push',
          headers:='{"Content-Type":"application/json"}'::jsonb,
          body:=jsonb_build_object('secret',s.value),
          timeout_milliseconds:=30000)
        from public.isabella_runtime_secrets s
        where s.key='office_push' and length(s.value)>0
          and exists (select 1 from public.office_push_nachrichten n
                       where (n.status='wartet' and n.naechster_versuch<=now())
                          or (n.status='wird_gesendet' and n.lease_bis<now()))$job$);
  end if;
end
$zeitplan$;

commit;
