-- TBA Office · Projektdokumente: Bilder der Mustermappe (24.11.2026, Claude, Auftrag Gari)
-- Freie Seiten der Mustermappe (Pläne, Ansichten, Seiten aus InDesign oder Archicad) liegen in einem privaten Bucket.
-- Ein PDF wird im Browser zur Seite als Bild; gespeichert werden nur Bilder bis 15 MB.
-- Pfad: <dokument_id>/<user_id>/<datei>. Lesen, wer das Dokument sieht (Projektteam, Projektleitung, Admin, wer es
-- angelegt hat); hochladen nur unter dem eigenen Pfad eines solchen Dokuments; entfernen, wer hochgeladen hat, oder
-- ein Admin. Keine Update-Policy: nichts wird überschrieben. Nichts Bestehendes wird geändert oder entfernt.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('office-projektdokumente', 'office-projektdokumente', false, 15728640,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Zugang zu einer Datei über das Dokument im ersten Teil des Pfads; ein Pfad ohne gültige Dokument-ID gilt nie.
create function private.office_projektdokument_datei_zugang(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when split_part(coalesce(p_name, ''), '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.office_projektdokument_zugang_id(split_part(p_name, '/', 1)::uuid)
    else false
  end
$$;
revoke all on function private.office_projektdokument_datei_zugang(text) from public, anon;
grant execute on function private.office_projektdokument_datei_zugang(text) to authenticated;

create policy office_projektdokumente_dateien_lesen on storage.objects for select to authenticated
  using (bucket_id = 'office-projektdokumente' and private.office_projektdokument_datei_zugang(name));
create policy office_projektdokumente_dateien_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'office-projektdokumente'
              and split_part(name, '/', 2) = (select auth.uid())::text
              and split_part(name, '/', 3) <> '' and split_part(name, '/', 4) = ''
              and private.office_projektdokument_datei_zugang(name));
create policy office_projektdokumente_dateien_entfernen on storage.objects for delete to authenticated
  using (bucket_id = 'office-projektdokumente' and private.office_projektdokument_datei_zugang(name)
         and (split_part(name, '/', 2) = (select auth.uid())::text or (select private.office_is_admin())));
