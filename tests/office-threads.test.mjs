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
  assert.match(fn,/async function threadNote\(db,uid,conversationId\)\{/);
  assert.match(fn,/\.eq\("conversation_id",conversationId\)\.eq\("user_id",uid\)\.maybeSingle\(\)/);
  assert.match(fn,/const \[thread,radar\]=await Promise\.all\(\[threadNote\(db,uid,conversation\.id\)\.catch\(\(\)=>\[\]\),romyRadar\(db,uid\)\]\);/);
  assert.match(read('supabase/functions/office-assistant/romy-continuity.mjs'),/\.\.\.\(notes\|\|\[\]\)\.filter\(Boolean\)\.map\(content=>\(\{role:"developer",content\}\)\)/);
  assert.match(read('app/office-assistant.js'),/\.eq\('user_id',ownerId\)\.eq\('work_thread',false\)/);
});

test('Work shows Threads in the office; Romy answers and stores the messages itself', ()=>{
  const work=read('app/work.js'),shell=read('app/shell.js');
  assert.match(shell,/<button data-work-view="threads">Threads<\/button>/);
  assert.match(work,/return OFFICE&&v==='knowledge'\?'overview':v/);
  assert.match(work,/if\(OFFICE\)\{await sendOfficeThreadMessage\(thread,message,input\);return\}/);
  assert.match(work,/await window\.TBA_ROMY_TRANSPORT\.send\(\{\n      message,conversationId:cid,requestId:crypto\.randomUUID\(\),attachments:\[\],/);
  assert.match(work,/sb\.from\(OFFICE\?'office_assistant_messages':'conversation_messages'\)/);
  assert.match(work,/sb\.storage\.from\(OFFICE\?'office-romy-artifacts':'minds-artifacts'\)/);
  assert.match(work,/action:'review_proposal',proposal_id:card\.dataset\.threadProposal/);
  assert.match(work,/Private Gespräche mit Romy zu einem Thema\. Nur du siehst sie/);
  const section=work.slice(work.indexOf('async function loadThreads'),work.indexOf('async function sendThreadMessage'));
  for(const es of ['Nuevo Thread','Renombrar','Archivar Thread','Todavía no hay Threads','Preguntar en'])
    assert.ok(!section.includes(es),es);
});
