-- Office phase 1: Window read-only views reconstructed from catalog definitions.
-- These are SECURITY INVOKER: every read is still subject to Office owner/team RLS.
-- No data was copied, no existing Office view was replaced and no secrets are embedded.
begin;
CREATE OR REPLACE VIEW public.minds_project_movements_v1 WITH (security_invoker = true) AS
SELECT t.user_id,
    t.project_id,
    'task'::text AS source_kind,
    t.id::text AS source_ref,
    'gari'::text AS actor_kind,
    t.title,
        CASE
            WHEN t.archived_at IS NOT NULL THEN 'archived'::text
            WHEN t.completed_at IS NOT NULL THEN 'completed'::text
            ELSE COALESCE(t.work_status, 'not_started'::text)
        END AS status,
        CASE
            WHEN t.due_date IS NOT NULL THEN t.due_date::timestamp with time zone
            ELSE NULL::timestamp with time zone
        END AS due_at,
        CASE
            WHEN t.due_date IS NOT NULL THEN 'date'::text
            ELSE NULL::text
        END AS anchor_kind,
    jsonb_build_object('priority', t.priority, 'bucket_id', t.work_bucket_id, 'start_date', t.start_date) AS metadata
   FROM isabella_tasks t
  WHERE t.project_id IS NOT NULL
UNION ALL
 SELECT e.user_id,
    e.project_id,
    'expectation'::text AS source_kind,
    e.id::text AS source_ref,
    'world'::text AS actor_kind,
    e.title,
    e.status,
    e.due_at,
    'expectation_due'::text AS anchor_kind,
    jsonb_build_object('expected_event', e.expected_event, 'observability', e.observability, 'resolution_source', e.resolution_source) AS metadata
   FROM minds_expectations e
  WHERE e.project_id IS NOT NULL
UNION ALL
 SELECT c.user_id,
    c.project_id,
    'commitment'::text AS source_kind,
    c.id::text AS source_ref,
    'isabella'::text AS actor_kind,
    c.title,
    c.status,
    NULL::timestamp with time zone AS due_at,
    NULL::text AS anchor_kind,
    jsonb_build_object('objective', c.objective, 'completion_criteria', c.completion_criteria, 'agent', c.agent) AS metadata
   FROM minds_commitments c
  WHERE c.project_id IS NOT NULL
UNION ALL
 SELECT r.user_id,
    w.project_id,
    'mission'::text AS source_kind,
    r.id::text AS source_ref,
    'isabella'::text AS actor_kind,
    COALESCE(w.title, r.instruction) AS title,
    r.status,
    COALESCE(r.wake_at, r.next_attempt_at) AS due_at,
        CASE
            WHEN r.wake_at IS NOT NULL THEN 'wake_at'::text
            WHEN r.next_attempt_at IS NOT NULL THEN 'retry_at'::text
            ELSE NULL::text
        END AS anchor_kind,
    jsonb_build_object('workspace_id', r.workspace_id, 'phase', r.phase, 'wait_kind', r.wait_kind, 'wait_ref', r.wait_ref, 'blocker_question', r.blocker_question) AS metadata
   FROM minds_mission_runs r
     JOIN minds_commitment_workspaces w ON w.id = r.workspace_id
  WHERE w.project_id IS NOT NULL;
REVOKE ALL ON public.minds_project_movements_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.minds_project_movements_v1 TO authenticated, service_role;

CREATE OR REPLACE VIEW public.minds_project_sources_v1 WITH (security_invoker = true) AS
SELECT f.user_id,
    f.project_id,
    'work_file'::text AS source_kind,
    f.id::text AS source_ref,
    f.name AS title,
    f.created_at AS observed_at,
    NULL::timestamp with time zone AS occurred_at,
    COALESCE(f.metadata ->> 'sha256'::text, f.id::text) AS source_version,
    jsonb_build_object('mime_type', f.mime_type, 'size_bytes', f.size_bytes, 'index_status', f.index_status, 'source_kind', f.source_kind, 'folder_id', f.folder_id) || COALESCE(f.metadata, '{}'::jsonb) AS metadata
   FROM minds_work_files f
UNION ALL
 SELECT t.user_id,
    t.project_id,
    'thread_message'::text AS source_kind,
    m.id::text AS source_ref,
    t.title,
    m.created_at AS observed_at,
    m.created_at AS occurred_at,
    m.id::text AS source_version,
    jsonb_build_object('thread_id', t.id, 'conversation_id', t.conversation_id, 'role', m.role) AS metadata
   FROM minds_work_threads t
     JOIN conversation_messages m ON m.conversation_id = t.conversation_id
  WHERE t.conversation_id IS NOT NULL AND (m.role = ANY (ARRAY['user'::text, 'assistant'::text]));
REVOKE ALL ON public.minds_project_sources_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.minds_project_sources_v1 TO authenticated, service_role;

CREATE OR REPLACE VIEW public.minds_prospective_memory_v1 WITH (security_invoker = true) AS
SELECT id,
    user_id,
    request_id,
    project_id,
    mode,
    trigger_text,
    reminder_text,
    trigger_terms,
    status,
    observation_mode,
    channel_kind,
    channel_ref,
    freshness_minutes,
    last_checked_at,
    last_observed_at,
    condition_json,
    return_rule,
    cooldown_minutes,
    max_triggers,
    trigger_count,
    last_trigger_at,
    expires_at,
    armed_at,
    fired_at,
    done_at,
    cancelled_at,
    expired_at,
    source_conversation_id,
    metadata,
    created_at,
    updated_at
   FROM minds_standing_intents;
REVOKE ALL ON public.minds_prospective_memory_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.minds_prospective_memory_v1 TO authenticated, service_role;

CREATE OR REPLACE VIEW public.minds_review_debt_v1 WITH (security_invoker = true) AS
SELECT s.user_id,
    'shadow_decision'::text AS item_kind,
    s.id AS item_id,
    "left"(COALESCE(NULLIF(s.candidate ->> 'title'::text, ''::text), NULLIF(s.candidate ->> 'statement'::text, ''::text), replace(s.action, '_'::text, ' '::text)), 500) AS title,
        CASE
            WHEN s.proposal_kind = 'commitment'::text THEN 'delegation'::text
            WHEN s.proposal_kind = ANY (ARRAY['permission'::text, 'permission_change'::text]) THEN 'authority'::text
            WHEN s.proposal_kind = ANY (ARRAY['work_claim'::text, 'claim'::text]) THEN 'project_truth'::text
            WHEN s.proposal_kind = ANY (ARRAY['skill'::text, 'skill_proposal'::text]) THEN 'procedure'::text
            WHEN s.proposal_kind = ANY (ARRAY['standing_intent'::text, 'expectation'::text]) THEN 'future_state'::text
            ELSE 'state_change'::text
        END AS review_class,
        CASE
            WHEN s.proposal_kind = ANY (ARRAY['permission'::text, 'permission_change'::text, 'commitment'::text, 'work_claim'::text, 'claim'::text]) THEN 'high'::text
            WHEN s.proposal_kind = ANY (ARRAY['standing_intent'::text, 'expectation'::text, 'skill'::text, 'skill_proposal'::text]) THEN 'medium'::text
            ELSE 'low'::text
        END AS consequence,
        CASE
            WHEN s.proposal_kind = ANY (ARRAY['permission'::text, 'permission_change'::text]) THEN 'low'::text
            WHEN s.proposal_kind = ANY (ARRAY['commitment'::text, 'work_claim'::text, 'claim'::text]) THEN 'medium'::text
            ELSE 'high'::text
        END AS reversibility,
    s.created_at,
    EXTRACT(epoch FROM now() - s.created_at) / 3600.0 AS age_hours,
    NULL::timestamp with time zone AS expires_at,
    s.status AS source_status,
    jsonb_build_object('proposal_kind', s.proposal_kind, 'action', s.action, 'policy_mode', s.policy_mode, 'request_id', s.request_id, 'candidate', s.candidate, 'context', s.context) AS metadata
   FROM minds_shadow_decisions s
  WHERE s.status = 'pending'::text
UNION ALL
 SELECT h.user_id,
    'operating_hypothesis'::text AS item_kind,
    h.id AS item_id,
    "left"(h.statement, 500) AS title,
    'behavior_rule'::text AS review_class,
    'high'::text AS consequence,
    'medium'::text AS reversibility,
    h.proposed_at AS created_at,
    EXTRACT(epoch FROM now() - h.proposed_at) / 3600.0 AS age_hours,
    NULL::timestamp with time zone AS expires_at,
    h.status AS source_status,
    jsonb_build_object('dimension', h.dimension, 'claim_type', h.claim_type, 'inference_kind', h.inference_kind, 'pattern_key', h.pattern_key, 'rationale', h.rationale, 'evidence_summary', h.evidence_summary) AS metadata
   FROM minds_operating_model_hypotheses h
  WHERE h.status = 'proposed'::text
UNION ALL
 SELECT sp.user_id,
    'skill_proposal'::text AS item_kind,
    sp.id AS item_id,
    "left"(sp.name, 500) AS title,
    'procedure'::text AS review_class,
    'medium'::text AS consequence,
    'high'::text AS reversibility,
    sp.created_at,
    EXTRACT(epoch FROM now() - sp.created_at) / 3600.0 AS age_hours,
    NULL::timestamp with time zone AS expires_at,
    sp.status AS source_status,
    jsonb_build_object('slug', sp.slug, 'agent', sp.agent, 'description', sp.description, 'preferred_tools', to_jsonb(sp.preferred_tools), 'evidence', sp.evidence) AS metadata
   FROM minds_skill_proposals sp
  WHERE sp.status = 'proposed'::text
UNION ALL
 SELECT wc.user_id,
    'project_claim'::text AS item_kind,
    wc.id AS item_id,
    "left"(wc.statement, 500) AS title,
    'project_truth'::text AS review_class,
    'high'::text AS consequence,
    'medium'::text AS reversibility,
    wc.created_at,
    EXTRACT(epoch FROM now() - wc.created_at) / 3600.0 AS age_hours,
    NULL::timestamp with time zone AS expires_at,
    wc.status AS source_status,
    jsonb_build_object('project_id', wc.project_id, 'claim_type', wc.claim_type, 'provenance_class', wc.provenance_class, 'author_kind', wc.author_kind, 'model_kind', wc.model_kind, 'confidence', wc.confidence) AS metadata
   FROM minds_work_claims wc
  WHERE wc.status = 'proposed'::text
UNION ALL
 SELECT v.user_id,
    'project_variant'::text AS item_kind,
    v.id AS item_id,
    "left"(COALESCE(v.rationale, v.variant_kind), 500) AS title,
    'project_interpretation'::text AS review_class,
    'medium'::text AS consequence,
    'high'::text AS reversibility,
    v.created_at,
    EXTRACT(epoch FROM now() - v.created_at) / 3600.0 AS age_hours,
    NULL::timestamp with time zone AS expires_at,
    v.status AS source_status,
    jsonb_build_object('project_id', v.project_id, 'revision_id', v.revision_id, 'variant_kind', v.variant_kind, 'source_claim_id', v.source_claim_id, 'target_claim_id', v.target_claim_id, 'confidence', v.confidence, 'provenance', v.provenance) AS metadata
   FROM minds_project_model_variants v
  WHERE v.status = 'open'::text;
REVOKE ALL ON public.minds_review_debt_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.minds_review_debt_v1 TO authenticated, service_role;

CREATE OR REPLACE VIEW public.minds_review_queue_v2 WITH (security_invoker = true) AS
SELECT user_id,
    item_kind,
    item_id,
    title,
    review_class,
    consequence,
    reversibility,
    created_at,
    age_hours,
    expires_at,
    source_status,
    metadata,
        CASE
            WHEN item_kind = 'shadow_decision'::text AND consequence = 'low'::text AND reversibility = 'high'::text AND ((metadata ->> 'proposal_kind'::text) = ANY (ARRAY['task'::text, 'event'::text])) AND ((metadata ->> 'action'::text) = ANY (ARRAY['create_task'::text, 'create_event'::text])) AND COALESCE(((metadata -> 'context'::text) ->> 'source_tainted'::text)::boolean, false) = false AND NULLIF(TRIM(BOTH FROM COALESCE((metadata -> 'candidate'::text) ->> 'recurrence'::text, ''::text)), ''::text) IS NULL AND COALESCE((metadata -> 'candidate'::text) ->> 'action'::text, 'create'::text) = 'create'::text THEN true
            ELSE false
        END AS batchable,
        CASE
            WHEN item_kind = 'shadow_decision'::text AND consequence = 'low'::text AND reversibility = 'high'::text AND ((metadata ->> 'proposal_kind'::text) = ANY (ARRAY['task'::text, 'event'::text])) AND ((metadata ->> 'action'::text) = ANY (ARRAY['create_task'::text, 'create_event'::text])) AND COALESCE(((metadata -> 'context'::text) ->> 'source_tainted'::text)::boolean, false) = false AND NULLIF(TRIM(BOTH FROM COALESCE((metadata -> 'candidate'::text) ->> 'recurrence'::text, ''::text)), ''::text) IS NULL AND COALESCE((metadata -> 'candidate'::text) ->> 'action'::text, 'create'::text) = 'create'::text THEN "left"(concat_ws('|'::text, 'batch_v1', metadata ->> 'proposal_kind'::text, metadata ->> 'action'::text, COALESCE(NULLIF(((metadata -> 'context'::text) -> 'autonomy_class'::text) ->> 'scope_key'::text, ''::text), NULLIF((metadata -> 'candidate'::text) ->> 'project'::text, ''::text), NULLIF((metadata -> 'candidate'::text) ->> 'category'::text, ''::text), 'unscoped'::text), COALESCE(NULLIF((metadata -> 'candidate'::text) ->> 'date'::text, ''::text), 'undated'::text),
            CASE
                WHEN COALESCE(((metadata -> 'context'::text) ->> 'direct_request'::text)::boolean, false) THEN 'direct'::text
                ELSE 'inferred'::text
            END), 500)
            ELSE NULL::text
        END AS batch_key,
        CASE
            WHEN item_kind = 'shadow_decision'::text AND consequence = 'low'::text AND reversibility = 'high'::text AND ((metadata ->> 'proposal_kind'::text) = ANY (ARRAY['task'::text, 'event'::text])) AND ((metadata ->> 'action'::text) = ANY (ARRAY['create_task'::text, 'create_event'::text])) AND NULLIF(TRIM(BOTH FROM COALESCE((metadata -> 'candidate'::text) ->> 'recurrence'::text, ''::text)), ''::text) IS NULL THEN 'stale_reversible_shadow_v1'::text
            ELSE 'protected'::text
        END AS expiry_policy,
        CASE
            WHEN item_kind = 'shadow_decision'::text AND consequence = 'low'::text AND reversibility = 'high'::text AND ((metadata ->> 'proposal_kind'::text) = ANY (ARRAY['task'::text, 'event'::text])) AND ((metadata ->> 'action'::text) = ANY (ARRAY['create_task'::text, 'create_event'::text])) AND NULLIF(TRIM(BOTH FROM COALESCE((metadata -> 'candidate'::text) ->> 'recurrence'::text, ''::text)), ''::text) IS NULL THEN
            CASE
                WHEN COALESCE((metadata -> 'candidate'::text) ->> 'date'::text, ''::text) ~ '^\d{4}-\d{2}-\d{2}$'::text THEN GREATEST(created_at + '24:00:00'::interval, LEAST(created_at + '7 days'::interval, ((((metadata -> 'candidate'::text) ->> 'date'::text)::date) + '1 day'::interval)::timestamp with time zone))
                ELSE created_at + '7 days'::interval
            END
            ELSE NULL::timestamp with time zone
        END AS review_expires_at,
        CASE
            WHEN item_kind = ANY (ARRAY['operating_hypothesis'::text, 'project_claim'::text, 'project_variant'::text]) THEN true
            WHEN item_kind = 'shadow_decision'::text AND ((metadata ->> 'proposal_kind'::text) = ANY (ARRAY['permission'::text, 'permission_change'::text, 'commitment'::text, 'work_claim'::text, 'claim'::text])) THEN true
            ELSE false
        END AS protected_from_expiry
   FROM minds_review_debt_v1 d;
REVOKE ALL ON public.minds_review_queue_v2 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.minds_review_queue_v2 TO authenticated, service_role;

CREATE OR REPLACE VIEW public.minds_review_batches_v1 WITH (security_invoker = true) AS
SELECT user_id,
    batch_key,
    review_class,
    metadata ->> 'proposal_kind'::text AS proposal_kind,
    count(*)::integer AS item_count,
    min(created_at) AS oldest_created_at,
    min(review_expires_at) AS next_expiry_at,
    jsonb_agg(jsonb_build_object('item_kind', item_kind, 'item_id', item_id, 'title', title, 'created_at', created_at, 'review_expires_at', review_expires_at, 'consequence', consequence, 'reversibility', reversibility, 'metadata', metadata) ORDER BY created_at, item_id) AS items
   FROM minds_review_queue_v2 q
  WHERE batchable
  GROUP BY user_id, batch_key, review_class, (metadata ->> 'proposal_kind'::text)
 HAVING count(*) >= 2;
REVOKE ALL ON public.minds_review_batches_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.minds_review_batches_v1 TO authenticated, service_role;

CREATE OR REPLACE VIEW public.minds_review_routing_v1 WITH (security_invoker = true) AS
SELECT user_id,
    item_kind,
    item_id,
    title,
    review_class,
    consequence,
    reversibility,
    created_at,
    age_hours,
    expires_at,
    source_status,
    metadata,
    batchable,
    batch_key,
    expiry_policy,
    review_expires_at,
    protected_from_expiry,
        CASE
            WHEN (review_class = ANY (ARRAY['authority'::text, 'project_truth'::text, 'behavior_rule'::text, 'delegation'::text])) OR consequence = 'high'::text OR reversibility = 'low'::text THEN 'authority_boundary'::text
            WHEN consequence = 'medium'::text THEN 'bounded_change'::text
            ELSE 'cheap_reversible'::text
        END AS review_lane,
        CASE
            WHEN item_kind = 'shadow_decision'::text AND (COALESCE(((metadata -> 'context'::text) ->> 'requires_user'::text)::boolean, false) OR COALESCE(((metadata -> 'context'::text) ->> 'blocking'::text)::boolean, false) OR COALESCE((metadata -> 'context'::text) ->> 'wait_kind'::text, ''::text) = 'waiting_for_user'::text) THEN true
            ELSE false
        END AS dependency_blocking,
        CASE
            WHEN review_expires_at IS NOT NULL AND review_expires_at <= (now() + '24:00:00'::interval) THEN true
            WHEN item_kind = 'shadow_decision'::text AND COALESCE((metadata -> 'candidate'::text) ->> 'date'::text, ''::text) ~ '^\d{4}-\d{2}-\d{2}$'::text AND (((metadata -> 'candidate'::text) ->> 'date'::text)::date) >= CURRENT_DATE AND (((metadata -> 'candidate'::text) ->> 'date'::text)::date) <= (CURRENT_DATE + 1) THEN true
            ELSE false
        END AS window_closing,
        CASE
            WHEN item_kind = 'shadow_decision'::text AND (COALESCE(((metadata -> 'context'::text) ->> 'requires_user'::text)::boolean, false) OR COALESCE(((metadata -> 'context'::text) ->> 'blocking'::text)::boolean, false) OR COALESCE((metadata -> 'context'::text) ->> 'wait_kind'::text, ''::text) = 'waiting_for_user'::text) THEN 'blocking_dependency'::text
            WHEN review_expires_at IS NOT NULL AND review_expires_at <= (now() + '24:00:00'::interval) THEN 'review_window_closing'::text
            WHEN item_kind = 'shadow_decision'::text AND COALESCE((metadata -> 'candidate'::text) ->> 'date'::text, ''::text) ~ '^\d{4}-\d{2}-\d{2}$'::text AND (((metadata -> 'candidate'::text) ->> 'date'::text)::date) >= CURRENT_DATE AND (((metadata -> 'candidate'::text) ->> 'date'::text)::date) <= (CURRENT_DATE + 1) THEN 'target_window_closing'::text
            WHEN (review_class = ANY (ARRAY['authority'::text, 'project_truth'::text, 'behavior_rule'::text, 'delegation'::text])) OR consequence = 'high'::text OR reversibility = 'low'::text THEN 'authority_boundary_review'::text
            WHEN consequence = 'medium'::text THEN 'bounded_review'::text
            ELSE 'defer_reversible_review'::text
        END AS routing_reason
   FROM minds_review_queue_v2 q;
REVOKE ALL ON public.minds_review_routing_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.minds_review_routing_v1 TO authenticated, service_role;
commit;
