-- Office / Romy · Phase 1 · RLS and Data API grants.
-- Project knowledge is readable only by explicitly assigned team members.
-- Personal knowledge and runtime state are visible only to their owner.
-- Server receipt, model authority and evidence tables remain read-only to browsers.
-- All mutations requiring reviews use verified RPC/service pathways, not direct REST.
begin;

create or replace function private.office_project_team_has_access(p_project_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select p_project_id is not null
    and (select private.office_is_member())
    and exists(
      select 1
      from public.office_project_members pm
      join public.office_projects p on p.id = pm.project_id and p.status = 'aktiv'
      where pm.project_id = p_project_id
        and pm.user_id = (select auth.uid())
    )
$function$;
revoke all on function private.office_project_team_has_access(uuid) from public, anon, authenticated;
grant execute on function private.office_project_team_has_access(uuid) to authenticated;

-- Explicitly enable RLS on every newly created runtime table. Policies alone
-- do not enforce isolation until RLS is enabled (critical security invariant).
ALTER TABLE public."conversation_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_activity_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_embeddings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_entities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_entity_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_followups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_memories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_model_claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_proposal_feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_return_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_routines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_runtime_secrets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_skill_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."isabella_task_reminders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_action_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_agent_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_ai_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_artifact_intake" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_artifacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_attention_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_autonomy_executions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_calendar_action_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_calendar_execution_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_capability_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_chat_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_chat_stream_delivery_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_commitment_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_commitment_signal_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_commitment_workspace_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_commitment_workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_commitments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_contextual_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_continuity_signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_delivery_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_delivery_intents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_expectation_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_expectations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_exposure_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_heartbeat_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_intent_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_memory_flushes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_memory_forget_tombstones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_memory_lineage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_mission_run_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_mission_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_mission_runtime_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_mission_runtime_executions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_model_claim_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_model_independence_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_operating_model_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_operating_model_hypotheses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_operating_model_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_operating_model_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_outcome_feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_permission_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_post_action_feedback_candidates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_review_admission_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_review_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_routine_action_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_routine_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_runtime_capability_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_self_review_proposals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_self_review_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_self_review_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_shadow_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_skill_proposals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_standing_intents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_user_skill_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_user_skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_watch_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_watch_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_project_model_elements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_project_model_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_project_model_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_project_perimeter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_project_referents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_project_source_comparison_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_project_source_comparisons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_project_source_ingestions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_work_claim_relations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_work_claims" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_work_docling_page_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_work_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_work_ingest_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_work_memory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_work_source_segments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."minds_work_source_text_receipts" ENABLE ROW LEVEL SECURITY;

-- conversation_messages
revoke all on table public."conversation_messages" from anon, authenticated;
grant all on table public."conversation_messages" to service_role;
create policy "office_romy_conversation_messages_owner_select" on public."conversation_messages" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."conversation_messages" to authenticated;
create policy office_romy_owner_turn_insert on public.conversation_messages for insert to authenticated with check (((select auth.uid()) = user_id and (select private.office_is_member())) and role='user' and provisional=false and provenance_class='owner' and coalesce(metadata->>'author','owner') not in ('system','isabella','romy'));
grant insert on public.conversation_messages to authenticated;

-- conversations
revoke all on table public."conversations" from anon, authenticated;
grant all on table public."conversations" to service_role;
create policy "office_romy_conversations_owner_select" on public."conversations" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."conversations" to authenticated;
create policy office_romy_conversation_insert on public.conversations for insert to authenticated with check (((select auth.uid()) = user_id and (select private.office_is_member())) and app_scope in ('isabella','work_thread'));
create policy office_romy_conversation_update on public.conversations for update to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member()))) with check (((select auth.uid()) = user_id and (select private.office_is_member())));
grant insert on public.conversations to authenticated;
grant update (title,updated_at) on public.conversations to authenticated;

-- isabella_activity_log
revoke all on table public."isabella_activity_log" from anon, authenticated;
grant all on table public."isabella_activity_log" to service_role;
create policy "office_romy_isabella_activity_log_owner_select" on public."isabella_activity_log" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_activity_log" to authenticated;

-- isabella_embeddings
revoke all on table public."isabella_embeddings" from anon, authenticated;
grant all on table public."isabella_embeddings" to service_role;
create policy "office_romy_isabella_embeddings_owner_select" on public."isabella_embeddings" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_embeddings" to authenticated;

-- isabella_entities
revoke all on table public."isabella_entities" from anon, authenticated;
grant all on table public."isabella_entities" to service_role;
create policy "office_romy_isabella_entities_owner_select" on public."isabella_entities" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_entities" to authenticated;

-- isabella_entity_links
revoke all on table public."isabella_entity_links" from anon, authenticated;
grant all on table public."isabella_entity_links" to service_role;
create policy "office_romy_isabella_entity_links_owner_select" on public."isabella_entity_links" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_entity_links" to authenticated;

-- isabella_followups
revoke all on table public."isabella_followups" from anon, authenticated;
grant all on table public."isabella_followups" to service_role;
create policy "office_romy_isabella_followups_owner_select" on public."isabella_followups" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_followups" to authenticated;

-- isabella_memories
revoke all on table public."isabella_memories" from anon, authenticated;
grant all on table public."isabella_memories" to service_role;
create policy "office_romy_isabella_memories_owner_select" on public."isabella_memories" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_memories" to authenticated;

-- isabella_model_claims
revoke all on table public."isabella_model_claims" from anon, authenticated;
grant all on table public."isabella_model_claims" to service_role;
create policy "office_romy_isabella_model_claims_owner_select" on public."isabella_model_claims" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_model_claims" to authenticated;

-- isabella_proposal_feedback
revoke all on table public."isabella_proposal_feedback" from anon, authenticated;
grant all on table public."isabella_proposal_feedback" to service_role;
create policy "office_romy_isabella_proposal_feedback_owner_select" on public."isabella_proposal_feedback" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_proposal_feedback" to authenticated;

-- isabella_return_queue
revoke all on table public."isabella_return_queue" from anon, authenticated;
grant all on table public."isabella_return_queue" to service_role;
create policy "office_romy_isabella_return_queue_owner_select" on public."isabella_return_queue" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_return_queue" to authenticated;

-- isabella_routines
revoke all on table public."isabella_routines" from anon, authenticated;
grant all on table public."isabella_routines" to service_role;
create policy "office_romy_isabella_routines_owner_select" on public."isabella_routines" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_routines" to authenticated;

-- isabella_runtime_secrets
revoke all on table public."isabella_runtime_secrets" from anon, authenticated;
grant all on table public."isabella_runtime_secrets" to service_role;
-- Service-only table; no authenticated RLS policy or grant.

-- isabella_skill_runs
revoke all on table public."isabella_skill_runs" from anon, authenticated;
grant all on table public."isabella_skill_runs" to service_role;
create policy "office_romy_isabella_skill_runs_owner_select" on public."isabella_skill_runs" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_skill_runs" to authenticated;

-- isabella_skills
revoke all on table public."isabella_skills" from anon, authenticated;
grant all on table public."isabella_skills" to service_role;
-- Service-only table; no authenticated RLS policy or grant.

-- isabella_task_reminders
revoke all on table public."isabella_task_reminders" from anon, authenticated;
grant all on table public."isabella_task_reminders" to service_role;
create policy "office_romy_isabella_task_reminders_owner_select" on public."isabella_task_reminders" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."isabella_task_reminders" to authenticated;

-- minds_action_policies
revoke all on table public."minds_action_policies" from anon, authenticated;
grant all on table public."minds_action_policies" to service_role;
create policy "office_romy_minds_action_policies_owner_select" on public."minds_action_policies" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_action_policies" to authenticated;

-- minds_agent_runs
revoke all on table public."minds_agent_runs" from anon, authenticated;
grant all on table public."minds_agent_runs" to service_role;
create policy "office_romy_minds_agent_runs_owner_select" on public."minds_agent_runs" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_agent_runs" to authenticated;

-- minds_ai_usage
revoke all on table public."minds_ai_usage" from anon, authenticated;
grant all on table public."minds_ai_usage" to service_role;
create policy "office_romy_minds_ai_usage_owner_select" on public."minds_ai_usage" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_ai_usage" to authenticated;

-- minds_artifact_intake
revoke all on table public."minds_artifact_intake" from anon, authenticated;
grant all on table public."minds_artifact_intake" to service_role;
create policy "office_romy_minds_artifact_intake_owner_select" on public."minds_artifact_intake" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_artifact_intake" to authenticated;

-- minds_artifacts
revoke all on table public."minds_artifacts" from anon, authenticated;
grant all on table public."minds_artifacts" to service_role;
create policy "office_romy_minds_artifacts_owner_select" on public."minds_artifacts" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_artifacts" to authenticated;

-- minds_attention_events
revoke all on table public."minds_attention_events" from anon, authenticated;
grant all on table public."minds_attention_events" to service_role;
create policy "office_romy_minds_attention_events_owner_select" on public."minds_attention_events" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_attention_events" to authenticated;

-- minds_autonomy_executions
revoke all on table public."minds_autonomy_executions" from anon, authenticated;
grant all on table public."minds_autonomy_executions" to service_role;
create policy "office_romy_minds_autonomy_executions_owner_select" on public."minds_autonomy_executions" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_autonomy_executions" to authenticated;

-- minds_calendar_action_receipts
revoke all on table public."minds_calendar_action_receipts" from anon, authenticated;
grant all on table public."minds_calendar_action_receipts" to service_role;
create policy "office_romy_minds_calendar_action_receipts_owner_select" on public."minds_calendar_action_receipts" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_calendar_action_receipts" to authenticated;

-- minds_calendar_execution_preferences
revoke all on table public."minds_calendar_execution_preferences" from anon, authenticated;
grant all on table public."minds_calendar_execution_preferences" to service_role;
create policy "office_romy_minds_calendar_execution_preferences_owner_select" on public."minds_calendar_execution_preferences" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_calendar_execution_preferences" to authenticated;

-- minds_capability_runs
revoke all on table public."minds_capability_runs" from anon, authenticated;
grant all on table public."minds_capability_runs" to service_role;
create policy "office_romy_minds_capability_runs_owner_select" on public."minds_capability_runs" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_capability_runs" to authenticated;

-- minds_chat_jobs
revoke all on table public."minds_chat_jobs" from anon, authenticated;
grant all on table public."minds_chat_jobs" to service_role;
create policy "office_romy_minds_chat_jobs_owner_select" on public."minds_chat_jobs" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_chat_jobs" to authenticated;

-- minds_chat_stream_delivery_receipts
revoke all on table public."minds_chat_stream_delivery_receipts" from anon, authenticated;
grant all on table public."minds_chat_stream_delivery_receipts" to service_role;
create policy "office_romy_minds_chat_stream_delivery_receipts_owner_select" on public."minds_chat_stream_delivery_receipts" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_chat_stream_delivery_receipts" to authenticated;

-- minds_commitment_events
revoke all on table public."minds_commitment_events" from anon, authenticated;
grant all on table public."minds_commitment_events" to service_role;
create policy "office_romy_minds_commitment_events_owner_select" on public."minds_commitment_events" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_commitment_events" to authenticated;

-- minds_commitment_signal_links
revoke all on table public."minds_commitment_signal_links" from anon, authenticated;
grant all on table public."minds_commitment_signal_links" to service_role;
create policy "office_romy_minds_commitment_signal_links_owner_select" on public."minds_commitment_signal_links" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_commitment_signal_links" to authenticated;

-- minds_commitment_workspace_items
revoke all on table public."minds_commitment_workspace_items" from anon, authenticated;
grant all on table public."minds_commitment_workspace_items" to service_role;
create policy "office_romy_minds_commitment_workspace_items_owner_select" on public."minds_commitment_workspace_items" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_commitment_workspace_items" to authenticated;

-- minds_commitment_workspaces
revoke all on table public."minds_commitment_workspaces" from anon, authenticated;
grant all on table public."minds_commitment_workspaces" to service_role;
create policy "office_romy_minds_commitment_workspaces_owner_select" on public."minds_commitment_workspaces" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_commitment_workspaces" to authenticated;

-- minds_commitments
revoke all on table public."minds_commitments" from anon, authenticated;
grant all on table public."minds_commitments" to service_role;
create policy "office_romy_minds_commitments_owner_select" on public."minds_commitments" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_commitments" to authenticated;

-- minds_contextual_permissions
revoke all on table public."minds_contextual_permissions" from anon, authenticated;
grant all on table public."minds_contextual_permissions" to service_role;
create policy "office_romy_minds_contextual_permissions_owner_select" on public."minds_contextual_permissions" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_contextual_permissions" to authenticated;

-- minds_continuity_signals
revoke all on table public."minds_continuity_signals" from anon, authenticated;
grant all on table public."minds_continuity_signals" to service_role;
create policy "office_romy_minds_continuity_signals_owner_select" on public."minds_continuity_signals" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_continuity_signals" to authenticated;

-- minds_delivery_attempts
revoke all on table public."minds_delivery_attempts" from anon, authenticated;
grant all on table public."minds_delivery_attempts" to service_role;
create policy "office_romy_minds_delivery_attempts_owner_select" on public."minds_delivery_attempts" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_delivery_attempts" to authenticated;

-- minds_delivery_intents
revoke all on table public."minds_delivery_intents" from anon, authenticated;
grant all on table public."minds_delivery_intents" to service_role;
create policy "office_romy_minds_delivery_intents_owner_select" on public."minds_delivery_intents" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_delivery_intents" to authenticated;

-- minds_expectation_reviews
revoke all on table public."minds_expectation_reviews" from anon, authenticated;
grant all on table public."minds_expectation_reviews" to service_role;
create policy "office_romy_minds_expectation_reviews_owner_select" on public."minds_expectation_reviews" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_expectation_reviews" to authenticated;

-- minds_expectations
revoke all on table public."minds_expectations" from anon, authenticated;
grant all on table public."minds_expectations" to service_role;
create policy "office_romy_minds_expectations_owner_select" on public."minds_expectations" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_expectations" to authenticated;

-- minds_exposure_receipts
revoke all on table public."minds_exposure_receipts" from anon, authenticated;
grant all on table public."minds_exposure_receipts" to service_role;
create policy "office_romy_minds_exposure_receipts_owner_select" on public."minds_exposure_receipts" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_exposure_receipts" to authenticated;

-- minds_heartbeat_events
revoke all on table public."minds_heartbeat_events" from anon, authenticated;
grant all on table public."minds_heartbeat_events" to service_role;
create policy "office_romy_minds_heartbeat_events_owner_select" on public."minds_heartbeat_events" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_heartbeat_events" to authenticated;

-- minds_intent_deliveries
revoke all on table public."minds_intent_deliveries" from anon, authenticated;
grant all on table public."minds_intent_deliveries" to service_role;
create policy "office_romy_minds_intent_deliveries_owner_select" on public."minds_intent_deliveries" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_intent_deliveries" to authenticated;

-- minds_memory_flushes
revoke all on table public."minds_memory_flushes" from anon, authenticated;
grant all on table public."minds_memory_flushes" to service_role;
create policy "office_romy_minds_memory_flushes_owner_select" on public."minds_memory_flushes" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_memory_flushes" to authenticated;

-- minds_memory_forget_tombstones
revoke all on table public."minds_memory_forget_tombstones" from anon, authenticated;
grant all on table public."minds_memory_forget_tombstones" to service_role;
create policy "office_romy_minds_memory_forget_tombstones_owner_select" on public."minds_memory_forget_tombstones" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_memory_forget_tombstones" to authenticated;

-- minds_memory_lineage
revoke all on table public."minds_memory_lineage" from anon, authenticated;
grant all on table public."minds_memory_lineage" to service_role;
create policy "office_romy_minds_memory_lineage_owner_select" on public."minds_memory_lineage" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_memory_lineage" to authenticated;

-- minds_mission_run_events
revoke all on table public."minds_mission_run_events" from anon, authenticated;
grant all on table public."minds_mission_run_events" to service_role;
create policy "office_romy_minds_mission_run_events_owner_select" on public."minds_mission_run_events" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_mission_run_events" to authenticated;

-- minds_mission_runs
revoke all on table public."minds_mission_runs" from anon, authenticated;
grant all on table public."minds_mission_runs" to service_role;
create policy "office_romy_minds_mission_runs_owner_select" on public."minds_mission_runs" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_mission_runs" to authenticated;

-- minds_mission_runtime_events
revoke all on table public."minds_mission_runtime_events" from anon, authenticated;
grant all on table public."minds_mission_runtime_events" to service_role;
create policy "office_romy_minds_mission_runtime_events_owner_select" on public."minds_mission_runtime_events" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_mission_runtime_events" to authenticated;

-- minds_mission_runtime_executions
revoke all on table public."minds_mission_runtime_executions" from anon, authenticated;
grant all on table public."minds_mission_runtime_executions" to service_role;
create policy "office_romy_minds_mission_runtime_executions_owner_select" on public."minds_mission_runtime_executions" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_mission_runtime_executions" to authenticated;

-- minds_model_claim_reviews
revoke all on table public."minds_model_claim_reviews" from anon, authenticated;
grant all on table public."minds_model_claim_reviews" to service_role;
create policy "office_romy_minds_model_claim_reviews_owner_select" on public."minds_model_claim_reviews" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_model_claim_reviews" to authenticated;

-- minds_model_independence_runs
revoke all on table public."minds_model_independence_runs" from anon, authenticated;
grant all on table public."minds_model_independence_runs" to service_role;
create policy "office_romy_minds_model_independence_runs_owner_select" on public."minds_model_independence_runs" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_model_independence_runs" to authenticated;

-- minds_operating_model_evidence
revoke all on table public."minds_operating_model_evidence" from anon, authenticated;
grant all on table public."minds_operating_model_evidence" to service_role;
create policy "office_romy_minds_operating_model_evidence_owner_select" on public."minds_operating_model_evidence" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_operating_model_evidence" to authenticated;

-- minds_operating_model_hypotheses
revoke all on table public."minds_operating_model_hypotheses" from anon, authenticated;
grant all on table public."minds_operating_model_hypotheses" to service_role;
create policy "office_romy_minds_operating_model_hypotheses_owner_select" on public."minds_operating_model_hypotheses" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_operating_model_hypotheses" to authenticated;

-- minds_operating_model_observations
revoke all on table public."minds_operating_model_observations" from anon, authenticated;
grant all on table public."minds_operating_model_observations" to service_role;
create policy "office_romy_minds_operating_model_observations_owner_select" on public."minds_operating_model_observations" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_operating_model_observations" to authenticated;

-- minds_operating_model_reviews
revoke all on table public."minds_operating_model_reviews" from anon, authenticated;
grant all on table public."minds_operating_model_reviews" to service_role;
create policy "office_romy_minds_operating_model_reviews_owner_select" on public."minds_operating_model_reviews" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_operating_model_reviews" to authenticated;

-- minds_outcome_feedback
revoke all on table public."minds_outcome_feedback" from anon, authenticated;
grant all on table public."minds_outcome_feedback" to service_role;
create policy "office_romy_minds_outcome_feedback_owner_select" on public."minds_outcome_feedback" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_outcome_feedback" to authenticated;

-- minds_permission_reviews
revoke all on table public."minds_permission_reviews" from anon, authenticated;
grant all on table public."minds_permission_reviews" to service_role;
create policy "office_romy_minds_permission_reviews_owner_select" on public."minds_permission_reviews" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_permission_reviews" to authenticated;

-- minds_post_action_feedback_candidates
revoke all on table public."minds_post_action_feedback_candidates" from anon, authenticated;
grant all on table public."minds_post_action_feedback_candidates" to service_role;
create policy "office_romy_minds_post_action_feedback_candidates_owner_select" on public."minds_post_action_feedback_candidates" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_post_action_feedback_candidates" to authenticated;

-- minds_project_model_elements
revoke all on table public."minds_project_model_elements" from anon, authenticated;
grant all on table public."minds_project_model_elements" to service_role;
create policy "office_romy_minds_project_model_elements_team_select" on public."minds_project_model_elements" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_project_model_elements" to authenticated;

-- minds_project_model_revisions
revoke all on table public."minds_project_model_revisions" from anon, authenticated;
grant all on table public."minds_project_model_revisions" to service_role;
create policy "office_romy_minds_project_model_revisions_team_select" on public."minds_project_model_revisions" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_project_model_revisions" to authenticated;

-- minds_project_model_variants
revoke all on table public."minds_project_model_variants" from anon, authenticated;
grant all on table public."minds_project_model_variants" to service_role;
create policy "office_romy_minds_project_model_variants_team_select" on public."minds_project_model_variants" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_project_model_variants" to authenticated;

-- minds_project_perimeter
revoke all on table public."minds_project_perimeter" from anon, authenticated;
grant all on table public."minds_project_perimeter" to service_role;
create policy "office_romy_minds_project_perimeter_team_select" on public."minds_project_perimeter" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_project_perimeter" to authenticated;

-- minds_project_referents
revoke all on table public."minds_project_referents" from anon, authenticated;
grant all on table public."minds_project_referents" to service_role;
create policy "office_romy_minds_project_referents_team_select" on public."minds_project_referents" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_project_referents" to authenticated;

-- minds_project_source_comparison_items
revoke all on table public."minds_project_source_comparison_items" from anon, authenticated;
grant all on table public."minds_project_source_comparison_items" to service_role;
create policy "office_romy_minds_project_source_comparison_items_team_select" on public."minds_project_source_comparison_items" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_project_source_comparison_items" to authenticated;

-- minds_project_source_comparisons
revoke all on table public."minds_project_source_comparisons" from anon, authenticated;
grant all on table public."minds_project_source_comparisons" to service_role;
create policy "office_romy_minds_project_source_comparisons_team_select" on public."minds_project_source_comparisons" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_project_source_comparisons" to authenticated;

-- minds_project_source_ingestions
revoke all on table public."minds_project_source_ingestions" from anon, authenticated;
grant all on table public."minds_project_source_ingestions" to service_role;
create policy "office_romy_minds_project_source_ingestions_team_select" on public."minds_project_source_ingestions" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_project_source_ingestions" to authenticated;

-- minds_push_subscriptions
revoke all on table public."minds_push_subscriptions" from anon, authenticated;
grant all on table public."minds_push_subscriptions" to service_role;
create policy "office_romy_minds_push_subscriptions_owner_select" on public."minds_push_subscriptions" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_push_subscriptions" to authenticated;

-- minds_review_admission_events
revoke all on table public."minds_review_admission_events" from anon, authenticated;
grant all on table public."minds_review_admission_events" to service_role;
create policy "office_romy_minds_review_admission_events_owner_select" on public."minds_review_admission_events" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_review_admission_events" to authenticated;

-- minds_review_receipts
revoke all on table public."minds_review_receipts" from anon, authenticated;
grant all on table public."minds_review_receipts" to service_role;
create policy "office_romy_minds_review_receipts_owner_select" on public."minds_review_receipts" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_review_receipts" to authenticated;

-- minds_routine_action_receipts
revoke all on table public."minds_routine_action_receipts" from anon, authenticated;
grant all on table public."minds_routine_action_receipts" to service_role;
create policy "office_romy_minds_routine_action_receipts_owner_select" on public."minds_routine_action_receipts" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_routine_action_receipts" to authenticated;

-- minds_routine_deliveries
revoke all on table public."minds_routine_deliveries" from anon, authenticated;
grant all on table public."minds_routine_deliveries" to service_role;
create policy "office_romy_minds_routine_deliveries_owner_select" on public."minds_routine_deliveries" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_routine_deliveries" to authenticated;

-- minds_runtime_capability_grants
revoke all on table public."minds_runtime_capability_grants" from anon, authenticated;
grant all on table public."minds_runtime_capability_grants" to service_role;
create policy "office_romy_minds_runtime_capability_grants_owner_select" on public."minds_runtime_capability_grants" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_runtime_capability_grants" to authenticated;

-- minds_self_review_proposals
revoke all on table public."minds_self_review_proposals" from anon, authenticated;
grant all on table public."minds_self_review_proposals" to service_role;
create policy "office_romy_minds_self_review_proposals_owner_select" on public."minds_self_review_proposals" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_self_review_proposals" to authenticated;

-- minds_self_review_reports
revoke all on table public."minds_self_review_reports" from anon, authenticated;
grant all on table public."minds_self_review_reports" to service_role;
create policy "office_romy_minds_self_review_reports_owner_select" on public."minds_self_review_reports" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_self_review_reports" to authenticated;

-- minds_self_review_settings
revoke all on table public."minds_self_review_settings" from anon, authenticated;
grant all on table public."minds_self_review_settings" to service_role;
create policy "office_romy_minds_self_review_settings_owner_select" on public."minds_self_review_settings" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_self_review_settings" to authenticated;

-- minds_shadow_decisions
revoke all on table public."minds_shadow_decisions" from anon, authenticated;
grant all on table public."minds_shadow_decisions" to service_role;
create policy "office_romy_minds_shadow_decisions_owner_select" on public."minds_shadow_decisions" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_shadow_decisions" to authenticated;

-- minds_skill_proposals
revoke all on table public."minds_skill_proposals" from anon, authenticated;
grant all on table public."minds_skill_proposals" to service_role;
create policy "office_romy_minds_skill_proposals_owner_select" on public."minds_skill_proposals" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_skill_proposals" to authenticated;

-- minds_standing_intents
revoke all on table public."minds_standing_intents" from anon, authenticated;
grant all on table public."minds_standing_intents" to service_role;
create policy "office_romy_minds_standing_intents_owner_select" on public."minds_standing_intents" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_standing_intents" to authenticated;

-- minds_user_skill_versions
revoke all on table public."minds_user_skill_versions" from anon, authenticated;
grant all on table public."minds_user_skill_versions" to service_role;
create policy "office_romy_minds_user_skill_versions_owner_select" on public."minds_user_skill_versions" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_user_skill_versions" to authenticated;

-- minds_user_skills
revoke all on table public."minds_user_skills" from anon, authenticated;
grant all on table public."minds_user_skills" to service_role;
create policy "office_romy_minds_user_skills_owner_select" on public."minds_user_skills" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_user_skills" to authenticated;

-- minds_watch_channels
revoke all on table public."minds_watch_channels" from anon, authenticated;
grant all on table public."minds_watch_channels" to service_role;
create policy "office_romy_minds_watch_channels_owner_select" on public."minds_watch_channels" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_watch_channels" to authenticated;

-- minds_watch_checks
revoke all on table public."minds_watch_checks" from anon, authenticated;
grant all on table public."minds_watch_checks" to service_role;
create policy "office_romy_minds_watch_checks_owner_select" on public."minds_watch_checks" for select to authenticated using (((select auth.uid()) = user_id and (select private.office_is_member())));
grant select on public."minds_watch_checks" to authenticated;

-- minds_work_claim_relations
revoke all on table public."minds_work_claim_relations" from anon, authenticated;
grant all on table public."minds_work_claim_relations" to service_role;
create policy "office_romy_minds_work_claim_relations_team_select" on public."minds_work_claim_relations" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_work_claim_relations" to authenticated;

-- minds_work_claims
revoke all on table public."minds_work_claims" from anon, authenticated;
grant all on table public."minds_work_claims" to service_role;
create policy "office_romy_minds_work_claims_team_select" on public."minds_work_claims" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_work_claims" to authenticated;

-- minds_work_docling_page_chunks
revoke all on table public."minds_work_docling_page_chunks" from anon, authenticated;
grant all on table public."minds_work_docling_page_chunks" to service_role;
create policy "office_romy_minds_work_docling_page_chunks_team_select" on public."minds_work_docling_page_chunks" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_work_docling_page_chunks" to authenticated;

-- minds_work_evidence
revoke all on table public."minds_work_evidence" from anon, authenticated;
grant all on table public."minds_work_evidence" to service_role;
create policy "office_romy_minds_work_evidence_team_select" on public."minds_work_evidence" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_work_evidence" to authenticated;

-- minds_work_ingest_queue
revoke all on table public."minds_work_ingest_queue" from anon, authenticated;
grant all on table public."minds_work_ingest_queue" to service_role;
create policy "office_romy_minds_work_ingest_queue_team_select" on public."minds_work_ingest_queue" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_work_ingest_queue" to authenticated;

-- minds_work_memory
revoke all on table public."minds_work_memory" from anon, authenticated;
grant all on table public."minds_work_memory" to service_role;
create policy "office_romy_minds_work_memory_team_select" on public."minds_work_memory" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_work_memory" to authenticated;

-- minds_work_source_segments
revoke all on table public."minds_work_source_segments" from anon, authenticated;
grant all on table public."minds_work_source_segments" to service_role;
create policy "office_romy_minds_work_source_segments_team_select" on public."minds_work_source_segments" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_work_source_segments" to authenticated;

-- minds_work_source_text_receipts
revoke all on table public."minds_work_source_text_receipts" from anon, authenticated;
grant all on table public."minds_work_source_text_receipts" to service_role;
create policy "office_romy_minds_work_source_text_receipts_team_select" on public."minds_work_source_text_receipts" for select to authenticated using ((project_id is not null and (select private.office_project_team_has_access(project_id))) or (project_id is null and ((select auth.uid()) = user_id and (select private.office_is_member()))));
grant select on public."minds_work_source_text_receipts" to authenticated;

commit;
