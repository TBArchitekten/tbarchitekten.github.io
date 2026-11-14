-- Ein Hinweis trägt seinen Titel (14.11.2026, Gari). Erfundene Person, nur auf einer flüchtigen
-- PostgreSQL-Instanz, alles wird zurückgerollt. Kein echter Termin, kein echtes Projekt.
--
-- Gari las im Gespräch mit Romy «Beginnt um 14:00.» und erfuhr nicht, was beginnt. Der Heartbeat
-- baut den Hinweis aus title und body; minds_publish_attention schrieb nur den body.
-- Geprüft wird:
--  * title und body stehen zusammen in der Nachricht;
--  * ein Titel, der schon im body steckt (watch_fired schreibt beide gleich), wird nicht doppelt;
--  * fehlt eines der beiden Felder, steht das andere allein da;
--  * die Rückgabe und der Zustand des Ereignisses bleiben wie zuvor.
begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,created_at,updated_at)
values ('b1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','hinweis@fixture.invalid','',now(),now())
on conflict(id) do nothing;
insert into public.office_members(user_id,email,display_name,role,is_active,must_change_password)
values ('b1111111-1111-4111-8111-111111111111','hinweis@fixture.invalid','Mara Muster','member',true,false)
on conflict(user_id) do nothing;

create temporary table hinweis_ergebnis(label text, wert text) on commit drop;

do $$
declare
  v_user uuid:='b1111111-1111-4111-8111-111111111111';
  r jsonb;
  txt text;
begin
  -- 1. Der Fall aus dem Screenshot: ein bevorstehender Termin.
  r:=public.minds_publish_attention(v_user,jsonb_build_object(
    'event_key','event_upcoming:fixture-1','event_type','upcoming_event','source_type','system',
    'title','Demnächst: Musterbesprechung','body','Beginnt um 14:00.',
    'urgency','attention','user_requested',true,'timezone','Europe/Berlin'));
  select content into txt from public.conversation_messages where id=(r->>'message_id')::uuid;
  insert into hinweis_ergebnis values
    ('titel_und_text', txt),
    ('zugestellt', coalesce(r->>'status','')),
    ('weg', coalesce(r->>'route',''));

  -- 2. watch_fired schreibt title und body aus demselben reminder_text: nicht doppeln.
  r:=public.minds_publish_attention(v_user,jsonb_build_object(
    'event_key','watch:fixture-2','event_type','chat_reply_ready','source_type','system',
    'title','Die Frist der Musterprüfung ist erreicht.',
    'body','Die Frist der Musterprüfung ist erreicht.',
    'urgency','attention','user_requested',true,'timezone','Europe/Berlin'));
  select content into txt from public.conversation_messages where id=(r->>'message_id')::uuid;
  insert into hinweis_ergebnis values ('kein_doppel', txt);

  -- 3. Nur ein Titel, kein Text.
  r:=public.minds_publish_attention(v_user,jsonb_build_object(
    'event_key','event_upcoming:fixture-3','event_type','upcoming_event','source_type','system',
    'title','Demnächst: Mustertermin ohne Text','body','',
    'urgency','attention','user_requested',true,'timezone','Europe/Berlin'));
  select content into txt from public.conversation_messages where id=(r->>'message_id')::uuid;
  insert into hinweis_ergebnis values ('nur_titel', txt);
end $$;

do $$
declare
  v text;
begin
  select wert into v from hinweis_ergebnis where label='titel_und_text';
  if v is distinct from 'Demnächst: Musterbesprechung · Beginnt um 14:00.' then
    raise exception 'Der Hinweis trägt seinen Titel nicht: %',v;
  end if;

  select wert into v from hinweis_ergebnis where label='kein_doppel';
  if v is distinct from 'Die Frist der Musterprüfung ist erreicht.' then
    raise exception 'Ein Titel, der schon im Text steht, wurde gedoppelt: %',v;
  end if;

  select wert into v from hinweis_ergebnis where label='nur_titel';
  if v is distinct from 'Demnächst: Mustertermin ohne Text' then
    raise exception 'Ohne Text muss der Titel allein stehen: %',v;
  end if;

  select wert into v from hinweis_ergebnis where label='zugestellt';
  if v is distinct from 'delivered' then
    raise exception 'Der Hinweis gilt nicht mehr als zugestellt: %',v;
  end if;

  select wert into v from hinweis_ergebnis where label='weg';
  if v is distinct from 'interrupt' then
    raise exception 'Das Routing hat sich geändert: %',v;
  end if;
end $$;

select 'hinweis_traegt_titel' as pruefung, 'bestanden' as ergebnis;

rollback;
