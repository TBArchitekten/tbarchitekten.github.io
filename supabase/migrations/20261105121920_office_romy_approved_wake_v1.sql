-- A future wake can only be used when that specific timestamp was in the reviewed mission proposal.
alter table public.office_romy_missions add column approved_wake_at timestamptz;
comment on column public.office_romy_missions.approved_wake_at is
 'Explicit employee-approved wake time; lack of confirmation never proves external non-occurrence.';
