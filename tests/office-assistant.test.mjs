import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261104220000_office_assistant_personal_v1.sql');
const edge=read('supabase/functions/office-assistant/index.ts');

test('Assistant is present in Office navigation but not Window personal memory',()=>{
  const shell=read('app/shell.js'),html=read('app/index.html'),frontend=read('app/office-assistant.js');
  assert.match(shell,/data-nav="assistant" aria-label="Assistent"/);
  assert.doesNotMatch(shell,/data-nav="assistant" aria-label="Assistent" hidden/);
  assert.match(html,/office-assistant\.js\?v=office4/);
  assert.match(html,/office-assistant\.css\?v=office4/);
  assert.match(frontend,/office_assistant_conversations/);
  assert.match(frontend,/office_assistant_messages/);
  assert.doesNotMatch(frontend,/isabella-chat|WINDOW_NATIVE|window\.MINDS_WORK/);
  assert.match(frontend,/textContent/); // Never render server messages as HTML.
  new Function(frontend);
});

test('Every conversation, message and request belongs to exactly one authenticated owner',()=>{
  for(const table of ['office_assistant_conversations','office_assistant_messages','office_assistant_requests']){
    assert.ok(sql.includes('alter table public.'+table+' enable row level security;'));
    assert.ok(sql.includes('on public.'+table));
  }
  assert.match(sql,/user_id=\(select auth\.uid\(\)\)/);
  assert.match(sql,/foreign key \(conversation_id,user_id\)/);
  assert.match(sql,/grant select on public\.office_assistant_messages,public\.office_assistant_requests to authenticated/);
  assert.doesNotMatch(sql,/grant insert on public\.office_assistant_messages to authenticated/);
  assert.doesNotMatch(sql,/for select to authenticated using\s*\(\(select private\.office_is_admin/);
  assert.doesNotMatch(sql,/to anon;/);
});

test('Personal assistant requests are authenticated and deduplicated, not subject to an unapproved quota',()=>{
  const migration=read('supabase/migrations/20261104223000_office_assistant_remove_unapproved_daily_cap.sql');
  const frontend=read('app/office-assistant.js');
  assert.match(migration,/create or replace function public\\.office_assistant_reserve/);
  assert.match(migration,/pg_catalog\\.pg_advisory_xact_lock/);
  assert.match(migration,/office-personal-chat:/);
  assert.match(migration,/return 'duplicate'/);
  assert.match(migration,/return 'reserved'/);
  assert.match(migration,/private\\.office_is_member/);
  assert.doesNotMatch(migration,/used\\s*>=|daily_limit|date_trunc|per-day model-call/i);
  assert.doesNotMatch(edge,/daily_limit|quota_unavailable/);
  assert.match(edge,/request_registration_unavailable/);
  assert.doesNotMatch(frontend,/daily_limit|15 Anfragen|quota_unavailable/);
  assert.match(frontend,/request_registration_unavailable/);
  assert.match(edge,/office_assistant_reserve/);
  assert.match(edge,/response\\.ok/);
  assert.match(edge,/store: false/);
  assert.match(edge,/max_output_tokens/);
});

test('Provider calls are server-only; no project, calendar or document is read by v1',()=>{
  assert.match(edge,/getUser\(token\)/);
  assert.match(edge,/member\.must_change_password/);
  assert.match(edge,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge,/TBA_OFFICE_OPENAI_API_KEY/);
  assert.match(edge,/gpt-5\.6-luna/);
  assert.match(edge,/gpt-5\.6-terra/);
  assert.match(edge,/response\.ok/);
  assert.doesNotMatch(edge,/from\("minds_work_files"\)|from\("isabella_tasks"\)|from\("isabella_events"\)/);
  assert.match(edge,/conversation_not_found/);
  assert.match(edge,/conversationId/);
  assert.match(edge,/requestId/);
});
