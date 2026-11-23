-- TBA Office · Buckets entfernen, wiederherstellen und ordnen (23.11.2026, Claude).
-- Der Planner ruft minds_work_bucket_archive, _restore und _reorder auf; die Funktionen gab es nur in Window
-- (20261031120000 und 20261031165000), nie in der Office-Datenbank. Deshalb geschah bei «Entfernen» nichts.
-- Übernommen aus Window, angepasst an das Office: Buckets gehören dem Projekt, nicht einer Person. Wer sie
-- ändern darf, entscheidet dieselbe Regel wie die Policy minds_work_buckets_update (wer ihn angelegt hat,
-- die Projektleitung, das Projektteam). Alles läuft als aufrufende Person unter RLS; bleibt eine offene Aufgabe
-- unverschiebbar, bricht der Vorgang ganz ab, statt Aufgaben in einem entfernten Bucket zurückzulassen.
-- Entfernen heißt archivieren: keine Aufgabe und kein Bucket wird gelöscht. Erledigte Aufgaben bleiben am
-- archivierten Bucket (Verlauf), offene kommen nach «Ohne Bucket».

create or replace function public.minds_work_bucket_archive(p_project_id uuid, p_bucket_id uuid)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_offen integer;
  v_moved integer;
  v_done integer;
begin
  if v_uid is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  if p_project_id is null or p_bucket_id is null then
    raise exception 'Ungültiger Bucket.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project_id::text || ':work-buckets', 0));
  if not exists(
    select 1 from public.minds_work_buckets b
    where b.id = p_bucket_id and b.project_id = p_project_id and b.archived = false
      and (b.user_id = v_uid or (select private.office_leads_project(b.project_id))
           or (select private.office_in_project_team(b.project_id)))
  ) then
    raise exception 'Bucket nicht verfügbar oder keine Berechtigung.' using errcode = '42501';
  end if;
  select count(*) into v_offen from public.isabella_tasks t
   where t.project_id = p_project_id and t.work_bucket_id = p_bucket_id and t.completed_at is null;
  update public.isabella_tasks
     set work_bucket_id = null, updated_at = now()
   where project_id = p_project_id and work_bucket_id = p_bucket_id and completed_at is null;
  get diagnostics v_moved = row_count;
  if v_moved <> v_offen then
    raise exception 'Nicht alle offenen Aufgaben dieses Buckets dürfen verschoben werden.' using errcode = '42501';
  end if;
  update public.minds_work_buckets
     set archived = true, updated_at = now()
   where id = p_bucket_id and project_id = p_project_id and archived = false;
  get diagnostics v_done = row_count;
  if v_done <> 1 then
    raise exception 'Bucket konnte nicht entfernt werden.' using errcode = '42501';
  end if;
  return v_moved;
end;
$$;

create or replace function public.minds_work_bucket_restore(p_project_id uuid, p_bucket_id uuid)
returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_sort integer;
  v_done integer;
begin
  if v_uid is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  if p_project_id is null or p_bucket_id is null then
    raise exception 'Ungültiger Bucket.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project_id::text || ':work-buckets', 0));
  select coalesce(max(sort_order), 0) + 10 into v_sort
    from public.minds_work_buckets where project_id = p_project_id and archived = false;
  update public.minds_work_buckets
     set archived = false, sort_order = v_sort, updated_at = now()
   where id = p_bucket_id and project_id = p_project_id and archived = true;
  get diagnostics v_done = row_count;
  if v_done <> 1 then
    raise exception 'Archivierter Bucket nicht verfügbar oder keine Berechtigung.' using errcode = '42501';
  end if;
  return true;
end;
$$;

create or replace function public.minds_work_bucket_reorder(p_project_id uuid, p_bucket_ids uuid[])
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
  v_done integer;
begin
  if v_uid is null or not (select private.office_is_member()) then
    raise exception 'Bitte erneut anmelden.' using errcode = '42501';
  end if;
  if p_project_id is null or p_bucket_ids is null or cardinality(p_bucket_ids) > 200 then
    raise exception 'Ungültige Reihenfolge.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_project_id::text || ':work-buckets', 0));
  select count(*) into v_count from public.minds_work_buckets where project_id = p_project_id and archived = false;
  -- Genau die aktiven Buckets des Projekts, jeder einmal; sonst neu laden.
  if cardinality(p_bucket_ids) <> v_count
     or (select count(distinct id) from unnest(p_bucket_ids) as ids(id)) <> v_count
     or exists(select 1 from unnest(p_bucket_ids) as ids(id)
               where ids.id is null or not exists(select 1 from public.minds_work_buckets b
                 where b.id = ids.id and b.project_id = p_project_id and b.archived = false)) then
    raise exception 'Die Buckets haben sich geändert. Bitte neu laden.' using errcode = '22023';
  end if;
  update public.minds_work_buckets b
     set sort_order = (o.ordinality - 1) * 10, updated_at = now()
    from unnest(p_bucket_ids) with ordinality as o(id, ordinality)
   where b.id = o.id and b.project_id = p_project_id and b.archived = false;
  get diagnostics v_done = row_count;
  if v_done <> v_count then
    raise exception 'Keine Berechtigung, die Buckets dieses Projekts zu ordnen.' using errcode = '42501';
  end if;
  return v_count;
end;
$$;

revoke all on function public.minds_work_bucket_archive(uuid,uuid) from public, anon;
revoke all on function public.minds_work_bucket_restore(uuid,uuid) from public, anon;
revoke all on function public.minds_work_bucket_reorder(uuid,uuid[]) from public, anon;
grant execute on function public.minds_work_bucket_archive(uuid,uuid) to authenticated;
grant execute on function public.minds_work_bucket_restore(uuid,uuid) to authenticated;
grant execute on function public.minds_work_bucket_reorder(uuid,uuid[]) to authenticated;
comment on function public.minds_work_bucket_archive(uuid,uuid) is
  'Office: entfernt (archiviert) einen Bucket des Projekts; offene Aufgaben nach «Ohne Bucket», erledigte bleiben als Verlauf. Nichts wird gelöscht.';
comment on function public.minds_work_bucket_restore(uuid,uuid) is
  'Office: stellt einen archivierten Bucket des Projekts wieder her und hängt ihn hinten an.';
comment on function public.minds_work_bucket_reorder(uuid,uuid[]) is
  'Office: ordnet genau die aktiven Buckets eines Projekts neu.';
