# TBA Office · Terminplan Assistent v0.2

28 October 2026. Scope: domain dependency model and revision-safe persistence.
This is **not** an Isabella deployment or an autonomous language-model agent.

## Already implemented in this version
The existing Office Terminplan editor now accepts multiple explicitly recorded predecessor links per task. The representation is \`task.dependencies=[{pred,rel,lagDays}]\`. EA, AA, EE and AE continue to accept same-day boundary handover when \`lagDays=0\`. Nonzero lag is a signed **working-day** offset; it is not an implicit duration or an inferred calendar. The editor keeps the legacy \`pred/rel\` projection of the first link, and old plans with only \`pred/rel\` continue to be readable. Legacy data are not mass-rewritten. Multiple arrows also appear in the interactive Gantt and printed plan.

Each project can explicitly register \`project.calendar.nonWorkingDates\` (ISO dates) from the assistant panel. These exceptions affect dependency lag and workday durations. No Bavarian, national or municipal holidays are auto-invented. A task may optionally define \`protectedDate\` as a latest finish. The engine warns about overruns, while manual date changes beyond that date require confirmation; the underlying contract or legal authority of the date is **not** inferred. The engine continues to detect missing links, cycles, invalid dates and invalid/duplicate relationships, and generates non-mutating previews. It never cascades dates automatically.

## Persistence model
The new Supabase \`office_terminplan_instances.server_revision\` column starts at 1. An invoker trigger increments revision on every UPDATE (including legacy writes). The editor reads the number and performs an **atomic conditional update** filtering by both ID and expected revision; a successful save returns the next revision. If zero rows are returned, a request errors, or revision acknowledgement is ambiguous, autosave stops and exposes two user actions: export the local unsaved JSON and reload the server version. The editor does not silently retry a possibly committed update and does not overwrite a known newer revision.

A template is never updated by this editor. The schema migration changes only the Office project-instance table; Bernried tables are untouched. Existing RLS policy still allows edit by owner or Office admin, and read for active Office members. This is NOT real-time coediting or automatic conflict merging.

## Acceptance and limits
Node tests cover v0.1 legacy compatibility, multiple predecessors, positive/negative lags, weekend + explicit calendar exceptions, cycle detection, protected dates and immutable preview. Static editor tests check CAS, conflict recovery and exported HTML hooks. An authenticated two-session test (Edgar/Titus with actual edit access) must verify a concurrent stale write fails without modifying the newer server state. It is not proven merely by CI success.

Office users should reload their old open editor tabs before new edits after deployment. An already-open legacy tab predating this release can still submit an unconditional update until refreshed. A future server-only write API will remove this remaining legacy-client limitation. Until then do not claim adversarial/legacy clients are blocked.

The scheduling engine does not yet represent external contractual evidence, multiple regional work calendars, per-resource capacity or automatic schedule optimization. The AI language interface and Isabella-derived proposal/receipt protocol remain separate future steps.
