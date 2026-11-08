-- Office / Romy · Phase 1 · personal and runtime table definitions
-- Metadata-only snapshot of Window public tables (columns, PK, UNIQUE, CHECK).
-- No rows, user content, credentials or key values are copied.
-- Source read-only pg_catalog, 2026-11-08. Review schema drift before applying.
-- Purposefully no DROP/DELETE/TRUNCATE, no existing Office tables are modified.
begin;

create table if not exists public."conversation_messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "model" text,
  "provisional" boolean DEFAULT false NOT NULL,
  "citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "client_key" text NOT NULL,
  "exposure_scope_version" smallint DEFAULT 0 NOT NULL,
  "exposure_scope_kind" text DEFAULT 'global'::text NOT NULL,
  "exposure_scope_ref" text,
  "exposure_scope_key" text DEFAULT 'legacy'::text NOT NULL,
  "provenance_class" text DEFAULT 'owner'::text NOT NULL,
  CONSTRAINT "conversation_messages_client_key_unique" UNIQUE (user_id, conversation_id, client_key),
  CONSTRAINT "conversation_messages_exposure_scope_kind_check" CHECK (exposure_scope_kind = ANY (ARRAY['global'::text, 'project'::text, 'work_thread'::text, 'reading'::text, 'theory'::text])),
  CONSTRAINT "conversation_messages_exposure_scope_version_check" CHECK (exposure_scope_version = ANY (ARRAY[0, 1])),
  CONSTRAINT "conversation_messages_pkey" PRIMARY KEY (id),
  CONSTRAINT "conversation_messages_provenance_class_check" CHECK (provenance_class = ANY (ARRAY['owner'::text, 'agent'::text, 'external'::text, 'system'::text])),
  CONSTRAINT "conversation_messages_role_check" CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text]))
);
alter table public."conversation_messages" enable row level security;

create table if not exists public."conversations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "origin_kind" text DEFAULT 'global'::text NOT NULL,
  "origin_thread_id" uuid,
  "origin_document_id" uuid,
  "origin_anchor" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "title" text DEFAULT 'Nueva conversación'::text NOT NULL,
  "mode" text DEFAULT 'memory'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "app_scope" text NOT NULL,
  "runtime_lease_token" uuid,
  "runtime_lease_until" timestamp with time zone,
  CONSTRAINT "conversations_app_scope_check" CHECK (app_scope = ANY (ARRAY['theory'::text, 'isabella'::text, 'sofia'::text, 'work_thread'::text])),
  CONSTRAINT "conversations_check" CHECK (origin_kind = 'global'::text AND origin_thread_id IS NULL AND origin_document_id IS NULL OR origin_kind = 'mind'::text AND origin_thread_id IS NOT NULL AND origin_document_id IS NULL OR origin_kind = 'reading'::text AND origin_document_id IS NOT NULL AND origin_thread_id IS NULL),
  CONSTRAINT "conversations_id_user_id_key" UNIQUE (id, user_id),
  CONSTRAINT "conversations_mode_check" CHECK (mode = ANY (ARRAY['memory'::text, 'outside'::text])),
  CONSTRAINT "conversations_origin_kind_check" CHECK (origin_kind = ANY (ARRAY['global'::text, 'mind'::text, 'reading'::text])),
  CONSTRAINT "conversations_pkey" PRIMARY KEY (id)
);
alter table public."conversations" enable row level security;

create table if not exists public."isabella_activity_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "entity_type" text NOT NULL,
  "entity_key" text NOT NULL,
  "action" text NOT NULL,
  "source" text DEFAULT 'manual'::text NOT NULL,
  "before_state" jsonb,
  "after_state" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "isabella_activity_log_action_check" CHECK (action = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'complete'::text, 'uncomplete'::text, 'archive'::text, 'restore'::text, 'reorder'::text, 'move_date'::text])),
  CONSTRAINT "isabella_activity_log_entity_type_check" CHECK (entity_type = ANY (ARRAY['task'::text, 'event'::text])),
  CONSTRAINT "isabella_activity_log_pkey" PRIMARY KEY (id),
  CONSTRAINT "isabella_activity_log_source_check" CHECK (source = ANY (ARRAY['manual'::text, 'assistant'::text]))
);
alter table public."isabella_activity_log" enable row level security;

create table if not exists public."isabella_embeddings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "content" text NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "exposure_scope_key" text DEFAULT 'legacy'::text NOT NULL,
  "provenance_class" text DEFAULT 'owner'::text NOT NULL,
  CONSTRAINT "isabella_embeddings_pkey" PRIMARY KEY (id),
  CONSTRAINT "isabella_embeddings_provenance_class_check" CHECK (provenance_class = ANY (ARRAY['owner'::text, 'agent'::text, 'external'::text, 'system'::text])),
  CONSTRAINT "isabella_embeddings_source_type_check" CHECK (source_type = ANY (ARRAY['memory'::text, 'conversation'::text])),
  CONSTRAINT "isabella_embeddings_user_id_source_type_source_id_key" UNIQUE (user_id, source_type, source_id)
);
alter table public."isabella_embeddings" enable row level security;

create table if not exists public."isabella_entities" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "entity_type" text NOT NULL,
  "name" text NOT NULL,
  "normalized_name" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "isabella_entities_pkey" PRIMARY KEY (id),
  CONSTRAINT "isabella_entities_user_id_entity_type_normalized_name_key" UNIQUE (user_id, entity_type, normalized_name)
);
alter table public."isabella_entities" enable row level security;

create table if not exists public."isabella_entity_links" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "subject_entity_id" uuid NOT NULL,
  "predicate" text NOT NULL,
  "object_entity_id" uuid,
  "object_text" text,
  "source_type" text,
  "source_id" text,
  "confidence" real DEFAULT 0.8 NOT NULL,
  "valid_from" timestamp with time zone,
  "valid_to" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "isabella_entity_links_check" CHECK (object_entity_id IS NOT NULL OR NULLIF(TRIM(BOTH FROM object_text), ''::text) IS NOT NULL),
  CONSTRAINT "isabella_entity_links_pkey" PRIMARY KEY (id)
);
alter table public."isabella_entity_links" enable row level security;

create table if not exists public."isabella_followups" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "title" text NOT NULL,
  "due_at" timestamp with time zone,
  "status" text DEFAULT 'open'::text NOT NULL,
  "context" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "client_key" text DEFAULT (gen_random_uuid())::text NOT NULL,
  CONSTRAINT "isabella_followups_pkey" PRIMARY KEY (id),
  CONSTRAINT "isabella_followups_status_check" CHECK (status = ANY (ARRAY['open'::text, 'done'::text, 'dismissed'::text])),
  CONSTRAINT "isabella_followups_user_client_key_key" UNIQUE (user_id, client_key)
);
alter table public."isabella_followups" enable row level security;

create table if not exists public."isabella_memories" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "kind" text NOT NULL,
  "subject" text,
  "content" text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "confidence" numeric(4,3) DEFAULT 1.000 NOT NULL,
  "source" text DEFAULT 'conversation'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "client_key" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "exposure_scope_key" text DEFAULT 'global'::text NOT NULL,
  "provenance_class" text DEFAULT 'owner'::text NOT NULL,
  CONSTRAINT "isabella_memories_confidence_check" CHECK (confidence >= 0::numeric AND confidence <= 1::numeric),
  CONSTRAINT "isabella_memories_kind_check" CHECK (kind = ANY (ARRAY['fact'::text, 'person'::text, 'routine'::text, 'episodic'::text, 'preference'::text, 'context'::text])),
  CONSTRAINT "isabella_memories_pkey" PRIMARY KEY (id),
  CONSTRAINT "isabella_memories_provenance_class_check" CHECK (provenance_class = ANY (ARRAY['owner'::text, 'agent'::text, 'external'::text, 'system'::text])),
  CONSTRAINT "isabella_memories_status_check" CHECK (status = ANY (ARRAY['active'::text, 'corrected'::text, 'rejected'::text, 'archived'::text])),
  CONSTRAINT "isabella_memories_user_client_key_key" UNIQUE (user_id, client_key)
);
alter table public."isabella_memories" enable row level security;

create table if not exists public."isabella_model_claims" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "claim_type" text NOT NULL,
  "claim" text NOT NULL,
  "status" text DEFAULT 'hypothesis'::text NOT NULL,
  "confidence" numeric DEFAULT 0.6 NOT NULL,
  "source_type" text DEFAULT 'inferred'::text NOT NULL,
  "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "confirmed_at" timestamp with time zone,
  "superseded_by" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "isabella_model_claims_claim_type_check" CHECK (claim_type = ANY (ARRAY['preference'::text, 'habit'::text, 'pattern'::text, 'goal'::text, 'priority'::text, 'value'::text, 'working_style'::text, 'interaction'::text, 'constraint'::text, 'other'::text])),
  CONSTRAINT "isabella_model_claims_confidence_check" CHECK (confidence >= 0::numeric AND confidence <= 1::numeric),
  CONSTRAINT "isabella_model_claims_pkey" PRIMARY KEY (id),
  CONSTRAINT "isabella_model_claims_source_type_check" CHECK (source_type = ANY (ARRAY['explicit'::text, 'observed'::text, 'inferred'::text, 'system'::text])),
  CONSTRAINT "isabella_model_claims_status_check" CHECK (status = ANY (ARRAY['hypothesis'::text, 'confirmed'::text, 'contradicted'::text, 'stale'::text]))
);
alter table public."isabella_model_claims" enable row level security;

create table if not exists public."isabella_proposal_feedback" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "outcome" text NOT NULL,
  "proposal" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "isabella_proposal_feedback_outcome_check" CHECK (outcome = ANY (ARRAY['accepted'::text, 'rejected'::text])),
  CONSTRAINT "isabella_proposal_feedback_pkey" PRIMARY KEY (id)
);
alter table public."isabella_proposal_feedback" enable row level security;

create table if not exists public."isabella_return_queue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "kind" text DEFAULT 'idea'::text NOT NULL,
  "reference_id" text,
  "title" text NOT NULL,
  "reason" text NOT NULL,
  "status" text DEFAULT 'waiting'::text NOT NULL,
  "reactivate_after" timestamp with time zone,
  "last_trigger_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "isabella_return_queue_pkey" PRIMARY KEY (id),
  CONSTRAINT "isabella_return_queue_status_check" CHECK (status = ANY (ARRAY['waiting'::text, 'ready'::text, 'returned'::text, 'dismissed'::text]))
);
alter table public."isabella_return_queue" enable row level security;

create table if not exists public."isabella_routines" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "title" text NOT NULL,
  "instruction" text NOT NULL,
  "schedule" jsonb DEFAULT '{"kind": "daily", "time": "08:00"}'::jsonb NOT NULL,
  "timezone" text DEFAULT 'Europe/Berlin'::text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "next_run_at" timestamp with time zone,
  "last_run_at" timestamp with time zone,
  "last_output" text,
  "last_error" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "client_key" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "isabella_routines_pkey" PRIMARY KEY (id),
  CONSTRAINT "isabella_routines_schedule_date_check" CHECK ((schedule ->> 'kind'::text) <> 'once'::text OR (schedule ->> 'date'::text) ~ '^\d{4}-\d{2}-\d{2}$'::text),
  CONSTRAINT "isabella_routines_schedule_kind_check" CHECK ((schedule ->> 'kind'::text) = ANY (ARRAY['once'::text, 'daily'::text, 'weekly'::text])),
  CONSTRAINT "isabella_routines_schedule_time_check" CHECK ((schedule ->> 'time'::text) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text),
  CONSTRAINT "isabella_routines_user_id_client_key_key" UNIQUE (user_id, client_key)
);
alter table public."isabella_routines" enable row level security;

create table if not exists public."isabella_runtime_secrets" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "isabella_runtime_secrets_pkey" PRIMARY KEY (key)
);
alter table public."isabella_runtime_secrets" enable row level security;

create table if not exists public."isabella_skill_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "skill_slug" text NOT NULL,
  "skill_version" integer NOT NULL,
  "conversation_id" text,
  "trigger_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "skill_source" text DEFAULT 'system'::text NOT NULL,
  "skill_name" text,
  CONSTRAINT "isabella_skill_runs_pkey" PRIMARY KEY (id),
  CONSTRAINT "isabella_skill_runs_skill_source_check" CHECK (skill_source = ANY (ARRAY['system'::text, 'personal'::text]))
);
alter table public."isabella_skill_runs" enable row level security;

create table if not exists public."isabella_skills" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "instructions" text NOT NULL,
  "preferred_tools" text[] DEFAULT '{}'::text[] NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "isabella_skills_pkey" PRIMARY KEY (id),
  CONSTRAINT "isabella_skills_slug_key" UNIQUE (slug)
);
alter table public."isabella_skills" enable row level security;

create table if not exists public."isabella_task_reminders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "task_id" uuid NOT NULL,
  "remind_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "isabella_task_reminders_pkey" PRIMARY KEY (id),
  CONSTRAINT "isabella_task_reminders_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'dismissed'::text, 'cancelled'::text]))
);
alter table public."isabella_task_reminders" enable row level security;

create table if not exists public."minds_action_policies" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "app_scope" text DEFAULT 'isabella'::text NOT NULL,
  "action" text NOT NULL,
  "mode" text NOT NULL,
  "reason" text DEFAULT ''::text NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_action_policies_mode_check" CHECK (mode = ANY (ARRAY['allow'::text, 'confirm'::text, 'deny'::text])),
  CONSTRAINT "minds_action_policies_pkey" PRIMARY KEY (id)
);
alter table public."minds_action_policies" enable row level security;

create table if not exists public."minds_agent_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "feature" text NOT NULL,
  "run_key" text,
  "status" text DEFAULT 'running'::text NOT NULL,
  "route" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "latency_ms" integer,
  CONSTRAINT "minds_agent_runs_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_agent_runs_status_check" CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text, 'skipped'::text]))
);
alter table public."minds_agent_runs" enable row level security;

create table if not exists public."minds_ai_usage" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "feature" text NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "cached_input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_ai_usage_pkey" PRIMARY KEY (id)
);
alter table public."minds_ai_usage" enable row level security;

create table if not exists public."minds_artifact_intake" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "execution_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "provider_artifact_id" text NOT NULL,
  "provider_path" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "sha256" text NOT NULL,
  "quarantine_storage_path" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "review_note" text,
  "accepted_artifact_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "expires_at" timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
  "accepted_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "promoted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_artifact_intake_check" CHECK (kind = 'image'::text AND (mime_type = ANY (ARRAY['image/png'::text, 'image/jpeg'::text, 'image/webp'::text])) OR kind = 'docx'::text AND mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text OR kind = 'pdf'::text AND mime_type = 'application/pdf'::text OR kind = 'markdown'::text AND mime_type = 'text/markdown'::text),
  CONSTRAINT "minds_artifact_intake_execution_id_provider_artifact_id_key" UNIQUE (execution_id, provider_artifact_id),
  CONSTRAINT "minds_artifact_intake_kind_check" CHECK (kind = ANY (ARRAY['image'::text, 'docx'::text, 'pdf'::text, 'markdown'::text])),
  CONSTRAINT "minds_artifact_intake_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_artifact_intake_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_artifact_intake_provider_artifact_id_check" CHECK (length(TRIM(BOTH FROM provider_artifact_id)) >= 1 AND length(TRIM(BOTH FROM provider_artifact_id)) <= 500),
  CONSTRAINT "minds_artifact_intake_provider_check" CHECK (provider = 'openai_agents'::text),
  CONSTRAINT "minds_artifact_intake_provider_path_check" CHECK (length(provider_path) >= 1 AND length(provider_path) <= 1200 AND provider_path ~~ '/workspace/outputs/%'::text AND POSITION(('..'::text) IN (provider_path)) = 0),
  CONSTRAINT "minds_artifact_intake_quarantine_storage_path_check" CHECK (length(quarantine_storage_path) >= 1 AND length(quarantine_storage_path) <= 1400 AND POSITION(('..'::text) IN (quarantine_storage_path)) = 0),
  CONSTRAINT "minds_artifact_intake_review_note_check" CHECK (review_note IS NULL OR length(review_note) <= 2000),
  CONSTRAINT "minds_artifact_intake_sha256_check" CHECK (sha256 ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "minds_artifact_intake_size_bytes_check" CHECK (size_bytes >= 1 AND size_bytes <= 20971520),
  CONSTRAINT "minds_artifact_intake_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'promoted'::text, 'failed'::text, 'expired'::text])),
  CONSTRAINT "minds_artifact_intake_title_check" CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 240)
);
alter table public."minds_artifact_intake" enable row level security;

create table if not exists public."minds_artifacts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "workspace_id" uuid,
  "source_kind" text DEFAULT 'chat'::text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "mime_type" text NOT NULL,
  "storage_path" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_artifacts_kind_check" CHECK (kind = ANY (ARRAY['image'::text, 'docx'::text, 'pdf'::text, 'markdown'::text, 'xlsx'::text, 'pptx'::text, 'csv'::text, 'zip'::text, 'html'::text, 'txt'::text, 'json'::text])),
  CONSTRAINT "minds_artifacts_pkey" PRIMARY KEY (id)
);
alter table public."minds_artifacts" enable row level security;

create table if not exists public."minds_attention_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "event_key" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text,
  "event_type" text NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT ''::text NOT NULL,
  "urgency" text DEFAULT 'info'::text NOT NULL,
  "requires_user" boolean DEFAULT false NOT NULL,
  "user_requested" boolean DEFAULT false NOT NULL,
  "deadline_at" timestamp with time zone,
  "route" text NOT NULL,
  "reason_code" text NOT NULL,
  "reason" text NOT NULL,
  "policy_version" text DEFAULT 'attention_v1'::text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "message_id" uuid,
  "surface_item_id" uuid,
  "delivery_ref" text,
  "factors" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "delivered_at" timestamp with time zone,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_revision" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "minds_attention_events_body_check" CHECK (length(body) <= 12000),
  CONSTRAINT "minds_attention_events_factors_check" CHECK (jsonb_typeof(factors) = 'object'::text),
  CONSTRAINT "minds_attention_events_key_check" CHECK (length(TRIM(BOTH FROM event_key)) >= 1 AND length(TRIM(BOTH FROM event_key)) <= 500),
  CONSTRAINT "minds_attention_events_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_attention_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_attention_events_request_revision_check" CHECK (request_revision >= 1),
  CONSTRAINT "minds_attention_events_route_check" CHECK (route = ANY (ARRAY['interrupt'::text, 'briefing'::text, 'ambient'::text, 'silent'::text])),
  CONSTRAINT "minds_attention_events_source_type_check" CHECK (source_type = ANY (ARRAY['mission'::text, 'heartbeat'::text, 'routine'::text, 'system'::text, 'expectation'::text, 'chat'::text])),
  CONSTRAINT "minds_attention_events_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'delivered'::text, 'consumed'::text, 'dismissed'::text, 'resolved'::text, 'suppressed'::text])),
  CONSTRAINT "minds_attention_events_title_check" CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 500),
  CONSTRAINT "minds_attention_events_urgency_check" CHECK (urgency = ANY (ARRAY['info'::text, 'attention'::text, 'urgent'::text])),
  CONSTRAINT "minds_attention_events_user_id_event_key_key" UNIQUE (user_id, event_key)
);
alter table public."minds_attention_events" enable row level security;

create table if not exists public."minds_autonomy_executions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "permission_revision" integer NOT NULL,
  "task_id" uuid NOT NULL,
  "candidate" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_autonomy_executions_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_autonomy_executions_user_id_request_id_key" UNIQUE (user_id, request_id)
);
alter table public."minds_autonomy_executions" enable row level security;

create table if not exists public."minds_calendar_action_receipts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "action" text NOT NULL,
  "entity_kind" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "entity_client_key" text NOT NULL,
  "before_state" jsonb NOT NULL,
  "after_state" jsonb NOT NULL,
  "reviewed_candidate" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_calendar_action_receipts_action_check" CHECK (action = ANY (ARRAY['update_task'::text, 'create_task'::text, 'create_event'::text])),
  CONSTRAINT "minds_calendar_action_receipts_entity_kind_check" CHECK (entity_kind = ANY (ARRAY['task'::text, 'event'::text])),
  CONSTRAINT "minds_calendar_action_receipts_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_calendar_action_receipts_user_id_request_id_key" UNIQUE (user_id, request_id)
);
alter table public."minds_calendar_action_receipts" enable row level security;

create table if not exists public."minds_calendar_execution_preferences" (
  "user_id" uuid NOT NULL,
  "create_mode" text DEFAULT 'review'::text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_calendar_execution_preferences_create_mode_check" CHECK (create_mode = ANY (ARRAY['review'::text, 'direct'::text])),
  CONSTRAINT "minds_calendar_execution_preferences_pkey" PRIMARY KEY (user_id)
);
alter table public."minds_calendar_execution_preferences" enable row level security;

create table if not exists public."minds_capability_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "capability" text NOT NULL,
  "origin_kind" text DEFAULT 'chat'::text NOT NULL,
  "conversation_id" uuid,
  "project_id" uuid,
  "work_thread_id" uuid,
  "title" text NOT NULL,
  "request" text NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "provider" text DEFAULT 'openai_responses'::text NOT NULL,
  "provider_response_id" text,
  "provider_container_id" text,
  "artifact_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  "summary" text DEFAULT ''::text NOT NULL,
  "error" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_capability_runs_capability_check" CHECK (capability = ANY (ARRAY['general_execution'::text, 'image_generation'::text])),
  CONSTRAINT "minds_capability_runs_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_capability_runs_origin_kind_check" CHECK (origin_kind = ANY (ARRAY['chat'::text, 'work_thread'::text, 'mission'::text, 'system'::text])),
  CONSTRAINT "minds_capability_runs_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_capability_runs_provider_check" CHECK (provider = 'openai_responses'::text),
  CONSTRAINT "minds_capability_runs_request_check" CHECK (length(TRIM(BOTH FROM request)) >= 1 AND length(TRIM(BOTH FROM request)) <= 20000),
  CONSTRAINT "minds_capability_runs_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'in_progress'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])),
  CONSTRAINT "minds_capability_runs_title_check" CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 240)
);
alter table public."minds_capability_runs" enable row level security;

create table if not exists public."minds_chat_jobs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "user_message" text NOT NULL,
  "status" text DEFAULT 'preparing'::text NOT NULL,
  "provider_response_id" text,
  "provider_conversation_id" text,
  "agent_run_id" uuid,
  "reply" text,
  "incomplete_reason" text,
  "exposure_scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "model" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_chat_jobs_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_chat_jobs_status_check" CHECK (status = ANY (ARRAY['preparing'::text, 'running'::text, 'completed'::text, 'failed'::text, 'incomplete'::text])),
  CONSTRAINT "minds_chat_jobs_user_id_request_id_key" UNIQUE (user_id, request_id),
  CONSTRAINT "minds_chat_jobs_user_message_check" CHECK (char_length(user_message) >= 1 AND char_length(user_message) <= 16000)
);
alter table public."minds_chat_jobs" enable row level security;

create table if not exists public."minds_chat_stream_delivery_receipts" (
  "user_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "status" text NOT NULL,
  "reply" text NOT NULL,
  "incomplete_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone DEFAULT (now() + '1 day'::interval) NOT NULL,
  "final_delivery" jsonb,
  CONSTRAINT "minds_chat_stream_delivery_receipts_pkey" PRIMARY KEY (user_id, request_id),
  CONSTRAINT "minds_chat_stream_delivery_receipts_status_check" CHECK (status = ANY (ARRAY['completed'::text, 'incomplete'::text]))
);
alter table public."minds_chat_stream_delivery_receipts" enable row level security;

create table if not exists public."minds_commitment_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "commitment_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "body" text DEFAULT ''::text NOT NULL,
  "from_status" text,
  "to_status" text,
  "source_kind" text DEFAULT 'system'::text NOT NULL,
  "source" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_commitment_events_event_type_check" CHECK (event_type = ANY (ARRAY['created'::text, 'open_loop_linked'::text, 'status_changed'::text, 'note'::text, 'signal_linked'::text, 'reactivated'::text, 'completed'::text])),
  CONSTRAINT "minds_commitment_events_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_commitment_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_commitment_events_source_check" CHECK (jsonb_typeof(source) = 'object'::text),
  CONSTRAINT "minds_commitment_events_source_kind_check" CHECK (source_kind = ANY (ARRAY['user'::text, 'conversation'::text, 'checkpoint'::text, 'project'::text, 'heartbeat'::text, 'work'::text, 'routine'::text, 'system'::text]))
);
alter table public."minds_commitment_events" enable row level security;

create table if not exists public."minds_commitment_signal_links" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "commitment_id" uuid NOT NULL,
  "signal_id" uuid NOT NULL,
  "match_kind" text NOT NULL,
  "relevance" numeric(4,3) NOT NULL,
  "reason" text DEFAULT ''::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_commitment_signal_links_commitment_id_signal_id_key" UNIQUE (commitment_id, signal_id),
  CONSTRAINT "minds_commitment_signal_links_match_kind_check" CHECK (match_kind = ANY (ARRAY['explicit'::text, 'project'::text, 'terms'::text])),
  CONSTRAINT "minds_commitment_signal_links_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_commitment_signal_links_relevance_check" CHECK (relevance >= 0::numeric AND relevance <= 1::numeric)
);
alter table public."minds_commitment_signal_links" enable row level security;

create table if not exists public."minds_commitment_workspace_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "kind" text NOT NULL,
  "status" text DEFAULT 'working'::text NOT NULL,
  "content" text NOT NULL,
  "provenance_class" text DEFAULT 'agent'::text NOT NULL,
  "source_kind" text DEFAULT 'conversation'::text NOT NULL,
  "source_ref" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_commitment_workspace_items_content_check" CHECK (length(TRIM(BOTH FROM content)) >= 1 AND length(TRIM(BOTH FROM content)) <= 16000),
  CONSTRAINT "minds_commitment_workspace_items_kind_check" CHECK (kind = ANY (ARRAY['plan'::text, 'finding'::text, 'source'::text, 'question'::text, 'decision'::text, 'note'::text])),
  CONSTRAINT "minds_commitment_workspace_items_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_commitment_workspace_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_commitment_workspace_items_provenance_class_check" CHECK (provenance_class = ANY (ARRAY['user'::text, 'project_source'::text, 'external'::text, 'inferred'::text, 'agent'::text])),
  CONSTRAINT "minds_commitment_workspace_items_source_kind_check" CHECK (source_kind = ANY (ARRAY['user'::text, 'conversation'::text, 'work'::text, 'document'::text, 'web'::text, 'specialist'::text, 'system'::text])),
  CONSTRAINT "minds_commitment_workspace_items_status_check" CHECK (status = ANY (ARRAY['working'::text, 'proposed'::text, 'confirmed'::text, 'resolved'::text, 'superseded'::text]))
);
alter table public."minds_commitment_workspace_items" enable row level security;

create table if not exists public."minds_commitment_workspaces" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "commitment_id" uuid NOT NULL,
  "project_id" uuid,
  "title" text NOT NULL,
  "objective_snapshot" text NOT NULL,
  "completion_criteria_snapshot" text,
  "status" text DEFAULT 'active'::text NOT NULL,
  "summary" text DEFAULT ''::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_commitment_workspaces_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_commitment_workspaces_objective_check" CHECK (length(TRIM(BOTH FROM objective_snapshot)) >= 1 AND length(TRIM(BOTH FROM objective_snapshot)) <= 6000),
  CONSTRAINT "minds_commitment_workspaces_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_commitment_workspaces_status_check" CHECK (status = ANY (ARRAY['active'::text, 'paused'::text, 'done'::text, 'archived'::text])),
  CONSTRAINT "minds_commitment_workspaces_summary_check" CHECK (length(summary) <= 12000),
  CONSTRAINT "minds_commitment_workspaces_title_check" CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 400)
);
alter table public."minds_commitment_workspaces" enable row level security;

create table if not exists public."minds_commitments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "agent" text DEFAULT 'isabella'::text NOT NULL,
  "title" text NOT NULL,
  "objective" text NOT NULL,
  "scope" text DEFAULT 'global'::text NOT NULL,
  "project_id" uuid,
  "status" text DEFAULT 'active'::text NOT NULL,
  "completion_criteria" text,
  "source_kind" text DEFAULT 'user'::text NOT NULL,
  "source_conversation_id" uuid,
  "source_flush_id" uuid,
  "source_open_loop" text,
  "request_id" uuid NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_commitments_agent_check" CHECK (agent = ANY (ARRAY['isabella'::text, 'sofia'::text])),
  CONSTRAINT "minds_commitments_check" CHECK (scope <> 'project'::text OR project_id IS NOT NULL),
  CONSTRAINT "minds_commitments_check1" CHECK (source_flush_id IS NULL AND source_open_loop IS NULL OR source_flush_id IS NOT NULL AND source_open_loop IS NOT NULL),
  CONSTRAINT "minds_commitments_completion_criteria_check" CHECK (completion_criteria IS NULL OR length(completion_criteria) <= 4000),
  CONSTRAINT "minds_commitments_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_commitments_objective_check" CHECK (length(TRIM(BOTH FROM objective)) >= 1 AND length(TRIM(BOTH FROM objective)) <= 6000),
  CONSTRAINT "minds_commitments_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_commitments_scope_check" CHECK (scope = ANY (ARRAY['global'::text, 'personal'::text, 'project'::text, 'theory'::text, 'other'::text])),
  CONSTRAINT "minds_commitments_source_kind_check" CHECK (source_kind = ANY (ARRAY['user'::text, 'conversation'::text, 'checkpoint'::text, 'project'::text, 'system'::text])),
  CONSTRAINT "minds_commitments_status_check" CHECK (status = ANY (ARRAY['active'::text, 'waiting'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])),
  CONSTRAINT "minds_commitments_title_check" CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 400)
);
alter table public."minds_commitments" enable row level security;

create table if not exists public."minds_contextual_permissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "action" text NOT NULL,
  "context_key" text NOT NULL,
  "scope_key" text NOT NULL,
  "scope_label" text NOT NULL,
  "mode" text DEFAULT 'confirm'::text NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  CONSTRAINT "minds_contextual_permissions_mode_check" CHECK (mode = ANY (ARRAY['confirm'::text, 'allow'::text])),
  CONSTRAINT "minds_contextual_permissions_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_contextual_permissions_user_id_action_context_key_sco_key" UNIQUE (user_id, action, context_key, scope_key)
);
alter table public."minds_contextual_permissions" enable row level security;

create table if not exists public."minds_continuity_signals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "source_kind" text NOT NULL,
  "source_id" text,
  "fingerprint" text NOT NULL,
  "event_type" text NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT ''::text NOT NULL,
  "project_id" uuid,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "minds_continuity_signals_event_type_check" CHECK (length(TRIM(BOTH FROM event_type)) >= 1 AND length(TRIM(BOTH FROM event_type)) <= 120),
  CONSTRAINT "minds_continuity_signals_fingerprint_check" CHECK (length(TRIM(BOTH FROM fingerprint)) >= 1 AND length(TRIM(BOTH FROM fingerprint)) <= 500),
  CONSTRAINT "minds_continuity_signals_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_continuity_signals_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_continuity_signals_source_kind_check" CHECK (source_kind = ANY (ARRAY['heartbeat'::text, 'work'::text, 'conversation'::text, 'routine'::text, 'project'::text, 'system'::text])),
  CONSTRAINT "minds_continuity_signals_title_check" CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 500),
  CONSTRAINT "minds_continuity_signals_user_id_fingerprint_key" UNIQUE (user_id, fingerprint)
);
alter table public."minds_continuity_signals" enable row level security;

create table if not exists public."minds_delivery_attempts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "intent_id" uuid NOT NULL,
  "subscription_id" uuid,
  "status" text NOT NULL,
  "http_status" integer,
  "error" text,
  "endpoint_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_delivery_attempts_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_delivery_attempts_status_check" CHECK (status = ANY (ARRAY['accepted'::text, 'gone'::text, 'failed'::text]))
);
alter table public."minds_delivery_attempts" enable row level security;

create table if not exists public."minds_delivery_intents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "attention_event_id" uuid NOT NULL,
  "channel" text DEFAULT 'web_push'::text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
  "lease_token" uuid,
  "lease_until" timestamp with time zone,
  "last_error" text,
  "sent_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_delivery_intents_attempt_count_check" CHECK (attempt_count >= 0),
  CONSTRAINT "minds_delivery_intents_attention_event_id_channel_key" UNIQUE (attention_event_id, channel),
  CONSTRAINT "minds_delivery_intents_channel_check" CHECK (channel = 'web_push'::text),
  CONSTRAINT "minds_delivery_intents_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_delivery_intents_payload_check" CHECK (jsonb_typeof(payload) = 'object'::text),
  CONSTRAINT "minds_delivery_intents_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_delivery_intents_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'retry'::text, 'sent'::text, 'failed'::text, 'skipped'::text]))
);
alter table public."minds_delivery_intents" enable row level security;

create table if not exists public."minds_expectation_reviews" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "expectation_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "decision" text NOT NULL,
  "from_status" text NOT NULL,
  "to_status" text NOT NULL,
  "previous_due_at" timestamp with time zone NOT NULL,
  "next_due_at" timestamp with time zone,
  "occurred_at" timestamp with time zone,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_expectation_reviews_decision_check" CHECK (decision = ANY (ARRAY['fulfilled'::text, 'not_occurred'::text, 'cancel'::text, 'reschedule'::text])),
  CONSTRAINT "minds_expectation_reviews_note_check" CHECK (length(COALESCE(note, ''::text)) <= 4000),
  CONSTRAINT "minds_expectation_reviews_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_expectation_reviews_user_id_request_id_key" UNIQUE (user_id, request_id)
);
alter table public."minds_expectation_reviews" enable row level security;

create table if not exists public."minds_expectations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "project_id" uuid,
  "title" text NOT NULL,
  "expected_event" text NOT NULL,
  "expectation_type" text DEFAULT 'other'::text NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "due_precision" text DEFAULT 'date'::text NOT NULL,
  "timezone" text DEFAULT 'Europe/Berlin'::text NOT NULL,
  "observability" text DEFAULT 'manual'::text NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "source_kind" text DEFAULT 'conversation'::text NOT NULL,
  "source_ref" text,
  "due_detected_at" timestamp with time zone,
  "fulfilled_at" timestamp with time zone,
  "not_occurred_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolution_source" text,
  CONSTRAINT "minds_expectations_due_precision_check" CHECK (due_precision = ANY (ARRAY['date'::text, 'datetime'::text])),
  CONSTRAINT "minds_expectations_expectation_type_check" CHECK (expectation_type = ANY (ARRAY['reply'::text, 'delivery'::text, 'decision'::text, 'document'::text, 'external_event'::text, 'other'::text])),
  CONSTRAINT "minds_expectations_expected_event_check" CHECK (length(TRIM(BOTH FROM expected_event)) >= 1 AND length(TRIM(BOTH FROM expected_event)) <= 4000),
  CONSTRAINT "minds_expectations_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_expectations_observability_check" CHECK (observability = 'manual'::text),
  CONSTRAINT "minds_expectations_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_expectations_resolution_source_check" CHECK (resolution_source IS NULL OR (resolution_source = ANY (ARRAY['user'::text, 'observable_source'::text]))),
  CONSTRAINT "minds_expectations_source_kind_check" CHECK (source_kind = ANY (ARRAY['conversation'::text, 'work'::text, 'external'::text, 'manual'::text, 'system'::text])),
  CONSTRAINT "minds_expectations_status_check" CHECK (status = ANY (ARRAY['active'::text, 'due_unconfirmed'::text, 'fulfilled'::text, 'not_occurred'::text, 'cancelled'::text])),
  CONSTRAINT "minds_expectations_timezone_check" CHECK (length(timezone) >= 1 AND length(timezone) <= 100),
  CONSTRAINT "minds_expectations_title_check" CHECK (length(TRIM(BOTH FROM title)) >= 1 AND length(TRIM(BOTH FROM title)) <= 500),
  CONSTRAINT "minds_expectations_user_id_request_id_key" UNIQUE (user_id, request_id)
);
alter table public."minds_expectations" enable row level security;

create table if not exists public."minds_exposure_receipts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "run_id" uuid,
  "channel" text NOT NULL,
  "active_scope_key" text NOT NULL,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "source_scope_key" text NOT NULL,
  "provenance_class" text NOT NULL,
  "admitted_reason" text NOT NULL,
  "query_fingerprint" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_exposure_receipts_admitted_reason_check" CHECK (admitted_reason = ANY (ARRAY['current_scope'::text, 'global_layer'::text, 'explicit_cross_scope'::text, 'system_layer'::text])),
  CONSTRAINT "minds_exposure_receipts_channel_check" CHECK (channel = ANY (ARRAY['lexical'::text, 'semantic'::text, 'entity'::text, 'work'::text, 'sofia'::text, 'tool'::text])),
  CONSTRAINT "minds_exposure_receipts_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_exposure_receipts_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_exposure_receipts_provenance_class_check" CHECK (provenance_class = ANY (ARRAY['owner'::text, 'agent'::text, 'external'::text, 'system'::text, 'unknown'::text]))
);
alter table public."minds_exposure_receipts" enable row level security;

create table if not exists public."minds_heartbeat_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "fingerprint" text NOT NULL,
  "severity" text DEFAULT 'info'::text NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'new'::text NOT NULL,
  "project_id" uuid,
  "source" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "surfaced_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "minds_heartbeat_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_heartbeat_events_severity_check" CHECK (severity = ANY (ARRAY['info'::text, 'attention'::text, 'urgent'::text])),
  CONSTRAINT "minds_heartbeat_events_status_check" CHECK (status = ANY (ARRAY['new'::text, 'surfaced'::text, 'dismissed'::text, 'resolved'::text])),
  CONSTRAINT "minds_heartbeat_events_user_id_fingerprint_key" UNIQUE (user_id, fingerprint)
);
alter table public."minds_heartbeat_events" enable row level security;

create table if not exists public."minds_intent_deliveries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "intent_id" uuid NOT NULL,
  "run_key" text NOT NULL,
  "delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "mode" text DEFAULT 'reminder'::text NOT NULL,
  "channel_kind" text DEFAULT 'conversation'::text NOT NULL,
  "fired_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_intent_deliveries_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_intent_deliveries_user_id_intent_id_run_key_key" UNIQUE (user_id, intent_id, run_key)
);
alter table public."minds_intent_deliveries" enable row level security;

create table if not exists public."minds_memory_flushes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "agent" text DEFAULT 'isabella'::text NOT NULL,
  "conversation_id" uuid,
  "checkpoint_message_at" timestamp with time zone,
  "summary" text NOT NULL,
  "open_loops" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "checkpoint_message_id" uuid,
  "source_message_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  CONSTRAINT "minds_memory_flushes_agent_check" CHECK (agent = ANY (ARRAY['isabella'::text, 'sofia'::text])),
  CONSTRAINT "minds_memory_flushes_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_memory_flushes_status_check" CHECK (status = ANY (ARRAY['active'::text, 'superseded'::text, 'discarded'::text]))
);
alter table public."minds_memory_flushes" enable row level security;

create table if not exists public."minds_memory_forget_tombstones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "source_kind" text NOT NULL,
  "source_id" text NOT NULL,
  "reason" text DEFAULT 'user_forget'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "forgotten_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_memory_forget_tombstone_user_id_source_kind_source_id_key" UNIQUE (user_id, source_kind, source_id),
  CONSTRAINT "minds_memory_forget_tombstones_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_memory_forget_tombstones_pkey" PRIMARY KEY (id)
);
alter table public."minds_memory_forget_tombstones" enable row level security;

create table if not exists public."minds_memory_lineage" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "source_kind" text NOT NULL,
  "source_id" text NOT NULL,
  "child_kind" text NOT NULL,
  "child_id" text NOT NULL,
  "source_scope_key" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "invalidated_at" timestamp with time zone,
  "invalidation_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_memory_lineage_child_kind_check" CHECK (child_kind = ANY (ARRAY['memory'::text, 'model_claim'::text, 'entity'::text, 'entity_link'::text])),
  CONSTRAINT "minds_memory_lineage_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_memory_lineage_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_memory_lineage_source_kind_check" CHECK (source_kind = ANY (ARRAY['agent_run'::text, 'conversation'::text, 'memory'::text, 'model_claim'::text, 'entity'::text, 'entity_link'::text])),
  CONSTRAINT "minds_memory_lineage_user_id_source_kind_source_id_child_ki_key" UNIQUE (user_id, source_kind, source_id, child_kind, child_id)
);
alter table public."minds_memory_lineage" enable row level security;

create table if not exists public."minds_mission_run_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_mission_run_events_event_type_check" CHECK (event_type = ANY (ARRAY['queued'::text, 'claimed'::text, 'checkpoint'::text, 'waiting'::text, 'reactivated'::text, 'waiting_for_user'::text, 'completed'::text, 'failed'::text, 'retry_scheduled'::text, 'paused'::text, 'resumed'::text, 'cancelled'::text, 'user_input'::text, 'delivered'::text])),
  CONSTRAINT "minds_mission_run_events_payload_check" CHECK (jsonb_typeof(payload) = 'object'::text),
  CONSTRAINT "minds_mission_run_events_pkey" PRIMARY KEY (id)
);
alter table public."minds_mission_run_events" enable row level security;

create table if not exists public."minds_mission_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "instruction" text NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "phase" text DEFAULT 'queued'::text NOT NULL,
  "iteration" integer DEFAULT 0 NOT NULL,
  "max_iterations" integer DEFAULT 4 NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now(),
  "lease_token" uuid,
  "lease_until" timestamp with time zone,
  "result_summary" text DEFAULT ''::text NOT NULL,
  "blocker_question" text,
  "last_error" text,
  "sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "notified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "wait_kind" text,
  "wait_ref" text,
  "wake_at" timestamp with time zone,
  CONSTRAINT "minds_mission_runs_blocker_check" CHECK (blocker_question IS NULL OR length(blocker_question) <= 4000),
  CONSTRAINT "minds_mission_runs_instruction_check" CHECK (length(TRIM(BOTH FROM instruction)) >= 1 AND length(TRIM(BOTH FROM instruction)) <= 6000),
  CONSTRAINT "minds_mission_runs_iteration_check" CHECK (iteration >= 0 AND iteration <= 64),
  CONSTRAINT "minds_mission_runs_max_iterations_check" CHECK (max_iterations >= 1 AND max_iterations <= 32),
  CONSTRAINT "minds_mission_runs_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_mission_runs_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_mission_runs_retry_count_check" CHECK (retry_count >= 0 AND retry_count <= 8),
  CONSTRAINT "minds_mission_runs_sources_check" CHECK (jsonb_typeof(sources) = 'array'::text),
  CONSTRAINT "minds_mission_runs_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'waiting'::text, 'waiting_for_user'::text, 'paused'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])),
  CONSTRAINT "minds_mission_runs_summary_check" CHECK (length(result_summary) <= 12000),
  CONSTRAINT "minds_mission_runs_user_id_request_id_key" UNIQUE (user_id, request_id),
  CONSTRAINT "minds_mission_runs_wait_kind_check" CHECK (wait_kind IS NULL OR (wait_kind = ANY (ARRAY['time'::text, 'capability'::text, 'expectation'::text])))
);
alter table public."minds_mission_runs" enable row level security;

create table if not exists public."minds_mission_runtime_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "execution_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "provider_turn_id" text,
  "provider_event_id" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_mission_runtime_events_event_type_check" CHECK (length(TRIM(BOTH FROM event_type)) >= 1 AND length(TRIM(BOTH FROM event_type)) <= 120),
  CONSTRAINT "minds_mission_runtime_events_payload_check" CHECK (jsonb_typeof(payload) = 'object'::text),
  CONSTRAINT "minds_mission_runtime_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_mission_runtime_events_provider_event_id_check" CHECK (provider_event_id IS NULL OR length(provider_event_id) <= 500),
  CONSTRAINT "minds_mission_runtime_events_provider_turn_id_check" CHECK (provider_turn_id IS NULL OR length(provider_turn_id) <= 500)
);
alter table public."minds_mission_runtime_events" enable row level security;

create table if not exists public."minds_mission_runtime_executions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "mission_run_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "mode" text NOT NULL,
  "lifecycle" text DEFAULT 'created'::text NOT NULL,
  "provider_session_id" text,
  "provider_turn_id" text,
  "snapshot_hash" text,
  "result_status" text,
  "usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_error" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "result_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "minds_mission_runtime_executio_mission_run_id_provider_mode_key" UNIQUE (mission_run_id, provider, mode),
  CONSTRAINT "minds_mission_runtime_executions_last_error_check" CHECK (last_error IS NULL OR length(last_error) <= 8000),
  CONSTRAINT "minds_mission_runtime_executions_lifecycle_check" CHECK (lifecycle = ANY (ARRAY['created'::text, 'running'::text, 'succeeded'::text, 'action_required'::text, 'failed'::text, 'stopped'::text])),
  CONSTRAINT "minds_mission_runtime_executions_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_mission_runtime_executions_mode_check" CHECK (mode = ANY (ARRAY['primary'::text, 'shadow'::text])),
  CONSTRAINT "minds_mission_runtime_executions_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_mission_runtime_executions_provider_check" CHECK (provider = ANY (ARRAY['native_minds'::text, 'openai_agents'::text])),
  CONSTRAINT "minds_mission_runtime_executions_provider_session_id_check" CHECK (provider_session_id IS NULL OR length(provider_session_id) <= 500),
  CONSTRAINT "minds_mission_runtime_executions_provider_turn_id_check" CHECK (provider_turn_id IS NULL OR length(provider_turn_id) <= 500),
  CONSTRAINT "minds_mission_runtime_executions_result_payload_check" CHECK (jsonb_typeof(result_payload) = 'object'::text),
  CONSTRAINT "minds_mission_runtime_executions_result_status_check" CHECK (result_status IS NULL OR (result_status = ANY (ARRAY['continue'::text, 'waiting_for_user'::text, 'completed'::text, 'failed'::text]))),
  CONSTRAINT "minds_mission_runtime_executions_snapshot_hash_check" CHECK (snapshot_hash IS NULL OR length(snapshot_hash) <= 128),
  CONSTRAINT "minds_mission_runtime_executions_usage_check" CHECK (jsonb_typeof(usage) = 'object'::text)
);
alter table public."minds_mission_runtime_executions" enable row level security;

create table if not exists public."minds_model_claim_reviews" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "claim_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "decision" text NOT NULL,
  "replacement_claim_id" uuid,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_model_claim_reviews_decision_check" CHECK (decision = ANY (ARRAY['confirmed'::text, 'contradicted'::text, 'stale'::text])),
  CONSTRAINT "minds_model_claim_reviews_note_check" CHECK (note IS NULL OR length(note) <= 2000),
  CONSTRAINT "minds_model_claim_reviews_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_model_claim_reviews_user_id_request_id_key" UNIQUE (user_id, request_id)
);
alter table public."minds_model_claim_reviews" enable row level security;

create table if not exists public."minds_model_independence_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "experiment_kind" text NOT NULL,
  "fixture_version" text NOT NULL,
  "relationship_policy_version" text NOT NULL,
  "relationship_policy_hash" text NOT NULL,
  "input_hash" text NOT NULL,
  "model_a" text NOT NULL,
  "model_b" text NOT NULL,
  "input_snapshot" jsonb NOT NULL,
  "output_a" jsonb,
  "output_b" jsonb,
  "metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "error" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_model_independence_runs_experiment_kind_check" CHECK (experiment_kind = ANY (ARRAY['model_swap'::text, 'cold_reconstruction'::text])),
  CONSTRAINT "minds_model_independence_runs_input_hash_check" CHECK (input_hash ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "minds_model_independence_runs_input_snapshot_check" CHECK (jsonb_typeof(input_snapshot) = 'object'::text),
  CONSTRAINT "minds_model_independence_runs_metrics_check" CHECK (jsonb_typeof(metrics) = 'object'::text),
  CONSTRAINT "minds_model_independence_runs_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_model_independence_runs_relationship_policy_hash_check" CHECK (relationship_policy_hash ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "minds_model_independence_runs_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text]))
);
alter table public."minds_model_independence_runs" enable row level security;

create table if not exists public."minds_operating_model_evidence" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "hypothesis_id" uuid NOT NULL,
  "observation_id" uuid NOT NULL,
  "stance" text DEFAULT 'supports'::text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_operating_model_evidence_hypothesis_id_observation_id_key" UNIQUE (hypothesis_id, observation_id),
  CONSTRAINT "minds_operating_model_evidence_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_operating_model_evidence_stance_check" CHECK (stance = ANY (ARRAY['supports'::text, 'contradicts'::text, 'context'::text]))
);
alter table public."minds_operating_model_evidence" enable row level security;

create table if not exists public."minds_operating_model_hypotheses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "dimension" text NOT NULL,
  "claim_type" text NOT NULL,
  "statement" text NOT NULL,
  "inference_kind" text NOT NULL,
  "pattern_key" text NOT NULL,
  "rationale" text DEFAULT ''::text NOT NULL,
  "evidence_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'proposed'::text NOT NULL,
  "accepted_claim_id" uuid,
  "proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "superseded_by" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_operating_model_hypotheses_claim_type_check" CHECK (claim_type = ANY (ARRAY['preference'::text, 'habit'::text, 'pattern'::text, 'goal'::text, 'priority'::text, 'value'::text, 'working_style'::text, 'interaction'::text, 'constraint'::text, 'other'::text])),
  CONSTRAINT "minds_operating_model_hypotheses_dimension_check" CHECK (dimension = ANY (ARRAY['scheduling'::text, 'task_management'::text, 'work_rhythm'::text, 'interruptions'::text, 'planning'::text, 'decision_style'::text, 'communication'::text, 'tooling'::text, 'review'::text])),
  CONSTRAINT "minds_operating_model_hypotheses_evidence_summary_check" CHECK (jsonb_typeof(evidence_summary) = 'object'::text),
  CONSTRAINT "minds_operating_model_hypotheses_inference_kind_check" CHECK (inference_kind = ANY (ARRAY['conversation_inference'::text, 'deterministic_pattern'::text])),
  CONSTRAINT "minds_operating_model_hypotheses_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_operating_model_hypotheses_pattern_key_check" CHECK (length(pattern_key) >= 1 AND length(pattern_key) <= 240),
  CONSTRAINT "minds_operating_model_hypotheses_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_operating_model_hypotheses_rationale_check" CHECK (length(rationale) <= 4000),
  CONSTRAINT "minds_operating_model_hypotheses_statement_check" CHECK (length(TRIM(BOTH FROM statement)) >= 1 AND length(TRIM(BOTH FROM statement)) <= 2000),
  CONSTRAINT "minds_operating_model_hypotheses_status_check" CHECK (status = ANY (ARRAY['proposed'::text, 'accepted'::text, 'rejected'::text, 'superseded'::text, 'stale'::text]))
);
alter table public."minds_operating_model_hypotheses" enable row level security;

create table if not exists public."minds_operating_model_observations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "dimension" text NOT NULL,
  "signal_type" text NOT NULL,
  "source_kind" text NOT NULL,
  "source_ref" text,
  "signal" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "fingerprint" text NOT NULL,
  "observed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_operating_model_observations_dimension_check" CHECK (dimension = ANY (ARRAY['scheduling'::text, 'task_management'::text, 'work_rhythm'::text, 'interruptions'::text, 'planning'::text, 'decision_style'::text, 'communication'::text, 'tooling'::text, 'review'::text])),
  CONSTRAINT "minds_operating_model_observations_fingerprint_check" CHECK (fingerprint ~ '^[0-9a-f]{32}$'::text),
  CONSTRAINT "minds_operating_model_observations_payload_check" CHECK (jsonb_typeof(payload) = 'object'::text),
  CONSTRAINT "minds_operating_model_observations_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_operating_model_observations_signal_check" CHECK (length(TRIM(BOTH FROM signal)) >= 1 AND length(TRIM(BOTH FROM signal)) <= 2000),
  CONSTRAINT "minds_operating_model_observations_signal_type_check" CHECK (signal_type = ANY (ARRAY['explicit_statement'::text, 'conversation_inference'::text, 'proposal_outcome'::text, 'confirmed_correction'::text, 'manual_correction'::text, 'pattern_summary'::text])),
  CONSTRAINT "minds_operating_model_observations_source_kind_check" CHECK (source_kind = ANY (ARRAY['conversation'::text, 'shadow_decision'::text, 'proposal_feedback'::text, 'outcome_feedback'::text, 'manual'::text, 'system'::text])),
  CONSTRAINT "minds_operating_model_observations_user_id_fingerprint_key" UNIQUE (user_id, fingerprint)
);
alter table public."minds_operating_model_observations" enable row level security;

create table if not exists public."minds_operating_model_reviews" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "hypothesis_id" uuid NOT NULL,
  "decision" text NOT NULL,
  "replacement_statement" text,
  "resulting_claim_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_id" uuid,
  CONSTRAINT "minds_operating_model_reviews_check" CHECK (decision = 'replace'::text AND replacement_statement IS NOT NULL AND length(TRIM(BOTH FROM replacement_statement)) > 0 OR decision <> 'replace'::text AND replacement_statement IS NULL),
  CONSTRAINT "minds_operating_model_reviews_decision_check" CHECK (decision = ANY (ARRAY['accept'::text, 'reject'::text, 'replace'::text, 'retire'::text])),
  CONSTRAINT "minds_operating_model_reviews_pkey" PRIMARY KEY (id)
);
alter table public."minds_operating_model_reviews" enable row level security;

create table if not exists public."minds_outcome_feedback" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "candidate_id" uuid NOT NULL,
  "autonomy_execution_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "permission_revision" integer NOT NULL,
  "action" text NOT NULL,
  "context_key" text NOT NULL,
  "scope_key" text NOT NULL,
  "scope_label" text NOT NULL,
  "feedback_type" text NOT NULL,
  "changed_fields" text[] NOT NULL,
  "before_state" jsonb,
  "after_state" jsonb,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_outcome_feedback_autonomy_execution_id_key" UNIQUE (autonomy_execution_id),
  CONSTRAINT "minds_outcome_feedback_candidate_id_key" UNIQUE (candidate_id),
  CONSTRAINT "minds_outcome_feedback_changed_fields_check" CHECK (cardinality(changed_fields) > 0),
  CONSTRAINT "minds_outcome_feedback_evidence_check" CHECK (jsonb_typeof(evidence) = 'object'::text),
  CONSTRAINT "minds_outcome_feedback_feedback_type_check" CHECK (feedback_type = ANY (ARRAY['corrected'::text, 'reverted'::text])),
  CONSTRAINT "minds_outcome_feedback_pkey" PRIMARY KEY (id)
);
alter table public."minds_outcome_feedback" enable row level security;

create table if not exists public."minds_permission_reviews" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "decision" text NOT NULL,
  "previous_mode" text NOT NULL,
  "revision" integer NOT NULL,
  "evidence" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_permission_reviews_decision_check" CHECK (decision = ANY (ARRAY['allow'::text, 'confirm'::text])),
  CONSTRAINT "minds_permission_reviews_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_permission_reviews_user_id_request_id_key" UNIQUE (user_id, request_id)
);
alter table public."minds_permission_reviews" enable row level security;

create table if not exists public."minds_post_action_feedback_candidates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "autonomy_execution_id" uuid NOT NULL,
  "activity_id" uuid,
  "permission_id" uuid NOT NULL,
  "permission_revision" integer NOT NULL,
  "action" text NOT NULL,
  "context_key" text NOT NULL,
  "scope_key" text NOT NULL,
  "scope_label" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_key" text NOT NULL,
  "mutation_action" text NOT NULL,
  "changed_fields" text[] NOT NULL,
  "before_state" jsonb,
  "after_state" jsonb,
  "detection_reason" text DEFAULT 'first_manual_mutation_after_autonomy_v1'::text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "review_note" text,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_post_action_feedback_candidates_activity_id_key" UNIQUE (activity_id),
  CONSTRAINT "minds_post_action_feedback_candidates_autonomy_execution_id_key" UNIQUE (autonomy_execution_id),
  CONSTRAINT "minds_post_action_feedback_candidates_changed_fields_check" CHECK (cardinality(changed_fields) > 0),
  CONSTRAINT "minds_post_action_feedback_candidates_entity_type_check" CHECK (entity_type = 'task'::text),
  CONSTRAINT "minds_post_action_feedback_candidates_mutation_action_check" CHECK (mutation_action = ANY (ARRAY['update'::text, 'delete'::text])),
  CONSTRAINT "minds_post_action_feedback_candidates_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_post_action_feedback_candidates_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'confirmed_correction'::text, 'not_causal'::text, 'expired'::text]))
);
alter table public."minds_post_action_feedback_candidates" enable row level security;

create table if not exists public."minds_push_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth_key" text NOT NULL,
  "expiration_time" bigint,
  "user_agent" text,
  "platform" text,
  "display_mode" text,
  "active" boolean DEFAULT true NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_push_subscriptions_endpoint_check" CHECK (endpoint ~ '^https://'::text),
  CONSTRAINT "minds_push_subscriptions_keys_check" CHECK (length(p256dh) >= 20 AND length(p256dh) <= 1000 AND length(auth_key) >= 8 AND length(auth_key) <= 500),
  CONSTRAINT "minds_push_subscriptions_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_push_subscriptions_user_id_endpoint_key" UNIQUE (user_id, endpoint)
);
alter table public."minds_push_subscriptions" enable row level security;

create table if not exists public."minds_review_admission_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "action" text NOT NULL,
  "proposal_kind" text NOT NULL,
  "outcome" text NOT NULL,
  "reason_code" text NOT NULL,
  "semantic_fingerprint" text NOT NULL,
  "existing_decision_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_review_admission_events_action_check" CHECK (length(TRIM(BOTH FROM action)) >= 1 AND length(TRIM(BOTH FROM action)) <= 120),
  CONSTRAINT "minds_review_admission_events_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_review_admission_events_outcome_check" CHECK (outcome = ANY (ARRAY['admitted'::text, 'duplicate'::text, 'suppressed'::text])),
  CONSTRAINT "minds_review_admission_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_review_admission_events_proposal_kind_check" CHECK (length(TRIM(BOTH FROM proposal_kind)) >= 1 AND length(TRIM(BOTH FROM proposal_kind)) <= 120),
  CONSTRAINT "minds_review_admission_events_reason_code_check" CHECK (length(TRIM(BOTH FROM reason_code)) >= 1 AND length(TRIM(BOTH FROM reason_code)) <= 120),
  CONSTRAINT "minds_review_admission_events_semantic_fingerprint_check" CHECK (semantic_fingerprint ~ '^[0-9a-f]{32}$'::text)
);
alter table public."minds_review_admission_events" enable row level security;

create table if not exists public."minds_review_receipts" (
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "request_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "target_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_review_receipts_pkey" PRIMARY KEY (user_id, request_id)
);
alter table public."minds_review_receipts" enable row level security;

create table if not exists public."minds_routine_action_receipts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "action" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "before_state" jsonb NOT NULL,
  "after_state" jsonb NOT NULL,
  "reviewed_candidate" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_routine_action_receipts_action_check" CHECK (action = ANY (ARRAY['create'::text, 'update'::text, 'pause'::text, 'resume'::text, 'delete'::text])),
  CONSTRAINT "minds_routine_action_receipts_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_routine_action_receipts_user_id_request_id_key" UNIQUE (user_id, request_id)
);
alter table public."minds_routine_action_receipts" enable row level security;

create table if not exists public."minds_routine_deliveries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "routine_id" uuid NOT NULL,
  "scheduled_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "lease_until" timestamp with time zone,
  "retry_at" timestamp with time zone,
  "output" text,
  "sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "model" text,
  "error" text,
  "message_id" uuid,
  "claimed_at" timestamp with time zone,
  "generated_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "attention_event_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  CONSTRAINT "minds_routine_deliveries_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_routine_deliveries_routine_id_scheduled_at_key" UNIQUE (routine_id, scheduled_at),
  CONSTRAINT "minds_routine_deliveries_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'generating'::text, 'generated'::text, 'delivered'::text, 'error'::text]))
);
alter table public."minds_routine_deliveries" enable row level security;

create table if not exists public."minds_runtime_capability_grants" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "execution_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "capabilities" text[] NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "last_used_at" timestamp with time zone,
  "use_count" integer DEFAULT 0 NOT NULL,
  "revoked_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_runtime_capability_grants_capabilities_check" CHECK (cardinality(capabilities) >= 1 AND cardinality(capabilities) <= 3 AND capabilities <@ ARRAY['read_mission_workspace'::text, 'read_relevant_artifacts'::text, 'read_project_context'::text]),
  CONSTRAINT "minds_runtime_capability_grants_check" CHECK (expires_at > created_at),
  CONSTRAINT "minds_runtime_capability_grants_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_runtime_capability_grants_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_runtime_capability_grants_status_check" CHECK (status = ANY (ARRAY['active'::text, 'revoked'::text, 'expired'::text])),
  CONSTRAINT "minds_runtime_capability_grants_token_hash_check" CHECK (token_hash ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "minds_runtime_capability_grants_token_hash_key" UNIQUE (token_hash),
  CONSTRAINT "minds_runtime_capability_grants_use_count_check" CHECK (use_count >= 0)
);
alter table public."minds_runtime_capability_grants" enable row level security;

create table if not exists public."minds_self_review_proposals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "report_id" uuid NOT NULL,
  "problem_key" text NOT NULL,
  "title" text NOT NULL,
  "details" jsonb NOT NULL,
  "status" text DEFAULT 'proposed'::text NOT NULL,
  "owner_note" text DEFAULT ''::text NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone,
  CONSTRAINT "minds_self_review_proposals_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_self_review_proposals_status_check" CHECK (status = ANY (ARRAY['proposed'::text, 'accepted'::text, 'rejected'::text, 'testing'::text, 'implemented'::text, 'verified'::text])),
  CONSTRAINT "minds_self_review_proposals_user_id_project_id_problem_key_key" UNIQUE (user_id, project_id, problem_key)
);
alter table public."minds_self_review_proposals" enable row level security;

create table if not exists public."minds_self_review_reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "review_key" text NOT NULL,
  "window_start" timestamp with time zone NOT NULL,
  "window_end" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "lease_token" uuid,
  "lease_until" timestamp with time zone,
  "report" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "coverage" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "minds_self_review_reports_check" CHECK (window_end > window_start),
  CONSTRAINT "minds_self_review_reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_self_review_reports_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])),
  CONSTRAINT "minds_self_review_reports_user_id_review_key_key" UNIQUE (user_id, review_key)
);
alter table public."minds_self_review_reports" enable row level security;

create table if not exists public."minds_self_review_settings" (
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "timezone" text DEFAULT 'Europe/Berlin'::text NOT NULL,
  "local_hour" integer DEFAULT 4 NOT NULL,
  "baseline_completed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "code_preparation_enabled" boolean DEFAULT false NOT NULL,
  "code_repository" text,
  CONSTRAINT "minds_self_review_settings_local_hour_check" CHECK (local_hour >= 0 AND local_hour <= 23),
  CONSTRAINT "minds_self_review_settings_pkey" PRIMARY KEY (user_id)
);
alter table public."minds_self_review_settings" enable row level security;

create table if not exists public."minds_shadow_decisions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "agent" text DEFAULT 'isabella'::text NOT NULL,
  "request_id" uuid NOT NULL,
  "action" text NOT NULL,
  "proposal_kind" text NOT NULL,
  "policy_mode" text DEFAULT 'confirm'::text NOT NULL,
  "candidate" jsonb NOT NULL,
  "context" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "reviewed_candidate" jsonb,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "admission_fingerprint" text,
  CONSTRAINT "minds_shadow_decisions_action_check" CHECK (length(TRIM(BOTH FROM action)) >= 1 AND length(TRIM(BOTH FROM action)) <= 120),
  CONSTRAINT "minds_shadow_decisions_agent_check" CHECK (agent = ANY (ARRAY['isabella'::text, 'sofia'::text, 'minds'::text])),
  CONSTRAINT "minds_shadow_decisions_candidate_check" CHECK (jsonb_typeof(candidate) = 'object'::text),
  CONSTRAINT "minds_shadow_decisions_context_check" CHECK (jsonb_typeof(context) = 'object'::text),
  CONSTRAINT "minds_shadow_decisions_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_shadow_decisions_policy_mode_check" CHECK (policy_mode = 'confirm'::text),
  CONSTRAINT "minds_shadow_decisions_proposal_kind_check" CHECK (length(TRIM(BOTH FROM proposal_kind)) >= 1 AND length(TRIM(BOTH FROM proposal_kind)) <= 120),
  CONSTRAINT "minds_shadow_decisions_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'edited'::text, 'rejected'::text, 'expired'::text, 'executed'::text])),
  CONSTRAINT "minds_shadow_decisions_user_id_request_id_key" UNIQUE (user_id, request_id)
);
alter table public."minds_shadow_decisions" enable row level security;

create table if not exists public."minds_skill_proposals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "agent" text DEFAULT 'isabella'::text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "instructions" text NOT NULL,
  "preferred_tools" text[] DEFAULT '{}'::text[] NOT NULL,
  "status" text DEFAULT 'proposed'::text NOT NULL,
  "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source_conversation_id" uuid,
  "applied_skill_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "applied_at" timestamp with time zone,
  CONSTRAINT "minds_skill_proposals_agent_check" CHECK (agent = ANY (ARRAY['isabella'::text, 'sofia'::text])),
  CONSTRAINT "minds_skill_proposals_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_skill_proposals_status_check" CHECK (status = ANY (ARRAY['proposed'::text, 'accepted'::text, 'rejected'::text, 'applied'::text]))
);
alter table public."minds_skill_proposals" enable row level security;

create table if not exists public."minds_standing_intents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "trigger_text" text NOT NULL,
  "reminder_text" text NOT NULL,
  "trigger_terms" text[] DEFAULT '{}'::text[] NOT NULL,
  "project_id" uuid,
  "status" text DEFAULT 'armed'::text NOT NULL,
  "cooldown_minutes" integer DEFAULT 1440 NOT NULL,
  "max_triggers" integer DEFAULT 3 NOT NULL,
  "trigger_count" integer DEFAULT 0 NOT NULL,
  "last_trigger_at" timestamp with time zone,
  "expires_at" timestamp with time zone DEFAULT (now() + '90 days'::interval),
  "source_conversation_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_id" uuid,
  "mode" text DEFAULT 'reminder'::text NOT NULL,
  "observation_mode" text DEFAULT 'via_user'::text NOT NULL,
  "channel_kind" text DEFAULT 'conversation'::text NOT NULL,
  "channel_ref" text,
  "freshness_minutes" integer,
  "last_checked_at" timestamp with time zone,
  "last_observed_at" timestamp with time zone,
  "condition_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "return_rule" jsonb DEFAULT '{"route": "conversation"}'::jsonb NOT NULL,
  "armed_at" timestamp with time zone,
  "fired_at" timestamp with time zone,
  "done_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "expired_at" timestamp with time zone,
  CONSTRAINT "minds_standing_intents_channel_kind_check" CHECK (length(TRIM(BOTH FROM channel_kind)) >= 1 AND length(TRIM(BOTH FROM channel_kind)) <= 80),
  CONSTRAINT "minds_standing_intents_condition_json_check" CHECK (jsonb_typeof(condition_json) = 'object'::text),
  CONSTRAINT "minds_standing_intents_cooldown_minutes_check" CHECK (cooldown_minutes >= 0),
  CONSTRAINT "minds_standing_intents_freshness_check" CHECK (freshness_minutes IS NULL OR freshness_minutes >= 1 AND freshness_minutes <= 5256000),
  CONSTRAINT "minds_standing_intents_max_triggers_check" CHECK (max_triggers >= 1),
  CONSTRAINT "minds_standing_intents_mode_check" CHECK (mode = ANY (ARRAY['reminder'::text, 'watch'::text])),
  CONSTRAINT "minds_standing_intents_observation_mode_check" CHECK (observation_mode = ANY (ARRAY['autonomous'::text, 'via_user'::text, 'unobserved'::text])),
  CONSTRAINT "minds_standing_intents_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_standing_intents_return_rule_check" CHECK (jsonb_typeof(return_rule) = 'object'::text),
  CONSTRAINT "minds_standing_intents_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'armed'::text, 'fired'::text, 'done'::text, 'cancelled'::text, 'expired'::text])),
  CONSTRAINT "minds_standing_intents_trigger_count_check" CHECK (trigger_count >= 0),
  CONSTRAINT "minds_standing_intents_watch_contract_check" CHECK (mode = 'reminder'::text OR observation_mode = 'autonomous'::text AND channel_kind <> 'conversation'::text AND freshness_minutes IS NOT NULL AND condition_json <> '{}'::jsonb AND return_rule <> '{}'::jsonb)
);
alter table public."minds_standing_intents" enable row level security;

create table if not exists public."minds_user_skill_versions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "skill_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_user_skill_versions_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_user_skill_versions_skill_id_version_key" UNIQUE (skill_id, version),
  CONSTRAINT "minds_user_skill_versions_version_check" CHECK (version > 0)
);
alter table public."minds_user_skill_versions" enable row level security;

create table if not exists public."minds_user_skills" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "agent" text DEFAULT 'isabella'::text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT ''::text NOT NULL,
  "instructions" text NOT NULL,
  "preferred_tools" text[] DEFAULT '{}'::text[] NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "source_proposal_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_user_skills_agent_check" CHECK (agent = ANY (ARRAY['isabella'::text, 'sofia'::text])),
  CONSTRAINT "minds_user_skills_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_user_skills_user_id_agent_slug_key" UNIQUE (user_id, agent, slug),
  CONSTRAINT "minds_user_skills_version_check" CHECK (version >= 1)
);
alter table public."minds_user_skills" enable row level security;

create table if not exists public."minds_watch_channels" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "channel_key" text NOT NULL,
  "label" text NOT NULL,
  "provider" text NOT NULL,
  "adapter_kind" text NOT NULL,
  "observation_mode" text DEFAULT 'autonomous'::text NOT NULL,
  "status" text DEFAULT 'disabled'::text NOT NULL,
  "freshness_minutes" integer NOT NULL,
  "verification_status" text DEFAULT 'never'::text NOT NULL,
  "last_verified_at" timestamp with time zone,
  "condition_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "runtime_supported" boolean DEFAULT false NOT NULL,
  "last_error" text,
  CONSTRAINT "minds_watch_channels_adapter_kind_check" CHECK (adapter_kind = ANY (ARRAY['connector'::text, 'http'::text, 'database'::text, 'internal'::text])),
  CONSTRAINT "minds_watch_channels_condition_schema_check" CHECK (jsonb_typeof(condition_schema) = 'object'::text),
  CONSTRAINT "minds_watch_channels_freshness_minutes_check" CHECK (freshness_minutes >= 1 AND freshness_minutes <= 5256000),
  CONSTRAINT "minds_watch_channels_key_check" CHECK (length(TRIM(BOTH FROM channel_key)) >= 1 AND length(TRIM(BOTH FROM channel_key)) <= 120),
  CONSTRAINT "minds_watch_channels_label_check" CHECK (length(TRIM(BOTH FROM label)) >= 1 AND length(TRIM(BOTH FROM label)) <= 240),
  CONSTRAINT "minds_watch_channels_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_watch_channels_observation_mode_check" CHECK (observation_mode = 'autonomous'::text),
  CONSTRAINT "minds_watch_channels_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_watch_channels_status_check" CHECK (status = ANY (ARRAY['enabled'::text, 'disabled'::text, 'degraded'::text])),
  CONSTRAINT "minds_watch_channels_user_id_channel_key_key" UNIQUE (user_id, channel_key),
  CONSTRAINT "minds_watch_channels_verification_status_check" CHECK (verification_status = ANY (ARRAY['verified'::text, 'never'::text, 'stale'::text, 'failed'::text]))
);
alter table public."minds_watch_channels" enable row level security;

create table if not exists public."minds_watch_checks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "watch_id" uuid NOT NULL,
  "channel_id" uuid NOT NULL,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "observation_status" text NOT NULL,
  "condition_state" text NOT NULL,
  "observed_at" timestamp with time zone,
  "freshness_minutes" integer,
  "result_fingerprint" text,
  "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_watch_checks_condition_state_check" CHECK (condition_state = ANY (ARRAY['matched'::text, 'not_matched'::text, 'unknown'::text])),
  CONSTRAINT "minds_watch_checks_evidence_check" CHECK (jsonb_typeof(evidence) = 'object'::text),
  CONSTRAINT "minds_watch_checks_freshness_minutes_check" CHECK (freshness_minutes IS NULL OR freshness_minutes >= 0),
  CONSTRAINT "minds_watch_checks_observation_status_check" CHECK (observation_status = ANY (ARRAY['ok'::text, 'stale'::text, 'error'::text])),
  CONSTRAINT "minds_watch_checks_pkey" PRIMARY KEY (id)
);
alter table public."minds_watch_checks" enable row level security;

CREATE INDEX IF NOT EXISTS conversation_messages_user_conversation_idx ON public.conversation_messages USING btree (user_id, conversation_id, created_at);
CREATE INDEX IF NOT EXISTS conversation_messages_conversation_user_fk_idx ON public.conversation_messages USING btree (conversation_id, user_id);
CREATE INDEX IF NOT EXISTS conversation_messages_exposure_scope_idx ON public.conversation_messages USING btree (user_id, conversation_id, exposure_scope_version, exposure_scope_key, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS conversation_messages_fts_idx ON public.conversation_messages USING gin (to_tsvector('simple'::regconfig, COALESCE(content, ''::text)));
CREATE INDEX IF NOT EXISTS conversation_messages_checkpoint_idx ON public.conversation_messages USING btree (user_id, conversation_id, created_at, id);
CREATE INDEX IF NOT EXISTS conversations_origin_thread_user_fk_idx ON public.conversations USING btree (origin_thread_id, user_id) WHERE (origin_thread_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS conversations_user_updated_idx ON public.conversations USING btree (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_user_app_updated_idx ON public.conversations USING btree (user_id, app_scope, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_origin_document_user_fk_idx ON public.conversations USING btree (origin_document_id, user_id) WHERE (origin_document_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS conversations_user_thread_idx ON public.conversations USING btree (user_id, origin_thread_id, updated_at DESC) WHERE (origin_thread_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS conversations_user_document_idx ON public.conversations USING btree (user_id, origin_document_id, updated_at DESC) WHERE (origin_document_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS isabella_activity_log_user_created_idx ON public.isabella_activity_log USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS isabella_embeddings_user_idx ON public.isabella_embeddings USING btree (user_id, source_type);
CREATE INDEX IF NOT EXISTS isabella_embeddings_scope_idx ON public.isabella_embeddings USING btree (user_id, exposure_scope_key, source_type);
CREATE INDEX IF NOT EXISTS isabella_entities_user_name_idx ON public.isabella_entities USING btree (user_id, normalized_name);
CREATE INDEX IF NOT EXISTS isabella_entity_links_user_subject_idx ON public.isabella_entity_links USING btree (user_id, subject_entity_id);
CREATE INDEX IF NOT EXISTS isabella_entity_links_user_predicate_idx ON public.isabella_entity_links USING btree (user_id, predicate);
CREATE INDEX IF NOT EXISTS isabella_entity_links_user_object_idx ON public.isabella_entity_links USING btree (user_id, object_entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS isabella_followups_user_client_key_uq ON public.isabella_followups USING btree (user_id, client_key) WHERE (client_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS isabella_followups_user_due_idx ON public.isabella_followups USING btree (user_id, due_at);
CREATE INDEX IF NOT EXISTS isabella_memories_fts_idx ON public.isabella_memories USING gin (to_tsvector('simple'::regconfig, ((COALESCE(subject, ''::text) || ' '::text) || COALESCE(content, ''::text))));
CREATE INDEX IF NOT EXISTS isabella_memories_scope_idx ON public.isabella_memories USING btree (user_id, status, exposure_scope_key, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS isabella_memories_user_client_key_uq ON public.isabella_memories USING btree (user_id, client_key) WHERE (client_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS isabella_memories_user_kind_idx ON public.isabella_memories USING btree (user_id, kind);
CREATE INDEX IF NOT EXISTS isabella_model_claims_user_type_idx ON public.isabella_model_claims USING btree (user_id, claim_type, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS isabella_model_claims_user_status_idx ON public.isabella_model_claims USING btree (user_id, status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS isabella_proposal_feedback_user_created_idx ON public.isabella_proposal_feedback USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS isabella_return_queue_user_status_idx ON public.isabella_return_queue USING btree (user_id, status, COALESCE(reactivate_after, created_at));
CREATE INDEX IF NOT EXISTS isabella_routines_due_idx ON public.isabella_routines USING btree (next_run_at) WHERE ((enabled = true) AND (next_run_at IS NOT NULL));
CREATE INDEX IF NOT EXISTS isabella_skill_runs_user_source_slug_created_idx ON public.isabella_skill_runs USING btree (user_id, skill_source, skill_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS isabella_skill_runs_user_created_idx ON public.isabella_skill_runs USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS isabella_task_reminders_user_time_idx ON public.isabella_task_reminders USING btree (user_id, remind_at);
CREATE INDEX IF NOT EXISTS isabella_task_reminders_task_user_fk_idx ON public.isabella_task_reminders USING btree (task_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS minds_action_policies_system_unique ON public.minds_action_policies USING btree (app_scope, action) WHERE (user_id IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS minds_action_policies_user_unique ON public.minds_action_policies USING btree (user_id, app_scope, action) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_agent_runs_user_feature_idx ON public.minds_agent_runs USING btree (user_id, feature, started_at DESC);
CREATE INDEX IF NOT EXISTS minds_agent_runs_status_idx ON public.minds_agent_runs USING btree (status, started_at DESC);
CREATE INDEX IF NOT EXISTS minds_artifact_intake_accepted_artifact_idx ON public.minds_artifact_intake USING btree (accepted_artifact_id) WHERE (accepted_artifact_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_artifact_intake_execution_idx ON public.minds_artifact_intake USING btree (execution_id, created_at);
CREATE INDEX IF NOT EXISTS minds_artifact_intake_user_status_idx ON public.minds_artifact_intake USING btree (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_attention_events_user_status_idx ON public.minds_attention_events USING btree (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_attention_events_source_idx ON public.minds_attention_events USING btree (user_id, source_type, source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_attention_events_user_route_idx ON public.minds_attention_events USING btree (user_id, route, status, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_autonomy_executions_permission_idx ON public.minds_autonomy_executions USING btree (permission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_calendar_action_receipts_owner ON public.minds_calendar_action_receipts USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_capability_runs_thread_idx ON public.minds_capability_runs USING btree (work_thread_id, updated_at DESC) WHERE (work_thread_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS minds_capability_runs_provider_response_uidx ON public.minds_capability_runs USING btree (provider_response_id) WHERE (provider_response_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_capability_runs_conversation_idx ON public.minds_capability_runs USING btree (conversation_id) WHERE (conversation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_capability_runs_project_idx ON public.minds_capability_runs USING btree (project_id, updated_at DESC) WHERE (project_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_capability_runs_user_status_idx ON public.minds_capability_runs USING btree (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS minds_chat_jobs_reconcile_idx ON public.minds_chat_jobs USING btree (status, created_at) WHERE (status = ANY (ARRAY['preparing'::text, 'running'::text]));
CREATE UNIQUE INDEX IF NOT EXISTS minds_chat_jobs_one_active_user_idx ON public.minds_chat_jobs USING btree (user_id) WHERE (status = ANY (ARRAY['preparing'::text, 'running'::text]));
CREATE INDEX IF NOT EXISTS minds_chat_stream_delivery_receipts_expiry_idx ON public.minds_chat_stream_delivery_receipts USING btree (expires_at);
CREATE INDEX IF NOT EXISTS minds_commitment_events_commitment_idx ON public.minds_commitment_events USING btree (commitment_id, created_at);
CREATE INDEX IF NOT EXISTS minds_commitment_events_user_idx ON public.minds_commitment_events USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_commitment_signal_links_user_time_idx ON public.minds_commitment_signal_links USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_commitment_signal_links_signal_idx ON public.minds_commitment_signal_links USING btree (signal_id);
CREATE INDEX IF NOT EXISTS minds_commitment_workspace_items_user_kind_idx ON public.minds_commitment_workspace_items USING btree (user_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_commitment_workspace_items_workspace_idx ON public.minds_commitment_workspace_items USING btree (workspace_id, created_at);
CREATE INDEX IF NOT EXISTS minds_commitment_workspaces_user_status_idx ON public.minds_commitment_workspaces USING btree (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS minds_commitment_workspaces_project_idx ON public.minds_commitment_workspaces USING btree (user_id, project_id, updated_at DESC) WHERE (project_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS minds_commitment_workspaces_user_commitment_uq ON public.minds_commitment_workspaces USING btree (user_id, commitment_id);
CREATE INDEX IF NOT EXISTS minds_commitments_source_flush_idx ON public.minds_commitments USING btree (source_flush_id) WHERE (source_flush_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_commitments_user_status_idx ON public.minds_commitments USING btree (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS minds_commitments_source_conversation_idx ON public.minds_commitments USING btree (source_conversation_id) WHERE (source_conversation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_commitments_project_status_idx ON public.minds_commitments USING btree (project_id, status, updated_at DESC) WHERE (project_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS minds_commitments_request_uidx ON public.minds_commitments USING btree (user_id, request_id);
CREATE INDEX IF NOT EXISTS minds_continuity_signals_user_time_idx ON public.minds_continuity_signals USING btree (user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS minds_continuity_signals_project_time_idx ON public.minds_continuity_signals USING btree (project_id, last_seen_at DESC) WHERE (project_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_delivery_attempts_intent_idx ON public.minds_delivery_attempts USING btree (intent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_delivery_attempts_user_idx ON public.minds_delivery_attempts USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_delivery_intents_user_idx ON public.minds_delivery_intents USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_delivery_intents_claim_idx ON public.minds_delivery_intents USING btree (status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS minds_expectation_reviews_expectation_idx ON public.minds_expectation_reviews USING btree (expectation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_expectations_project_idx ON public.minds_expectations USING btree (project_id) WHERE (project_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_expectations_due_idx ON public.minds_expectations USING btree (user_id, status, due_at) WHERE (status = ANY (ARRAY['active'::text, 'due_unconfirmed'::text]));
CREATE UNIQUE INDEX IF NOT EXISTS minds_exposure_receipts_run_source_uidx ON public.minds_exposure_receipts USING btree (user_id, run_id, channel, source_type, source_id);
CREATE INDEX IF NOT EXISTS minds_exposure_receipts_user_idx ON public.minds_exposure_receipts USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_heartbeat_events_user_idx ON public.minds_heartbeat_events USING btree (user_id, status, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS minds_intent_deliveries_user_idx ON public.minds_intent_deliveries USING btree (user_id, intent_id);
CREATE INDEX IF NOT EXISTS minds_memory_flushes_conversation_idx ON public.minds_memory_flushes USING btree (user_id, agent, conversation_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS minds_memory_flushes_checkpoint_uidx ON public.minds_memory_flushes USING btree (user_id, agent, conversation_id, checkpoint_message_id);
CREATE INDEX IF NOT EXISTS minds_memory_forget_tombstones_user_idx ON public.minds_memory_forget_tombstones USING btree (user_id, forgotten_at DESC);
CREATE INDEX IF NOT EXISTS minds_memory_lineage_child_idx ON public.minds_memory_lineage USING btree (user_id, child_kind, child_id);
CREATE INDEX IF NOT EXISTS minds_memory_lineage_source_idx ON public.minds_memory_lineage USING btree (user_id, source_kind, source_id) WHERE (invalidated_at IS NULL);
CREATE INDEX IF NOT EXISTS minds_mission_run_events_run_idx ON public.minds_mission_run_events USING btree (run_id, created_at);
CREATE INDEX IF NOT EXISTS minds_mission_run_events_user_idx ON public.minds_mission_run_events USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_mission_runs_wait_idx ON public.minds_mission_runs USING btree (status, wait_kind, wake_at, updated_at) WHERE (status = 'waiting'::text);
CREATE INDEX IF NOT EXISTS minds_mission_runs_claim_idx ON public.minds_mission_runs USING btree (status, next_attempt_at, lease_until, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'running'::text]));
CREATE INDEX IF NOT EXISTS minds_mission_runs_user_status_idx ON public.minds_mission_runs USING btree (user_id, status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS minds_mission_runs_one_live_per_workspace ON public.minds_mission_runs USING btree (workspace_id) WHERE (status = ANY (ARRAY['queued'::text, 'running'::text, 'waiting'::text, 'waiting_for_user'::text, 'paused'::text]));
CREATE INDEX IF NOT EXISTS minds_mission_runtime_events_execution_idx ON public.minds_mission_runtime_events USING btree (execution_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS minds_mission_runtime_provider_event_unique ON public.minds_mission_runtime_events USING btree (execution_id, provider_event_id) WHERE (provider_event_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_mission_runtime_events_user_idx ON public.minds_mission_runtime_events USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS minds_mission_runtime_provider_session_unique ON public.minds_mission_runtime_executions USING btree (provider, provider_session_id) WHERE (provider_session_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_mission_runtime_user_idx ON public.minds_mission_runtime_executions USING btree (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS minds_mission_runtime_run_idx ON public.minds_mission_runtime_executions USING btree (mission_run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_model_claim_reviews_replacement_idx ON public.minds_model_claim_reviews USING btree (replacement_claim_id) WHERE (replacement_claim_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_model_claim_reviews_claim_idx ON public.minds_model_claim_reviews USING btree (claim_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_model_independence_runs_user_idx ON public.minds_model_independence_runs USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_operating_model_evidence_observation_idx ON public.minds_operating_model_evidence USING btree (observation_id);
CREATE INDEX IF NOT EXISTS minds_operating_model_evidence_user_idx ON public.minds_operating_model_evidence USING btree (user_id);
CREATE INDEX IF NOT EXISTS minds_operating_model_evidence_hypothesis_idx ON public.minds_operating_model_evidence USING btree (hypothesis_id, stance);
CREATE INDEX IF NOT EXISTS minds_operating_model_hypotheses_user_idx ON public.minds_operating_model_hypotheses USING btree (user_id, status, proposed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS minds_operating_model_hypotheses_active_pattern_idx ON public.minds_operating_model_hypotheses USING btree (user_id, pattern_key) WHERE (status = ANY (ARRAY['proposed'::text, 'accepted'::text]));
CREATE UNIQUE INDEX IF NOT EXISTS minds_operating_model_one_active_dimension_idx ON public.minds_operating_model_hypotheses USING btree (user_id, dimension) WHERE (status = ANY (ARRAY['proposed'::text, 'accepted'::text, 'superseded'::text]));
CREATE INDEX IF NOT EXISTS minds_operating_model_hypotheses_superseded_idx ON public.minds_operating_model_hypotheses USING btree (superseded_by) WHERE (superseded_by IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_operating_model_hypotheses_accepted_claim_idx ON public.minds_operating_model_hypotheses USING btree (accepted_claim_id) WHERE (accepted_claim_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_operating_model_observations_user_idx ON public.minds_operating_model_observations USING btree (user_id, dimension, observed_at DESC);
CREATE INDEX IF NOT EXISTS minds_operating_model_reviews_hypothesis_idx ON public.minds_operating_model_reviews USING btree (hypothesis_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS minds_operating_model_reviews_user_request_idx ON public.minds_operating_model_reviews USING btree (user_id, request_id) WHERE (request_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_operating_model_reviews_resulting_claim_idx ON public.minds_operating_model_reviews USING btree (resulting_claim_id) WHERE (resulting_claim_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_operating_model_reviews_user_idx ON public.minds_operating_model_reviews USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_outcome_feedback_scope_idx ON public.minds_outcome_feedback USING btree (user_id, action, context_key, scope_key, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_permission_reviews_permission_idx ON public.minds_permission_reviews USING btree (permission_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_post_action_feedback_user_idx ON public.minds_post_action_feedback_candidates USING btree (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_push_subscriptions_user_active_idx ON public.minds_push_subscriptions USING btree (user_id, active, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS minds_review_admission_events_user_idx ON public.minds_review_admission_events USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_routine_deliveries_user_idx ON public.minds_routine_deliveries USING btree (user_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS minds_routine_deliveries_pending_idx ON public.minds_routine_deliveries USING btree (retry_at, lease_until) WHERE (status <> 'delivered'::text);
CREATE INDEX IF NOT EXISTS minds_runtime_capability_grants_execution_idx ON public.minds_runtime_capability_grants USING btree (execution_id, status, expires_at);
CREATE INDEX IF NOT EXISTS minds_runtime_capability_grants_user_idx ON public.minds_runtime_capability_grants USING btree (user_id);
CREATE INDEX IF NOT EXISTS self_review_proposals_report ON public.minds_self_review_proposals USING btree (report_id);
CREATE INDEX IF NOT EXISTS self_review_proposals_project ON public.minds_self_review_proposals USING btree (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS self_review_reports_project ON public.minds_self_review_reports USING btree (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS self_review_settings_project ON public.minds_self_review_settings USING btree (project_id);
CREATE INDEX IF NOT EXISTS minds_shadow_decisions_admission_idx ON public.minds_shadow_decisions USING btree (user_id, admission_fingerprint, status, created_at DESC) WHERE (admission_fingerprint IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_shadow_decisions_user_time_idx ON public.minds_shadow_decisions USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_shadow_decisions_user_action_idx ON public.minds_shadow_decisions USING btree (user_id, action, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS minds_skill_proposals_request_uidx ON public.minds_skill_proposals USING btree (user_id, ((metadata ->> 'request_id'::text))) WHERE (metadata ? 'request_id'::text);
CREATE INDEX IF NOT EXISTS minds_skill_proposals_user_idx ON public.minds_skill_proposals USING btree (user_id, status, agent);
CREATE UNIQUE INDEX IF NOT EXISTS minds_standing_intents_request_uidx ON public.minds_standing_intents USING btree (user_id, request_id);
CREATE INDEX IF NOT EXISTS minds_standing_intents_project_idx ON public.minds_standing_intents USING btree (project_id) WHERE (project_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_standing_intents_mode_status_idx ON public.minds_standing_intents USING btree (user_id, mode, status, expires_at);
CREATE INDEX IF NOT EXISTS minds_standing_intents_user_status_idx ON public.minds_standing_intents USING btree (user_id, status);
CREATE INDEX IF NOT EXISTS minds_user_skill_versions_user_idx ON public.minds_user_skill_versions USING btree (user_id);
CREATE INDEX IF NOT EXISTS minds_user_skills_user_idx ON public.minds_user_skills USING btree (user_id, agent, enabled);
CREATE INDEX IF NOT EXISTS minds_watch_channels_user_status_idx ON public.minds_watch_channels USING btree (user_id, status, verification_status, channel_key);
CREATE INDEX IF NOT EXISTS minds_watch_checks_watch_idx ON public.minds_watch_checks USING btree (user_id, watch_id, checked_at DESC);

commit;
