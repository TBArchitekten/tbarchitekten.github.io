-- Romy phase 4: owner-only forgetting of accepted or provisional personal memory.
-- Explicit review by the member; no client may supply a different user_id.
-- Preserves historical provenance via the existing non-destructive lineage tombstones.
BEGIN;
CREATE OR REPLACE FUNCTION public.office_romy_forget_private_memory(p_kind text,p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_exists boolean := false;
  v_source_kind text;
BEGIN
  IF v_user IS NULL OR NOT (SELECT private.office_is_member()) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE='42501';
  END IF;
  IF p_id IS NULL OR p_kind NOT IN ('memory','claim','entity') THEN
    RAISE EXCEPTION 'invalid_memory_target' USING ERRCODE='22023';
  END IF;
  IF p_kind='memory' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.isabella_memories
      WHERE id=p_id AND user_id=v_user AND status='active'
    ) INTO v_exists;
    v_source_kind:='memory';
  ELSIF p_kind='claim' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.isabella_model_claims
      WHERE id=p_id AND user_id=v_user AND status IN ('confirmed','hypothesis')
    ) INTO v_exists;
    v_source_kind:='model_claim';
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.isabella_entities
      WHERE id=p_id AND user_id=v_user AND metadata->>'forgotten_at' IS NULL
    ) INTO v_exists;
    v_source_kind:='entity';
  END IF;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'memory_not_available_for_owner' USING ERRCODE='42501';
  END IF;
  -- The existing service-side invalidator retracts derived records and retains
  -- lineage; no DELETE, no access to another member's records.
  PERFORM public.minds_invalidate_memory_lineage(v_user,v_source_kind,p_id::text,'user_forget');
  RETURN jsonb_build_object('status','forgotten','kind',p_kind,'id',p_id);
END
$function$;
REVOKE ALL ON FUNCTION public.office_romy_forget_private_memory(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.office_romy_forget_private_memory(text,uuid) TO authenticated;
COMMIT;
