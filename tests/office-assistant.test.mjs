import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261104220000_office_assistant_personal_v1.sql');
const edge=read('supabase/functions/office-assistant/index.ts');

test('Assistant reuses Window chat rather than building another UI',()=>{
  const shell=read('app/shell.js'),html=read('app/index.html');
  const frontend=read('app/office-assistant.js');
  const app=read('app/app.js'),css=read('app/office-assistant.css');
  for(const needle of ['data-nav="assistant" aria-label="Assistent"','id="assistantScreen"','id="messages"','id="chatInput"','id="sendButton"','id="micButton"','id="attachButton"']){
    assert.ok(shell.includes(needle),'Window shell missing '+needle);
  }
  assert.ok(!shell.includes('data-nav="assistant" aria-label="Assistent" hidden'));
  for(const needle of ['office-assistant.js?v=office6','office-assistant.css?v=office6','app.js?v=office6']){
    assert.ok(html.includes(needle),'asset cache not bumped '+needle);
  }
  for(const needle of ['office_assistant_conversations','office_assistant_messages','app()?.setOfficeMessages','window.TBA_OFFICE_ASSISTANT']){
    if(needle==='window.TBA_OFFICE_ASSISTANT')assert.ok(app.includes(needle));
    else assert.ok(frontend.includes(needle),'backend adapter missing '+needle);
  }
  for(const removed of ['workspace.innerHTML','office-chat-layout','office-chat-sidebar','officeChatInput','officeChatForm','isabella-chat','WINDOW_NATIVE','window.MINDS_WORK']){
    assert.ok(!frontend.includes(removed),'Office cannot replace Window UI: '+removed);
  }
  assert.ok(!css.includes('#assistantScreen>.assistant-scroll'));
  assert.ok(!css.includes('#assistantScreen>.composer-wrap'));
  assert.ok(app.includes('OFFICE?{...state,messages:[]}:state'),'Office messages must not be cached in localStorage');
  assert.ok(app.includes('OFFICE?officeChatMessages:normalizeMessages'),'Synced state must not overwrite Office chat');
  assert.ok(frontend.includes('textContent'));
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

test('Personal assistant requests are authenticated and deduplicated without an unapproved quota',()=>{
  const migration=read('supabase/migrations/20261104223000_office_assistant_remove_unapproved_daily_cap.sql');
  const frontend=read('app/office-assistant.js');
  for(const expected of [
    'create or replace function public.office_assistant_reserve',
    'pg_catalog.pg_advisory_xact_lock',
    'office-personal-chat:',
    "return 'duplicate'",
    "return 'reserved'",
    'private.office_is_member',
    'insert into public.office_assistant_requests'
  ])assert.ok(migration.includes(expected),'missing '+expected);
  for(const removed of ['used>=','daily_limit','date_trunc']){
    assert.ok(!migration.includes(removed),'unapproved cap remains: '+removed);
  }
  assert.ok(!edge.includes('daily_limit'));
  assert.ok(!edge.includes('quota_unavailable'));
  assert.ok(edge.includes('request_registration_unavailable'));
  assert.ok(!frontend.includes('daily_limit'));
  assert.ok(!frontend.includes('15 Anfragen'));
  assert.ok(!frontend.includes('quota_unavailable'));
  assert.ok(frontend.includes('request_registration_unavailable'));
  for(const expected of ['office_assistant_reserve','response.ok','store: false','max_output_tokens']){
    assert.ok(edge.includes(expected),'missing '+expected);
  }
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
