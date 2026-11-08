-- Romy · review 08.11.2026 (Claude) · the owner writes the shared engine really makes.
-- isabella-chat, isabella-artifact and the app write these rows with the member's own JWT, exactly
-- as in Window. Phase 1 granted only SELECT, so they failed silently in Office (no memory learning,
-- no follow-ups, no usage). Each grant below has a real call site; rule: own rows only and an active
-- Office member; Akte rows also need the project team.
-- Deliberately NOT here (service-only by the phase-1 design, verified by the acceptance tests):
-- assistant rows, action receipts, direct-create authority, work claims, runtime grants, action
-- policies, secrets. conversation_messages only lets the owner annotate the metadata of their own
-- user turns (the clarification receipt), never write as Romy or as the app.
-- No existing policy is changed or removed.
begin;

-- conversation_messages · isabella-chat: pending clarification on the owner's own turn
grant update (metadata) on table public."conversation_messages" to authenticated;
create policy "office_romy_conversation_messages_owner_turn_metadata" on public."conversation_messages" for update to authenticated using ((select auth.uid()) = user_id and (select private.office_is_member()) and role = 'user') with check ((select auth.uid()) = user_id and (select private.office_is_member()) and role = 'user' and provenance_class = 'owner' and coalesce(metadata->>'author','owner') not in ('system','isabella','romy'));

-- isabella_embeddings · isabella-chat: memory search index (upsert)
grant insert, update on table public."isabella_embeddings" to authenticated;
create policy "office_romy_isabella_embeddings_owner_insert" on public."isabella_embeddings" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()));
create policy "office_romy_isabella_embeddings_owner_update" on public."isabella_embeddings" for update to authenticated using ((select auth.uid()) = user_id and (select private.office_is_member())) with check ((select auth.uid()) = user_id and (select private.office_is_member()));

-- isabella_entities · isabella-chat: people and things she learns
grant insert, update on table public."isabella_entities" to authenticated;
create policy "office_romy_isabella_entities_owner_insert" on public."isabella_entities" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()));
create policy "office_romy_isabella_entities_owner_update" on public."isabella_entities" for update to authenticated using ((select auth.uid()) = user_id and (select private.office_is_member())) with check ((select auth.uid()) = user_id and (select private.office_is_member()));

-- isabella_entity_links · isabella-chat: links between them
grant insert, update on table public."isabella_entity_links" to authenticated;
create policy "office_romy_isabella_entity_links_owner_insert" on public."isabella_entity_links" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()));
create policy "office_romy_isabella_entity_links_owner_update" on public."isabella_entity_links" for update to authenticated using ((select auth.uid()) = user_id and (select private.office_is_member())) with check ((select auth.uid()) = user_id and (select private.office_is_member()));

-- isabella_model_claims · isabella-chat and the memory panel: what she understood
grant insert, update on table public."isabella_model_claims" to authenticated;
create policy "office_romy_isabella_model_claims_owner_insert" on public."isabella_model_claims" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()));
create policy "office_romy_isabella_model_claims_owner_update" on public."isabella_model_claims" for update to authenticated using ((select auth.uid()) = user_id and (select private.office_is_member())) with check ((select auth.uid()) = user_id and (select private.office_is_member()));

-- isabella_skill_runs · isabella-chat: audit of a skill used in a turn
grant insert on table public."isabella_skill_runs" to authenticated;
create policy "office_romy_isabella_skill_runs_owner_insert" on public."isabella_skill_runs" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()));

-- minds_agent_runs · isabella-chat: one row per turn (latency, route)
grant insert, update on table public."minds_agent_runs" to authenticated;
create policy "office_romy_minds_agent_runs_owner_insert" on public."minds_agent_runs" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()));
create policy "office_romy_minds_agent_runs_owner_update" on public."minds_agent_runs" for update to authenticated using ((select auth.uid()) = user_id and (select private.office_is_member())) with check ((select auth.uid()) = user_id and (select private.office_is_member()));

-- minds_ai_usage · isabella-chat and isabella-artifact: token usage
grant insert on table public."minds_ai_usage" to authenticated;
create policy "office_romy_minds_ai_usage_owner_insert" on public."minds_ai_usage" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()));

-- isabella_return_queue · follow-ups she schedules or cancels in the chat; the panel
grant insert, update on table public."isabella_return_queue" to authenticated;
create policy "office_romy_isabella_return_queue_owner_insert" on public."isabella_return_queue" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()));
create policy "office_romy_isabella_return_queue_owner_update" on public."isabella_return_queue" for update to authenticated using ((select auth.uid()) = user_id and (select private.office_is_member())) with check ((select auth.uid()) = user_id and (select private.office_is_member()));

-- minds_artifacts · isabella-artifact: a generated document
grant insert on table public."minds_artifacts" to authenticated;
create policy "office_romy_minds_artifacts_owner_insert" on public."minds_artifacts" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()));

-- isabella_proposal_feedback · sync: how a proposal was reviewed
grant insert on table public."isabella_proposal_feedback" to authenticated;
create policy "office_romy_isabella_proposal_feedback_owner_insert" on public."isabella_proposal_feedback" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()));

-- isabella_routines · the routines panel (pause, edit, remove); creation stays an RPC
grant update, delete on table public."isabella_routines" to authenticated;
create policy "office_romy_isabella_routines_owner_update" on public."isabella_routines" for update to authenticated using ((select auth.uid()) = user_id and (select private.office_is_member())) with check ((select auth.uid()) = user_id and (select private.office_is_member()));
create policy "office_romy_isabella_routines_owner_delete" on public."isabella_routines" for delete to authenticated using ((select auth.uid()) = user_id and (select private.office_is_member()));

-- minds_user_skills · the skills panel
grant insert, update on table public."minds_user_skills" to authenticated;
create policy "office_romy_minds_user_skills_owner_insert" on public."minds_user_skills" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()));
create policy "office_romy_minds_user_skills_owner_update" on public."minds_user_skills" for update to authenticated using ((select auth.uid()) = user_id and (select private.office_is_member())) with check ((select auth.uid()) = user_id and (select private.office_is_member()));

-- minds_work_memory · Work view: confirm or discard own Akte proposals, Steckbrief undo; never delete
grant insert, update on table public."minds_work_memory" to authenticated;
create policy "office_romy_minds_work_memory_owner_insert" on public."minds_work_memory" for insert to authenticated with check ((select auth.uid()) = user_id and (select private.office_is_member()) and (select private.office_project_team_has_access(project_id)));
create policy "office_romy_minds_work_memory_owner_update" on public."minds_work_memory" for update to authenticated using ((select auth.uid()) = user_id and (select private.office_is_member()) and (select private.office_project_team_has_access(project_id))) with check ((select auth.uid()) = user_id and (select private.office_is_member()) and (select private.office_project_team_has_access(project_id)));

commit;
