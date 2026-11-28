-- Mitteilungen tragen den Namen, den jede Person ihrem Assistenten gibt (28.11.2026, Gari: «a todos por default
-- KI-Assistent y que cada quien pueda escoger el suyo»). Der Name steht in den eigenen Einstellungen der Person
-- (isabella_preferences, assistant_name, Feld name); fehlt er oder passt er nicht, heißt der Assistent «KI-Assistent».
-- Erlaubt ist, was auch der Motor annimmt: ein Buchstabe am Anfang, danach Buchstaben, Ziffern, Leerzeichen, Punkt,
-- Apostroph oder Bindestrich, höchstens 40 Zeichen. Der Titel reist verschlüsselt (office-push); Apple sieht
-- «TBA Office · Neue Mitteilung», ohne Namen. Die Testmitteilung duzt.
-- Ändert nur die beiden Funktionen, die eine Mitteilung anlegen, und legt eine Hilfsfunktion an; Tabellen, Rechte,
-- Auslöser und Zeitplan bleiben, wie sie sind.

create or replace function private.office_assistent_name(p_user uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select x.n from (
      select btrim(regexp_replace(normalize(p.value->>'name', nfc), '\s+', ' ', 'g')) as n
      from public.isabella_preferences p
      where p.user_id = p_user and p.preference_key = 'assistant_name'
    ) x
    where length(x.n) between 1 and 40 and x.n ~ '^[[:alpha:]][[:alpha:][:digit:]'' .-]*$'
  ), 'KI-Assistent')
$$;
comment on function private.office_assistent_name(uuid) is
  'Der Name, den die Person ihrem Assistenten gegeben hat (isabella_preferences, assistant_name), sonst «KI-Assistent».';
revoke all on function private.office_assistent_name(uuid) from public, anon, authenticated;

-- Eine Testmitteilung an die eigenen Geräte (höchstens eine pro Minute), mit dem eigenen Namen des Assistenten.
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
  values (v_uid, 'test', private.office_assistent_name(v_uid),
          'Testmitteilung: Die Mitteilungen deines Assistenten kommen auf diesem iPhone an.',
          'test:' || v_uid::text || ':' || to_char(now() at time zone 'UTC', 'YYYYMMDDHH24MI'), now() + interval '30 minutes')
  on conflict (dedupe) do nothing;
  get diagnostics v_n = row_count;
  return case when v_n = 1 then 'wartet' else 'schon_unterwegs' end;
end
$$;

-- Der Assistent schreibt von sich aus in den Chat: die Nachricht geht in die Warteschlange, mit seinem Namen.
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
    values (new.user_id, v_art, private.office_assistent_name(new.user_id), v_text, new.id, 'nachricht:' || new.id::text,
            now() + case when v_art = 'hinweis' then interval '3 hours' else interval '12 hours' end)
    on conflict (dedupe) do nothing;
  exception when others then
    -- Eine Mitteilung darf die Nachricht des Assistenten nie aufhalten.
    raise warning 'office_push_nach_romy: %', sqlerrm;
  end;
  return new;
end
$$;
