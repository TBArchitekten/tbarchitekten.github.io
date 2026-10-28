# TBA Office · Terminplan Assistent v0.4: external model adapter

## Trust and scope
This adds a **dedicated Office Edge Function** called office-terminplan-ai to the *Bernried Project Hub Supabase project* because TBA Office currently uses that project as its own backend, but with **new Office-only function, key and data context**. It does not invoke or import any MINDS/Isabella functions, accounts, secrets, or memory. The personal MINDS environment remains entirely separate.

The server receives a valid authenticated user JWT, independently validates it with Supabase Auth, verifies active office_members and RLS-readable project instance, and fetches state server-side. An optional expected revision stops stale requests. It minimizes the context to task identifiers/names/dates/types, explicit dependencies, registered calendar exceptions, protected dates and project phase. It omits free-text notes, owners, personal profiles and project title. All data sent to OpenAI are explicitly part of the selected Office plan.

The model is a **classifier/interpreter, not the schedule engine**: strict structured output answers, clarifies, or proposes ONE identified task shift by a bounded integer number of workdays. It has no write tools, no access to Supabase beyond the read-only request context, no account keys, and no ability to enact a mutation. Task IDs and offset are independently validated on the server and the browser runs the authoritative deterministic preview. v0.3 human review, revision compare-and-swap, protected deadline confirmation, authenticated readback and receipt remain unchanged.

## Secret and billing gate
The function reads only TBA_OFFICE_OPENAI_API_KEY (a separate Office provider API key) and an optional TBA_OFFICE_OPENAI_MODEL. It does NOT fall back to OPENAI_API_KEY shared with MINDS or any project-wide service role. Default pinned model identifier is gpt-4.1-mini. Provider request uses structured JSON Schema, store:false, bounded output and 22 s timeout. Key is never included in public GitHub Pages, Supabase table rows, logs, or returned errors.

Production configuration: Supabase Dashboard -> project mmrteayudgywutghpdev -> Edge Functions -> Secrets. Add TBA_OFFICE_OPENAI_API_KEY. Manage spending limits and key permissions in the dedicated provider project. **Never paste the key into a chat, screenshot, or repository.** Supabase will make the secret available to the deployed function without a further deploy.

## UI
The editor offers KI-Modus only if an authenticated status check verifies the secret is provisioned. It is OFF by default: the user must explicitly enable it after seeing the disclosure that a bounded schedule extract will be sent to an external provider. When not enabled or not configured, the v0.3 deterministic conversation remains available. API failures produce an explicit non-action message and never silently create a local proposal.

## Acceptance
Static tests and CI are necessary but not sufficient. Verify with Edgar and a real project: no secrets -> status deterministic_only; with separate secret -> status ready, controlled question, shift proposal, confirm and server receipt; access denied for nonmember, RLS limited to authorized plan, unsupported text no mutation, concurrent stale revision error, backend provider errors fail closed. Validate no personal MINDS data enters the request payload. Check that older Muster remain read-only and A2 printing is unchanged.

## Limits
No AI execution autonomy, automatic dependent rescheduling, autonomous monitoring, external planning facts, collaborative conflict merging, server-authored audit ledger or multi-turn provider conversation yet. Conversation histories remain user-scoped in Office. The model may generate an imperfect explanation: human review and deterministic schedule checks remain necessary.
