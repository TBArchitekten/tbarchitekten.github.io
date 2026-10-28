# TBA Office · Terminplan Assistent v0.1 (Rule Audit)

Date: 28 October 2026. Repository: TBArchitekten/tbarchitekten.github.io.

## Status and scope
The first increment is a deterministic **rule-checker**, not a language model. It inspects each existing project plan on load and after the editor commits a modification. The collapsible panel below the Gantt reports only facts derivable from recorded dates and predecessor links. It can preview shifting a selected task by an integer number of working days and apply that single shift **only after an explicit user click**. It never silently reschedules dependent tasks.

The read-only Muster remains read-only. No database migration, new Supabase permission or API key is introduced. This increment does not change the origin or persistence shape of existing Office plan records, and does not import personal memories from Isabella/MINDS.

## Deterministic contract
Input: existing project JSON \`{project,groups,tasks}\`. Each task currently supports zero or one \`pred\` and one \`rel\`; this is a limitation of the source model, not a universal construction scheduling rule.

- EA / finish-to-start: successor **start** may not be before the *next working day* after predecessor **end**.
- AA / start-to-start: successor **start** may not be before predecessor **start**.
- EE / finish-to-finish: successor **end** may not be before predecessor **end**.
- AE / start-to-finish: successor **end** may not be before the *next working day* after predecessor **start**.
- All date comparisons use strict ISO calendar dates, UTC calendar arithmetic and a Monday–Friday calendar. No holidays, regional calendars, buffers, lags or partial days.
- Further diagnostics: nonexistent predecessor IDs, cycles, duplicate IDs, unsupported relation types, invalid dates, invalid task intervals, multiday milestones and tasks beyond the project horizon.
- Dependency transitive closure describes potential impact, **not a proven contractual requirement**. Unrecorded dependencies and cross-disciplinary semantics remain unknown.
- Preview uses a deep-cloned state and reports the affected chain and new rule violations. It does not propagate, extend the project horizon or persist until confirmed. Preview is invalidated when local plan content changes.

All outputs must be deterministic for equivalent input. The analyzer neither reads nor writes Supabase and does not call an LLM. It is safe to run against old plans.

## UI and lifecycle
An unobtrusive bottom strip exposes a collapsible panel. Issues can be selected to reveal the associated task in the Gantt. A preview clearly distinguishes proposed versus accepted changes. When manual edits create a new violation, the panel expands and indicates affected successors (if represented in the source). Print A2 continues excluding all application UI. The source plan remains editable via existing controls and existing persistence.

The rule checker must not turn absence of registered violations into an assertion that a real project is conflict-free.

## Tests
\`node --test tests/terminplan-engine.test.cjs\`: UTC validation, working day boundaries, all four relation types, dangling references, cycles, malformed data, project horizon, transitive closure, before/after comparison, immutable preview. Additional GitHub Actions check parses browser scripts. **CI is not browser E2E**; perform an authenticated browser test with two existing plans and check both the collapsed and expanded panel, drag, inline duration edit, preview/apply, reload, Muster read-only and A2 PDF.

## Next increments (not implemented)
1. Validate domain scheduling semantics with TBA users: additional predecessor links, explicit lag, protected external deadlines, regional holidays and work calendars. Extend the model via a migration with a backwards-compatible adapter and test a real project before enabling changes.
2. Add optimistic revision checks / conflict handling for concurrent editors before agent-driven updates: the current JSON document update is last-writer-wins across clients.
3. Introduce a separate Office AI service with scoped authenticated read access, tool arguments checked against a versioned plan snapshot, deterministic calculation of impact, typed proposal, human confirmation and canonical post-write verification with receipts. Reuse **contracts/patterns**, not Isabella's personal data or keys. Never grant an LLM direct writes to templates or plans.
4. Only after stable deterministic acceptance add natural-language commands and provenance-aware possible-dependency suggestions clearly distinguished from documented links.

## Non-goals
No silent propagation, no autonomous edits, no speculative relationship inference, no cross-system memory sharing, no shared Isabella account, no claim of AI reasoning in this release.
