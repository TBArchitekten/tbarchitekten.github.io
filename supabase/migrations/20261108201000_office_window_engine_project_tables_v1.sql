-- Office / Romy · Phase 1 · project knowledge table definitions
-- Column and constraint metadata only. No personal or project records included.
-- New tables only; existing Office Work Desktop, tasks, members and projects remain unchanged.
begin;

create table if not exists public."minds_project_model_elements" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "project_id" uuid NOT NULL,
  "revision_id" uuid NOT NULL,
  "element_kind" text NOT NULL,
  "element_ref" text NOT NULL,
  "role" text DEFAULT 'inferred'::text NOT NULL,
  "note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_project_model_elements_element_kind_check" CHECK (element_kind = ANY (ARRAY['referent'::text, 'claim'::text, 'relation'::text, 'movement'::text, 'gap'::text])),
  CONSTRAINT "minds_project_model_elements_element_ref_check" CHECK (length(TRIM(BOTH FROM element_ref)) >= 1 AND length(TRIM(BOTH FROM element_ref)) <= 240),
  CONSTRAINT "minds_project_model_elements_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_project_model_elements_note_check" CHECK (note IS NULL OR length(note) <= 1600),
  CONSTRAINT "minds_project_model_elements_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_project_model_elements_revision_id_element_kind_eleme_key" UNIQUE (revision_id, element_kind, element_ref, role),
  CONSTRAINT "minds_project_model_elements_role_check" CHECK (role = ANY (ARRAY['accepted'::text, 'inferred'::text, 'gap'::text]))
);
alter table public."minds_project_model_elements" enable row level security;

create table if not exists public."minds_project_model_revisions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "project_id" uuid NOT NULL,
  "parent_revision_id" uuid,
  "trigger_kind" text NOT NULL,
  "reason" text NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "coverage_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "trigger_key" text,
  CONSTRAINT "minds_project_model_revisions_coverage_snapshot_check" CHECK (jsonb_typeof(coverage_snapshot) = 'object'::text),
  CONSTRAINT "minds_project_model_revisions_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_project_model_revisions_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_project_model_revisions_reason_check" CHECK (length(TRIM(BOTH FROM reason)) >= 1 AND length(TRIM(BOTH FROM reason)) <= 1200),
  CONSTRAINT "minds_project_model_revisions_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'current'::text, 'rejected'::text, 'superseded'::text])),
  CONSTRAINT "minds_project_model_revisions_trigger_kind_check" CHECK (trigger_kind = ANY (ARRAY['source'::text, 'user_correction'::text, 'time'::text, 'reread'::text, 'manual'::text]))
);
alter table public."minds_project_model_revisions" enable row level security;

create table if not exists public."minds_project_model_variants" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "revision_id" uuid NOT NULL,
  "comparison_item_id" uuid NOT NULL,
  "variant_kind" text NOT NULL,
  "status" text DEFAULT 'open'::text NOT NULL,
  "source_claim_id" uuid NOT NULL,
  "target_claim_id" uuid,
  "confidence" numeric DEFAULT 0.7 NOT NULL,
  "rationale" text,
  "provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  CONSTRAINT "minds_project_model_variants_confidence_check" CHECK (confidence >= 0::numeric AND confidence <= 1::numeric),
  CONSTRAINT "minds_project_model_variants_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_project_model_variants_provenance_check" CHECK (jsonb_typeof(provenance) = 'object'::text),
  CONSTRAINT "minds_project_model_variants_rationale_check" CHECK (rationale IS NULL OR length(rationale) <= 1600),
  CONSTRAINT "minds_project_model_variants_revision_id_comparison_item_id_key" UNIQUE (revision_id, comparison_item_id),
  CONSTRAINT "minds_project_model_variants_status_check" CHECK (status = ANY (ARRAY['open'::text, 'resolved'::text, 'retired'::text])),
  CONSTRAINT "minds_project_model_variants_variant_kind_check" CHECK (variant_kind = ANY (ARRAY['contradiction'::text, 'modification'::text, 'uncertainty'::text]))
);
alter table public."minds_project_model_variants" enable row level security;

create table if not exists public."minds_project_perimeter" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "project_id" uuid NOT NULL,
  "source_class" text NOT NULL,
  "observation_mode" text DEFAULT 'unobserved'::text NOT NULL,
  "readability" text DEFAULT 'unknown'::text NOT NULL,
  "coverage" text DEFAULT 'unknown'::text NOT NULL,
  "freshness_minutes" integer,
  "last_checked_at" timestamp with time zone,
  "last_seen_at" timestamp with time zone,
  "note" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_project_perimeter_coverage_check" CHECK (coverage = ANY (ARRAY['complete'::text, 'partial'::text, 'missing'::text, 'unknown'::text])),
  CONSTRAINT "minds_project_perimeter_freshness_minutes_check" CHECK (freshness_minutes IS NULL OR freshness_minutes >= 1 AND freshness_minutes <= 5256000),
  CONSTRAINT "minds_project_perimeter_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_project_perimeter_note_check" CHECK (note IS NULL OR length(note) <= 1200),
  CONSTRAINT "minds_project_perimeter_observation_mode_check" CHECK (observation_mode = ANY (ARRAY['autonomous'::text, 'via_user'::text, 'unobserved'::text])),
  CONSTRAINT "minds_project_perimeter_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_project_perimeter_readability_check" CHECK (readability = ANY (ARRAY['readable'::text, 'partial'::text, 'unreadable'::text, 'unknown'::text])),
  CONSTRAINT "minds_project_perimeter_source_class_check" CHECK (length(TRIM(BOTH FROM source_class)) >= 1 AND length(TRIM(BOTH FROM source_class)) <= 120),
  CONSTRAINT "minds_project_perimeter_user_id_project_id_source_class_key" UNIQUE (user_id, project_id, source_class)
);
alter table public."minds_project_perimeter" enable row level security;

create table if not exists public."minds_project_referents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "project_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "label" text NOT NULL,
  "canonical_key" text,
  "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'active'::text NOT NULL,
  "merged_into" uuid,
  "provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_project_referents_aliases_check" CHECK (jsonb_typeof(aliases) = 'array'::text),
  CONSTRAINT "minds_project_referents_kind_check" CHECK (kind = ANY (ARRAY['person'::text, 'organization'::text, 'building_element'::text, 'room'::text, 'system'::text, 'document'::text, 'decision'::text, 'meeting'::text, 'phase'::text, 'workstream'::text, 'other'::text])),
  CONSTRAINT "minds_project_referents_label_check" CHECK (length(TRIM(BOTH FROM label)) >= 1 AND length(TRIM(BOTH FROM label)) <= 240),
  CONSTRAINT "minds_project_referents_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_project_referents_provenance_check" CHECK (jsonb_typeof(provenance) = 'object'::text),
  CONSTRAINT "minds_project_referents_status_check" CHECK (status = ANY (ARRAY['active'::text, 'merged'::text, 'retired'::text]))
);
alter table public."minds_project_referents" enable row level security;

create table if not exists public."minds_project_source_comparison_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "comparison_id" uuid NOT NULL,
  "source_claim_id" uuid NOT NULL,
  "target_claim_id" uuid,
  "verdict" text NOT NULL,
  "confidence" numeric DEFAULT 0.7 NOT NULL,
  "rationale" text,
  "relation_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_project_source_comparison_items_confidence_check" CHECK (confidence >= 0::numeric AND confidence <= 1::numeric),
  CONSTRAINT "minds_project_source_comparison_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_project_source_comparison_items_rationale_check" CHECK (rationale IS NULL OR length(rationale) <= 1600),
  CONSTRAINT "minds_project_source_comparison_items_verdict_check" CHECK (verdict = ANY (ARRAY['aligned'::text, 'contradicts'::text, 'modifies'::text, 'adds'::text, 'unclear'::text]))
);
alter table public."minds_project_source_comparison_items" enable row level security;

create table if not exists public."minds_project_source_comparisons" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "ingestion_id" uuid NOT NULL,
  "baseline_revision_id" uuid,
  "baseline_fingerprint" text NOT NULL,
  "model" text,
  "status" text DEFAULT 'completed'::text NOT NULL,
  "compared_claim_count" integer DEFAULT 0 NOT NULL,
  "relation_count" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_project_source_comparis_user_id_project_id_ingestion__key" UNIQUE (user_id, project_id, ingestion_id, baseline_fingerprint),
  CONSTRAINT "minds_project_source_comparisons_baseline_fingerprint_check" CHECK (baseline_fingerprint ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "minds_project_source_comparisons_compared_claim_count_check" CHECK (compared_claim_count >= 0),
  CONSTRAINT "minds_project_source_comparisons_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_project_source_comparisons_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_project_source_comparisons_relation_count_check" CHECK (relation_count >= 0),
  CONSTRAINT "minds_project_source_comparisons_status_check" CHECK (status = ANY (ARRAY['completed'::text, 'failed'::text]))
);
alter table public."minds_project_source_comparisons" enable row level security;

create table if not exists public."minds_project_source_ingestions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "source_kind" text NOT NULL,
  "source_ref" text NOT NULL,
  "source_version" text NOT NULL,
  "status" text DEFAULT 'processing'::text NOT NULL,
  "model" text,
  "referent_count" integer DEFAULT 0 NOT NULL,
  "claim_count" integer DEFAULT 0 NOT NULL,
  "extraction_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_project_source_ingestio_user_id_project_id_source_kin_key" UNIQUE (user_id, project_id, source_kind, source_ref, source_version),
  CONSTRAINT "minds_project_source_ingestions_claim_count_check" CHECK (claim_count >= 0),
  CONSTRAINT "minds_project_source_ingestions_extraction_metadata_check" CHECK (jsonb_typeof(extraction_metadata) = 'object'::text),
  CONSTRAINT "minds_project_source_ingestions_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_project_source_ingestions_referent_count_check" CHECK (referent_count >= 0),
  CONSTRAINT "minds_project_source_ingestions_source_kind_check" CHECK (source_kind = ANY (ARRAY['work_file'::text, 'thread_message'::text, 'manual'::text])),
  CONSTRAINT "minds_project_source_ingestions_source_ref_check" CHECK (length(TRIM(BOTH FROM source_ref)) >= 1 AND length(TRIM(BOTH FROM source_ref)) <= 240),
  CONSTRAINT "minds_project_source_ingestions_source_version_check" CHECK (length(TRIM(BOTH FROM source_version)) >= 1 AND length(TRIM(BOTH FROM source_version)) <= 256),
  CONSTRAINT "minds_project_source_ingestions_status_check" CHECK (status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text]))
);
alter table public."minds_project_source_ingestions" enable row level security;

create table if not exists public."minds_work_claim_relations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "project_id" uuid NOT NULL,
  "source_claim_id" uuid NOT NULL,
  "target_claim_id" uuid NOT NULL,
  "relation" text NOT NULL,
  "status" text DEFAULT 'proposed'::text NOT NULL,
  "author_kind" text DEFAULT 'isabella'::text NOT NULL,
  "confidence" numeric DEFAULT 0.7 NOT NULL,
  "provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_work_claim_relations_author_kind_check" CHECK (author_kind = ANY (ARRAY['user'::text, 'isabella'::text, 'external'::text, 'system'::text])),
  CONSTRAINT "minds_work_claim_relations_check" CHECK (source_claim_id <> target_claim_id),
  CONSTRAINT "minds_work_claim_relations_confidence_check" CHECK (confidence >= 0::numeric AND confidence <= 1::numeric),
  CONSTRAINT "minds_work_claim_relations_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_work_claim_relations_provenance_check" CHECK (jsonb_typeof(provenance) = 'object'::text),
  CONSTRAINT "minds_work_claim_relations_relation_check" CHECK (relation = ANY (ARRAY['supports'::text, 'contradicts'::text, 'supersedes'::text, 'depends_on'::text, 'qualifies'::text, 'same_subject'::text])),
  CONSTRAINT "minds_work_claim_relations_status_check" CHECK (status = ANY (ARRAY['proposed'::text, 'confirmed'::text, 'rejected'::text, 'superseded'::text]))
);
alter table public."minds_work_claim_relations" enable row level security;

create table if not exists public."minds_work_claims" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "project_id" uuid NOT NULL,
  "claim_type" text DEFAULT 'fact'::text NOT NULL,
  "statement" text NOT NULL,
  "subject" text,
  "topic" text,
  "discipline" text,
  "status" text DEFAULT 'proposed'::text NOT NULL,
  "confidence" numeric DEFAULT 0.7 NOT NULL,
  "provenance_class" text DEFAULT 'inferred'::text NOT NULL,
  "supersedes_id" uuid,
  "superseded_by" uuid,
  "valid_from" timestamp with time zone,
  "valid_to" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "referent_id" uuid,
  "author_kind" text DEFAULT 'isabella'::text NOT NULL,
  "model_kind" text,
  "learned_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_work_claims_author_kind_check" CHECK (author_kind = ANY (ARRAY['user'::text, 'isabella'::text, 'external'::text, 'system'::text])),
  CONSTRAINT "minds_work_claims_claim_type_check" CHECK (claim_type = ANY (ARRAY['fact'::text, 'decision'::text, 'requirement'::text, 'deadline'::text, 'dependency'::text, 'open_question'::text, 'assumption'::text, 'constraint'::text, 'other'::text])),
  CONSTRAINT "minds_work_claims_confidence_check" CHECK (confidence >= 0::numeric AND confidence <= 1::numeric),
  CONSTRAINT "minds_work_claims_model_kind_check" CHECK (model_kind IS NULL OR (model_kind = ANY (ARRAY['structural'::text, 'descriptive'::text, 'diagnostic'::text, 'evaluative'::text, 'prescriptive'::text, 'gap'::text]))),
  CONSTRAINT "minds_work_claims_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_work_claims_provenance_class_check" CHECK (provenance_class = ANY (ARRAY['user'::text, 'project_source'::text, 'external'::text, 'inferred'::text, 'system'::text])),
  CONSTRAINT "minds_work_claims_status_check" CHECK (status = ANY (ARRAY['proposed'::text, 'confirmed'::text, 'disputed'::text, 'superseded'::text, 'resolved'::text, 'rejected'::text]))
);
alter table public."minds_work_claims" enable row level security;

create table if not exists public."minds_work_docling_page_chunks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "file_id" uuid NOT NULL,
  "source_version" text NOT NULL,
  "page_start" integer NOT NULL,
  "page_end" integer NOT NULL,
  "total_pages" integer NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "docling_task_id" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "markdown" text DEFAULT ''::text NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_work_docling_page_chunk_file_id_source_version_page_s_key" UNIQUE (file_id, source_version, page_start, page_end),
  CONSTRAINT "minds_work_docling_page_chunks_attempts_check" CHECK (attempts >= 0 AND attempts <= 4),
  CONSTRAINT "minds_work_docling_page_chunks_check" CHECK (page_end >= 1 AND page_end <= 2000 AND page_end >= page_start),
  CONSTRAINT "minds_work_docling_page_chunks_check1" CHECK (total_pages >= 1 AND total_pages <= 2000 AND total_pages >= page_end),
  CONSTRAINT "minds_work_docling_page_chunks_check2" CHECK (status = 'completed'::text AND docling_task_id IS NULL AND jsonb_array_length(segments) > 0 OR status <> 'completed'::text AND jsonb_array_length(segments) = 0),
  CONSTRAINT "minds_work_docling_page_chunks_docling_task_id_check" CHECK (docling_task_id IS NULL OR length(docling_task_id) >= 8 AND length(docling_task_id) <= 192 AND docling_task_id ~ '^[A-Za-z0-9_-]+$'::text),
  CONSTRAINT "minds_work_docling_page_chunks_markdown_check" CHECK (length(markdown) <= 48000),
  CONSTRAINT "minds_work_docling_page_chunks_page_start_check" CHECK (page_start >= 1 AND page_start <= 2000),
  CONSTRAINT "minds_work_docling_page_chunks_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_work_docling_page_chunks_reason_check" CHECK (reason IS NULL OR length(reason) <= 120),
  CONSTRAINT "minds_work_docling_page_chunks_segments_check" CHECK (jsonb_typeof(segments) = 'array'::text AND jsonb_array_length(segments) <= 250),
  CONSTRAINT "minds_work_docling_page_chunks_source_version_check" CHECK (source_version ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "minds_work_docling_page_chunks_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'submitted'::text, 'completed'::text, 'needs_review'::text]))
);
alter table public."minds_work_docling_page_chunks" enable row level security;

create table if not exists public."minds_work_evidence" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "project_id" uuid NOT NULL,
  "claim_id" uuid NOT NULL,
  "source_kind" text DEFAULT 'manual'::text NOT NULL,
  "source_file_id" uuid,
  "source_message_id" uuid,
  "locator" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "excerpt" text,
  "stance" text DEFAULT 'supports'::text NOT NULL,
  "trust_level" text DEFAULT 'reported'::text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_work_evidence_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_work_evidence_source_kind_check" CHECK (source_kind = ANY (ARRAY['work_file'::text, 'email'::text, 'conversation'::text, 'manual'::text, 'external'::text, 'protocol'::text, 'plan'::text, 'note'::text, 'other'::text])),
  CONSTRAINT "minds_work_evidence_stance_check" CHECK (stance = ANY (ARRAY['supports'::text, 'contradicts'::text, 'context'::text])),
  CONSTRAINT "minds_work_evidence_trust_level_check" CHECK (trust_level = ANY (ARRAY['confirmed'::text, 'reported'::text, 'untrusted'::text, 'derived'::text]))
);
alter table public."minds_work_evidence" enable row level security;

create table if not exists public."minds_work_ingest_queue" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "source_version" text,
  "parser_name" text,
  "locked_at" timestamp with time zone,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_backfill" boolean DEFAULT false NOT NULL,
  "docling_task_id" text,
  "docling_started_at" timestamp with time zone,
  CONSTRAINT "minds_work_ingest_docling_task_check" CHECK (docling_task_id IS NULL OR length(docling_task_id) >= 8 AND length(docling_task_id) <= 192 AND docling_task_id ~ '^[A-Za-z0-9_-]+$'::text),
  CONSTRAINT "minds_work_ingest_queue_attempts_check" CHECK (attempts >= 0 AND attempts <= 20),
  CONSTRAINT "minds_work_ingest_queue_file_id_key" UNIQUE (file_id),
  CONSTRAINT "minds_work_ingest_queue_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_work_ingest_queue_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'skipped'::text, 'waiting_parser'::text, 'docling_pending'::text]))
);
alter table public."minds_work_ingest_queue" enable row level security;

create table if not exists public."minds_work_memory" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid DEFAULT auth.uid() NOT NULL,
  "project_id" uuid NOT NULL,
  "memory_type" text NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT ''::text NOT NULL,
  "status" text DEFAULT 'proposed'::text NOT NULL,
  "source_file_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  "provenance" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_work_memory_memory_type_check" CHECK (memory_type = ANY (ARRAY['fact'::text, 'decision'::text, 'open_question'::text, 'commitment'::text, 'deadline'::text, 'person'::text, 'document_state'::text, 'other'::text])),
  CONSTRAINT "minds_work_memory_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_work_memory_status_check" CHECK (status = ANY (ARRAY['proposed'::text, 'confirmed'::text, 'superseded'::text, 'resolved'::text, 'rejected'::text]))
);
alter table public."minds_work_memory" enable row level security;

create table if not exists public."minds_work_source_segments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "file_id" uuid NOT NULL,
  "source_version" text NOT NULL,
  "segment_no" integer NOT NULL,
  "segment_kind" text NOT NULL,
  "locator" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "content" text NOT NULL,
  "extractor" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_work_source_segments_content_check" CHECK (length(content) >= 1 AND length(content) <= 6500),
  CONSTRAINT "minds_work_source_segments_file_id_source_version_segment_n_key" UNIQUE (file_id, source_version, segment_no),
  CONSTRAINT "minds_work_source_segments_locator_check" CHECK (jsonb_typeof(locator) = 'object'::text),
  CONSTRAINT "minds_work_source_segments_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_work_source_segments_segment_kind_check" CHECK (segment_kind = ANY (ARRAY['sheet_rows'::text, 'page_text'::text, 'unpaged_text'::text])),
  CONSTRAINT "minds_work_source_segments_segment_no_check" CHECK (segment_no >= 0 AND segment_no <= 249),
  CONSTRAINT "minds_work_source_segments_source_version_check" CHECK (length(source_version) = 64)
);
alter table public."minds_work_source_segments" enable row level security;

create table if not exists public."minds_work_source_text_receipts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "file_id" uuid NOT NULL,
  "source_version" text NOT NULL,
  "extractor" text NOT NULL,
  "coverage" text NOT NULL,
  "segment_count" integer NOT NULL,
  "content_chars" integer NOT NULL,
  "locator_class" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "minds_work_source_text_receipts_content_chars_check" CHECK (content_chars > 0),
  CONSTRAINT "minds_work_source_text_receipts_coverage_check" CHECK (coverage = ANY (ARRAY['complete_text'::text, 'partial_text'::text])),
  CONSTRAINT "minds_work_source_text_receipts_file_id_source_version_key" UNIQUE (file_id, source_version),
  CONSTRAINT "minds_work_source_text_receipts_locator_class_check" CHECK (locator_class = ANY (ARRAY['worksheet_rows'::text, 'pdf_page'::text, 'unverified_page'::text])),
  CONSTRAINT "minds_work_source_text_receipts_metadata_check" CHECK (jsonb_typeof(metadata) = 'object'::text),
  CONSTRAINT "minds_work_source_text_receipts_pkey" PRIMARY KEY (id),
  CONSTRAINT "minds_work_source_text_receipts_segment_count_check" CHECK (segment_count >= 1 AND segment_count <= 250),
  CONSTRAINT "minds_work_source_text_receipts_source_version_check" CHECK (length(source_version) = 64)
);
alter table public."minds_work_source_text_receipts" enable row level security;

CREATE INDEX IF NOT EXISTS minds_project_model_elements_revision_idx ON public.minds_project_model_elements USING btree (user_id, project_id, revision_id, element_kind);
CREATE UNIQUE INDEX IF NOT EXISTS minds_project_model_one_current_uidx ON public.minds_project_model_revisions USING btree (user_id, project_id) WHERE (status = 'current'::text);
CREATE INDEX IF NOT EXISTS minds_project_model_revisions_project_idx ON public.minds_project_model_revisions USING btree (user_id, project_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS minds_project_model_revision_trigger_uidx ON public.minds_project_model_revisions USING btree (user_id, project_id, trigger_key) WHERE (trigger_key IS NOT NULL);
CREATE INDEX IF NOT EXISTS minds_project_model_variants_revision_idx ON public.minds_project_model_variants USING btree (user_id, project_id, revision_id, status, variant_kind);
CREATE INDEX IF NOT EXISTS minds_project_referents_project_idx ON public.minds_project_referents USING btree (user_id, project_id, status, kind, label);
CREATE UNIQUE INDEX IF NOT EXISTS minds_project_referents_key_uidx ON public.minds_project_referents USING btree (user_id, project_id, canonical_key) WHERE ((canonical_key IS NOT NULL) AND (status = 'active'::text));
CREATE INDEX IF NOT EXISTS minds_project_source_comparison_items_comparison_idx ON public.minds_project_source_comparison_items USING btree (user_id, project_id, comparison_id, source_claim_id);
CREATE INDEX IF NOT EXISTS minds_project_source_comparisons_project_idx ON public.minds_project_source_comparisons USING btree (user_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS minds_project_source_ingestions_project_idx ON public.minds_project_source_ingestions USING btree (user_id, project_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS minds_work_claim_relations_uidx ON public.minds_work_claim_relations USING btree (user_id, project_id, source_claim_id, target_claim_id, relation) WHERE (status = ANY (ARRAY['proposed'::text, 'confirmed'::text]));
CREATE INDEX IF NOT EXISTS minds_work_claim_relations_project_idx ON public.minds_work_claim_relations USING btree (user_id, project_id, status, relation, updated_at DESC);
CREATE INDEX IF NOT EXISTS minds_work_claims_referent_idx ON public.minds_work_claims USING btree (user_id, project_id, referent_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS minds_work_claims_topic_idx ON public.minds_work_claims USING btree (project_id, topic);
CREATE UNIQUE INDEX IF NOT EXISTS minds_work_claims_request_uidx ON public.minds_work_claims USING btree (user_id, ((metadata ->> 'request_id'::text))) WHERE (metadata ? 'request_id'::text);
CREATE INDEX IF NOT EXISTS minds_work_claims_project_idx ON public.minds_work_claims USING btree (user_id, project_id, status);
CREATE INDEX IF NOT EXISTS minds_work_docling_page_chunks_pending ON public.minds_work_docling_page_chunks USING btree (status, updated_at) WHERE (status = ANY (ARRAY['queued'::text, 'submitted'::text]));
CREATE INDEX IF NOT EXISTS minds_work_docling_page_chunks_lookup ON public.minds_work_docling_page_chunks USING btree (file_id, source_version, page_start);
CREATE INDEX IF NOT EXISTS minds_work_evidence_project_idx ON public.minds_work_evidence USING btree (user_id, project_id);
CREATE INDEX IF NOT EXISTS minds_work_evidence_claim_idx ON public.minds_work_evidence USING btree (claim_id);
CREATE INDEX IF NOT EXISTS minds_work_ingest_docling_pending_idx ON public.minds_work_ingest_queue USING btree (next_attempt_at, created_at) WHERE (status = 'docling_pending'::text);
CREATE INDEX IF NOT EXISTS minds_work_ingest_claim_idx ON public.minds_work_ingest_queue USING btree (status, next_attempt_at, created_at) WHERE (status = ANY (ARRAY['queued'::text, 'processing'::text]));
CREATE INDEX IF NOT EXISTS minds_work_memory_project_idx ON public.minds_work_memory USING btree (user_id, project_id, status, memory_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS minds_work_source_segments_project_idx ON public.minds_work_source_segments USING btree (user_id, project_id, file_id, segment_no);
CREATE INDEX IF NOT EXISTS minds_work_source_segments_text_idx ON public.minds_work_source_segments USING gin (to_tsvector('simple'::regconfig, content));

commit;
