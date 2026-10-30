# TBA Office · Terminplan Assistant v0.6
Date: 2026-10-30. Base: main 8049fe6. Scope: TBArchitekten/tbarchitekten.github.io; Office Supabase mmrteayudgywutghpdev.

## Design
The assistant is a separate fixed-position macOS-inspired window with restrained typography, corners, light surfaces, shadows, collapse and widen controls. It does not resize the Gantt. The technical audit and calendar remain as expandable details. Mobile sizes respond to viewport width. Assistive labels, keyboard close and reduced-motion preferences are supported.

## Intelligence and tool authority
Default model: gpt-5.4 (medium reasoning), dedicated Office key, existing per-user daily quota. OpenAI hosted Responses API web_search tool with auto use is available without Firecrawl. Search is triggered by the model for public evidence, not every turn. Generic public queries only: NEVER send confidential project names, person names, private dates or chat contents as web queries. API source annotations are shown as HTTPS links. They cannot become approved project facts merely by appearing in an answer.
Free-form conversation is not reduced to a rule catalogue. Deterministic constraints apply to consequential edits: shift one task, add up to 8 tasks, or edit up to 8 existing tasks (dates, owner, registered predecessor links). Always show proposal, recompute candidate against source state, require explicit human approval, CAS write against revision and verify by authenticated server readback. No model gets direct write access or secret keys.
An enabled AI session can evaluate saved manual planning changes and offer a bounded informational suggestion, throttled to one review request per two minutes per tab. A review cannot create a proposal or execute a mutation. No monitoring is promised when the page is closed.

## Evidence-grounded German practice (not fixed templates)
HOAI Anlage 10.1: German federal source for Gebäude und Innenräume. LPH 3 includes integrated design, Fachplaner coordination/integration, Kostenberechnung, and continuing the Terminplan. LPH 5 includes execution-ready details, coordination/integration and continuing the Terminplan. https://www.gesetze-im-internet.de/hoai_2013/anlage_10.html
HOAI Anlage 14.1: Tragwerksplanung for phases, e.g. Schalpläne and execution drawings in LPH 5. https://www.gesetze-im-internet.de/hoai_2013/anlage_14.html
HOAI Anlage 15.1: Technische Ausrüstung, including Ausführungszeichnungen and Schlitz-/Durchbruchsplanung in LPH 5. https://www.gesetze-im-internet.de/hoai_2013/anlage_15.html
DIN 276:2018-12 publisher listing (metadata only; no paid full text). https://www.dinmedia.de/de/norm/din-276/293154016
HOAI is not a contract-specific mandatory schedule. Architecture, TWP, TGA, ELT, Brandschutz and Bauphysik are possible interfaces; their participation and dates must be confirmed from the particular project and contract. The expert lens prioritizes professional inference and transparency, not a universal list of tasks.

## MINDS patterns, without MINDS content
Examined source files in MINDS repository: turn-capability-contract.mjs (scoped history, do not misclassify tool-capable turns by keywords), work-source-browse.mjs (bounded traceable retrieval), capability-runtime.ts (tool boundary), relationship-policy.ts (professional proactivity and honest feedback pattern). Reused principles and design only, NOT personal relationship content, memories, identities, credentials, user data or permissions. Office remains independent and RLS-authorized.

## Acceptance
Run CI: JS parser, DOM identifiers, existing plan templates, deterministic preview and multi-task edits, model tools/source safety, readback and RLS. Verify Edge Function JWT auth, quota, deployment and Pages. Authenticated browser acceptance remains separate: floating window over Gantt, German/Spanish domain research with clickable sources, manually edited dependency triggering advisory, deliberate multi-task approval with verified readback, concurrency, read-only Muster and A2 printing. No claims of full E2E without testing.

## Firecrawl
Not installed: native OpenAI web_search already handles general current research with source annotations. Add a separate crawler only after establishing a need for repeatable extraction from approved websites, with data classification, cost and ingestion provenance controls.