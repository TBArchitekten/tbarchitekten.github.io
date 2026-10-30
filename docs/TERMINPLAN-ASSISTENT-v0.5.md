# TBA Office · Terminplan Assistent v0.5 — Collaborative planning

30 October 2026. Goal: transition from single-command chat to an actual joint planning conversation without direct AI write privileges.

## Evidence motivating change
The user requested in Spanish to split Fachplanung into tasks for TGA, TWP, ELT, Brandschutz and Bauphysik. v0.4 responded "cannot understand" because KI-Modus was off and the fallback v0.3 grammar only recognized narrow shift commands. Even with v0.4 enabled the model could only answer, clarify or shift exactly one activity, with no multi-turn state or multi-task draft.

## Contract
The dedicated Office Edge Function now accepts action=discuss. It independently authenticates the user, reads the chosen project plan using RLS, and recovers at most sixteen recent user/assistant messages scoped to that user and plan. It sends a minimized schedule context plus prior conversation as untrusted data to the selected OpenAI model, with store:false and the existing atomic 25 requests/user/day limit. No MINDS or Isabella memory, prompts, credentials or logs are reused.

The structured model response can be discuss, clarify, shift, or add_tasks. The model is tasked to ask real planning questions when data are missing, especially the discipline scope, parallel work, dates, handovers and owners. The user should be able to refine the proposal over multiple turns instead of issuing a command. Dates must be grounded in an explicit agreement, not invented.

For add_tasks, the model can propose at most eight new activities, each with name, existing Sammelvorgang ID, start/end, owner, type, category, and zero or more predecessor references to **existing** activities. Server-side validation checks the references and basic field constraints. The deterministic browser engine recalculates the exact candidate plan and additional documented issues, with no mutation. The existing approval path uses explicit human confirmation, source fingerprint, server revision/CAS write, and authenticated readback to verify the result.

This incremental contract **only adds new tasks**. It never deletes or silently replaces the original generic Fachplanung activities. Existing dependencies and protected deadlines remain intact. The proposal shows exact names, dates, owners, affected groups and added rule findings. Any unresolved decisions remain conversation.

## Interface
The conversation moves to the top of the expandable assistant panel. The existing strict audit, manual calendar and simple shift preview remain under an expandable "Technische Terminprüfung und Kalender". KI-Modus is opt-in and only available when the independent Office API key is configured. When it is off, complex prompts explicitly ask the user to enable it rather than pretending a rules interpreter is an AI collaborator.

## Acceptance
CI: syntax/DOM verification and multi-turn protocol tests, draft field validation, no-mutation preview, stale revision denial, legacy shift support, readback contract and Office-only RLS history. Before marking the task complete, test with an authenticated Office user on a **new test plan**: activate KI-Modus, request a division of Fachplanung, discuss missing dates, obtain typed draft, reject/revise, confirm, observe new tasks, reload and check server revision/receipt. Then check cross-user privacy and concurrency. CI does not prove model behavior: collect observations before considering the assistant production-accepted.

## Future incremental improvements
No resource/holiday inference, automatic critical path rescheduling, contract semantics or cross-user collaborative decision memory in this version. A future capability can propose edits to existing activities and dependency changes under the same draft/review/receipt mechanism, only after versioned validation rules and explicit human approval.
