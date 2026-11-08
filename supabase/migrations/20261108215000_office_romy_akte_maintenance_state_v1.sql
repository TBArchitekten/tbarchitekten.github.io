-- Phase 5 · shared Office Projektakte nightly maintenance state.
-- Server-only claims, non-destructive proposals and owner-author provenance.
BEGIN;
CREATE TABLE IF NOT EXISTS public.office_romy_akte_maintenance_state (
  project_id uuid PRIMARY KEY REFERENCES public.office_projects(id) ON DELETE CASCADE,
  last_run_at timestamptz,
  last_status text NOT NULL DEFAULT 'pending'
    CHECK (last_status IN ('pending','nothing_new','ok','error')),
  lease_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.office_romy_akte_maintenance_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.office_romy_akte_maintenance_state FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.office_romy_akte_maintenance_state TO authenticated;
GRANT ALL ON public.office_romy_akte_maintenance_state TO service_role;
CREATE POLICY office_romy_akte_state_team_select
ON public.office_romy_akte_maintenance_state FOR SELECT TO authenticated
USING ((SELECT private.office_project_team_has_access(project_id)));
CREATE OR REPLACE FUNCTION public.office_romy_claim_akte_project(p_project_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE claimed uuid;
BEGIN
  IF p_project_id IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.office_projects p
    WHERE p.id=p_project_id AND p.status='aktiv') THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.office_project_members pm
    JOIN public.office_members m ON m.user_id=pm.user_id AND m.is_active
    WHERE pm.project_id=p_project_id
  ) THEN RETURN false; END IF;
  INSERT INTO public.office_romy_akte_maintenance_state(project_id)
  VALUES(p_project_id) ON CONFLICT(project_id) DO NOTHING;
  UPDATE public.office_romy_akte_maintenance_state st
  SET lease_until=now()+interval '15 minutes',updated_at=now()
  WHERE st.project_id=p_project_id
    AND (st.lease_until IS NULL OR st.lease_until < now())
    AND (st.last_run_at IS NULL OR
      (st.last_run_at AT TIME ZONE 'Europe/Berlin')::date <
      (now() AT TIME ZONE 'Europe/Berlin')::date)
  RETURNING st.project_id INTO claimed;
  RETURN claimed IS NOT NULL;
END
$function$;
REVOKE ALL ON FUNCTION public.office_romy_claim_akte_project(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_romy_claim_akte_project(uuid) TO service_role;
COMMIT;
