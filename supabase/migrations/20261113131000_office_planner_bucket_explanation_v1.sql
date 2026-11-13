-- TBA Office · Abgabe-Kopf im vorhandenen Planner (13.11.2026).
-- Additive columns only. Existing projects/buckets/tasks are unchanged.
-- Existing office membership / team-based RLS policies remain authoritative.
alter table public.minds_work_buckets
  add column if not exists description text not null default '',
  add column if not exists terminplan_ref text not null default '';

comment on column public.minds_work_buckets.description is
  'Optional German description below a Planner Bucket name; editable per project.';
comment on column public.minds_work_buckets.terminplan_ref is
  'Optional plain-text PSP / Abgabe reference from Office Terminplan; no implicit schedule edit.';
