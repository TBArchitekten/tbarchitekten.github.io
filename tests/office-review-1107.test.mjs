// Fixes from Claude's review of PR #16–#39 (07.11.2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Romy sees the last 24 messages, like Window, and keeps a cacheable prompt',()=>{
  const src=read('supabase/functions/office-assistant/index.ts');
  assert.match(src,/const HISTORY_LIMIT=24;/);
  assert.match(src,/\.order\("created_at",\{ascending:false\}\)\.order\("id",\{ascending:false\}\)\s*\.limit\(HISTORY_LIMIT\*2\)/);
  assert.match(src,/\.slice\(0,HISTORY_LIMIT\)\.reverse\(\)/);
  assert.doesNotMatch(src,/range\(from,from\+999\)/,'no full replay of the conversation');
  // The clock lives in the turn input, not in the instructions, so the stable prefix can be cached.
  assert.match(src,/const clockNote=\(\)=>\(\{role:"developer",content:"Aktuelles Datum und Ortszeit \(Europe\/Berlin\): "\+officeLocalNow\(\)\}\);/);
  const request=src.slice(src.indexOf('async function requestModel'),src.indexOf('async function runRomy'));
  assert.doesNotMatch(request,/officeLocalNow/);
  assert.match(src,/Du siehst nur die letzten Nachrichten dieses Gesprächs\. Für Früheres nutze search_semantic_history oder search_conversation_history/);
});

test('Romy input files: inputRefs has its uuid helper',()=>{
  const src=read('supabase/functions/office-assistant/romy-capability-inputs.ts');
  assert.match(src,/function uuid\(v:any\)\{const s=String\(v\|\|""\)\.trim\(\);return ID\.test\(s\)\?s:""\}/);
  assert.match(src,/id=uuid\(raw\?\.id\)/);
});

test('Assignments must belong to the same project as their task',()=>{
  const sql=read('supabase/migrations/20261107062242_office_task_assignees_project_check.sql');
  assert.equal((sql.match(/t\.project_id=office_task_assignees\.project_id/g)||[]).length,2);
  assert.doesNotMatch(sql,/t\.project_id=project_id/);
});

test('Migration files carry the versions recorded in Supabase, without duplicates',()=>{
  const files=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>f.endsWith('.sql'));
  const versions=files.map(f=>f.split('_')[0]);
  assert.equal(new Set(versions).size,versions.length,'no duplicate versions');
  for(const v of versions)assert.match(v,/^\d{14}$/);
  assert.ok(files.includes('20261103222203_office_base_v1.sql'));
  assert.ok(files.includes('20261105155214_office_work_multi_assignees_v1.sql'));
  assert.ok(!files.some(f=>f.startsWith('20261028_')),'old-project migrations live in supabase/legacy-migrations');
});

test('One data model: Window tables, team from office_project_members, old Office tables only copied',()=>{
  const sql=read('supabase/migrations/20261107064831_office_unify_window_model_v1.sql');
  assert.match(sql,/add constraint isabella_tasks_project_assignee_team_fkey\s+foreign key \(project_id, assignee_person_id\) references public\.office_project_members\(project_id, user_id\)\s+on delete set null \(assignee_person_id\)/);
  assert.match(sql,/add constraint minds_work_task_assignees_team_fkey[\s\S]{0,160}references public\.office_project_members\(project_id, user_id\)\s+on delete cascade/);
  assert.match(sql,/create function private\.office_in_project_team\(p_project uuid\)/);
  assert.match(sql,/revoke all on function private\.office_in_project_team\(uuid\) from public, anon;/);
  for(const p of ['isabella_tasks_delete','minds_work_buckets_update','minds_work_buckets_delete'])
    assert.match(sql,new RegExp(`alter policy ${p} `));
  for(const t of ['office_tasks','office_task_buckets','office_task_assignees','office_project_folders','office_project_files'])
    assert.match(sql,new RegExp(`from public\\.${t} `),t+' is copied');
  assert.doesNotMatch(sql,/drop table|truncate|delete from/i,'nothing is deleted without Gari');
});

test('Functions deploy manually from the repo, like Window',()=>{
  const wf=read('.github/workflows/deploy-functions.yml');
  assert.match(wf,/workflow_dispatch:/);
  assert.match(wf,/environment: supabase/);
  assert.match(wf,/PROJECT_REF: ynzsbemisjvfgbqcqliq/);
  assert.match(wf,/node --test tests\/\*\.test\.cjs tests\/\*\.test\.mjs/);
  assert.match(wf,/supabase functions deploy "\$f" --project-ref "\$PROJECT_REF" --use-api --yes/);
  const cfg=read('supabase/config.toml');
  assert.match(cfg,/\[functions\.office-romy-mission-runner\]\nverify_jwt = false/);
  for(const f of ['office-admin','office-assistant','office-terminplan-ai'])
    assert.match(cfg,new RegExp(`\\[functions\\.${f}\\]\\nverify_jwt = true`));
});

test('Romy chat in German: no Isabella or Spanish in the send and voice flow',()=>{
  const app=read('app/app.js');
  assert.match(app,/setChatActivity\('Sende an Romy …'\);orb\('thinking','Denke nach …'\)/);
  assert.match(app,/setChatActivity\('Romy bereitet die Antwort vor …'\)/);
  for(const es of ["'Enviando a Isabella…'","'Escuchando…'","primary.textContent='Enviar'","Respuesta interrumpida"])
    assert.ok(!app.includes(es),es);
  assert.doesNotMatch(read('app/dashboard.js'),/ eventos</);
});

test('Romy: "today" includes overdue and multi-day tasks, like Window', async()=>{
  const src=read('supabase/functions/office-assistant/romy-tools.mjs');
  assert.match(src,/range:\{type:"string",enum:\["today","week"\]\}/);
  assert.match(src,/if\(range\)q=q\.is\("completed_at",null\)\.or\("due_date\.lte\."\+until\+",start_date\.lte\."\+until\);/);
  assert.match(read('supabase/functions/office-assistant/index.ts'),/list_tasks mit range \\"today\\"/);
  // The logic, run on sample rows (the case of 07.11.2026: an open task due 04.11 was missed).
  const {shapeTaskRows}=await import('../supabase/functions/office-assistant/romy-tools.mjs');
  const me='u1',day='2026-11-07';
  const rows=[
    {id:'a',title:'Test',due_date:'2026-11-04',start_date:'2026-11-04',completed_at:null,user_id:me},
    {id:'b',title:'Heute',due_date:'2026-11-07',completed_at:null,user_id:'u2',assignee_person_id:me},
    {id:'c',title:'Mehrtägig',start_date:'2026-11-05',due_date:'2026-11-12',completed_at:null,user_id:'u2'},
    {id:'d',title:'Später',start_date:'2026-11-10',due_date:'2026-11-12',completed_at:null,user_id:me},
    {id:'e',title:'Erledigt',due_date:'2026-11-03',completed_at:'2026-11-03T10:00:00Z',user_id:me},
    {id:'f',title:'Nächste Woche',due_date:'2026-11-13',completed_at:null,user_id:'u2'}];
  const today=shapeTaskRows(rows,{day,range:'today',userId:me,assigned:new Set(['c'])});
  assert.deepEqual(today.map(t=>[t.id,!!t.overdue,!!t.in_progress,!!t.mine]),
    [['a',true,false,true],['b',false,false,true],['c',false,true,true]]);
  assert.ok(today.every(t=>!('user_id' in t)&&!('assignee_person_id' in t)),'no raw ids in the model input');
  assert.deepEqual(shapeTaskRows(rows,{day,range:'week',userId:me}).map(t=>t.id),['a','b','c','d','f']);
  assert.equal(shapeTaskRows(rows,{day,userId:me}).length,6,'without range nothing is filtered');
});
