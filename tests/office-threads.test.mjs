// Private project Threads in Office Work (decision of Gari, 07.11.2026: private, like Window).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Threads are private Romy conversations bound to a project', ()=>{
  const sql=read('supabase/migrations/20261107130516_office_work_threads_v1.sql');
  assert.match(sql,/add column work_thread boolean not null default false/);
  assert.match(sql,/foreign key \(conversation_id, user_id\)\s+references public\.office_assistant_conversations\(id, user_id\) on delete set null \(conversation_id\)/);
  // Owner only: no admin or colleague reads a Thread.
  for(const op of ['select','insert','update','delete'])
    assert.match(sql,new RegExp(`create policy minds_work_threads_${op}[\\s\\S]{0,160}user_id = \\(select auth\\.uid\\(\\)\\)`));
  assert.doesNotMatch(sql,/office_is_admin|security definer/i,'invoker RPCs, no admin path');
  assert.match(sql,/create unique index minds_work_threads_active_title[\s\S]{0,140}where status = 'active'/);
  for(const fn of ['minds_ensure_work_thread_conversation','minds_rename_work_thread','minds_set_work_thread_status'])
    assert.match(sql,new RegExp(`create function public\\.${fn}\\([^)]*\\) returns \\w+\\s+language plpgsql security invoker set search_path = ''`));
});

test('Romy knows the project of a Thread; Threads stay out of Romy\'s chat list', ()=>{
  const fn=read('supabase/functions/office-assistant/index.ts');
  assert.match(fn,/async function threadNote\(db,uid,conversationId,kontext:any=\{\}\)\{/);
  // Das Projekt des Threads zählt auch den KI-Verbrauch (27.11.2026).
  assert.match(fn,/kontext\.projectId=data\.project_id\|\|null;/);
  assert.match(fn,/\.eq\("conversation_id",conversationId\)\.eq\("user_id",uid\)\.maybeSingle\(\)/);
  assert.match(fn,/const \[thread,radar\]=await Promise\.all\(\[threadNote\(db,uid,conversation\.id,kontext\)\.catch\(\(\)=>\[\]\),romyRadar\(db,uid\)\]\);/);
  assert.match(read('supabase/functions/office-assistant/romy-continuity.mjs'),/\.\.\.\(notes\|\|\[\]\)\.filter\(Boolean\)\.map\(content=>\(\{role:"developer",content\}\)\)/);
  assert.match(read('app/office-assistant.js'),/\.eq\('user_id',ownerId\)\.eq\('work_thread',false\)/);
});

test('Work shows Threads in the office; Romy answers on the shared engine, the server stores the messages', ()=>{
  const work=read('app/work.js'),shell=read('app/shell.js');
  assert.match(shell,/<button data-work-view="threads">Threads<\/button>/);
  // Seit dem 26.11.2026 öffnet «Wissen» im Office das Projektwissen (nicht mehr das Panorama).
  assert.match(work,/view=localStorage\.getItem\('minds-work-view'\)\|\|'overview'/);
  assert.match(work,/:view==='knowledge'\?\(OFFICE\?renderWissen\(\):renderKnowledge\(\)\)/);
  // Un solo motor (28.11.2026): the thread runs on isabella-chat like the chat with Romy; the server writes the
  // question and the answer into the thread's conversation, the page only sends with a request id and reloads.
  assert.doesNotMatch(work,/sendOfficeThreadMessage|TBA_ROMY_TRANSPORT|office_assistant_messages|action:'review_proposal'|office-romy-artifacts/);
  const send=work.slice(work.indexOf('async function sendThreadMessage'),work.indexOf('window.MINDS_WORK='));
  assert.match(send,/await window\.ISABELLA_AI\.ask\(message,state,\{\n      workThread:\{id:thread\.id,project:project\.name\},\n      durableRequestId:crypto\.randomUUID\(\),/);
  assert.doesNotMatch(send,/persistThreadMessage|from\('conversation_messages'\)\.insert/,'the browser writes nothing in the thread');
  assert.match(work,/const \{data,error\}=await sb\.from\('conversation_messages'\)\n    \.select\('client_key,role,content,created_at,metadata'\)/);
  assert.match(work,/sb\.storage\.from\('minds-artifacts'\)/);
  assert.match(work,/KI\('Private Gespräche mit \{wem\} zu einem Thema\. Nur du siehst sie; \{wer\} kennt dabei das Projekt '\)/);
  assert.match(work,/Geben Sie dem Thread einen Namen\./);
  const section=work.slice(work.indexOf('async function loadThreads'),work.indexOf('async function sendThreadMessage'));
  for(const es of ['Nuevo Thread','Renombrar','Archivar Thread','Todavía no hay Threads','Preguntar en'])
    assert.ok(!section.includes(es),es);
});
