# TBA Office · Terminplan Assistent v0.3 — Conversational interface

## Scope and boundary
This increment adds a working bounded, rule-based conversational interface in the existing Terminplan bottom panel. It is not a connected LLM and does not claim to understand arbitrary language. Supported German/Spanish inputs cover recorded dependencies, rule violations, and selected-task shifts in workdays or workweeks. Unrecognized or ambiguous requests are answered without side effects.

The principle reused from Isabella is the **contract pattern**, not implementation, personal memory, service keys or tables:

1. Interpret: answer is read-only or a typed shift_task_workdays proposal.
2. Proposal: carries request ID, source state fingerprint, expected server revision, target task, workday offset, deterministic preview and audit.
3. Review: recompute against current unchanged local state and expected revision.
4. Confirm: an explicit human click, with extra confirmation for protected deadlines.
5. Execute: refetch revision and server content, then existing authenticated RLS-protected CAS update; no direct agent/model writes.
6. Verify: authenticated server readback must match approved candidate and next revision before a verified receipt is displayed.
7. Failure: fail-closed conflict state, JSON export and reload rather than automatic merging or retry.

## Conversation storage and authority
Project-only Office conversations are stored in public.office_terminplan_dialogue_messages, partitioned by user and protected by RLS office membership and project existence checks. Stored messages are **display history**, not authoritative action events: client-written receipt rows are intentionally tagged display-only. Read-only Muster chats are ephemeral in-browser. There is no reference to Isabella/MINDS accounts or databases.

This increment does not include independent model inference, trusted server-authored receipts or collaborative reconciliation. They require a dedicated Office-only backend and will be evaluated separately.

## Acceptance checklist
Authenticated real project, not a Muster: English/German/Spanish read-only queries where supported, preview 5 Arbeitstage, reject stale proposal after local modification, confirm, CAS update, readback receipt, reload, same user's conversation, cross-user data denied, readonly template, concurrent stale write fails, CSV/PDF A2 unchanged. CI is not browser E2E.

Workweeks map to 5 workdays, explicitly stated. The assistant never auto-propagates or interprets unrecorded contractual dependencies. No provider key is in the public site and no Isabella credentials are reused.
