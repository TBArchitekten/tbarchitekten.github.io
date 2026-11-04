import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../office-core.js');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Kalender dates: weeks start on Monday, ISO week numbers, a stable six-week month',()=>{
  assert.deepEqual(C.weekDays('2026-11-04'),['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08']);
  assert.deepEqual(C.weekDays('2026-11-08'),C.weekDays('2026-11-02'),'Sunday belongs to the week before');
  assert.equal(C.isoWeek('2026-11-04'),45);
  assert.equal(C.isoWeek('2027-01-01'),53,'1 Jan 2027 is still KW 53 of 2026');
  assert.equal(C.isoWeek('2027-01-04'),1);
  assert.equal(C.weekTitle('2026-11-04'),'KW 45 · 2.–8. November 2026');
  assert.equal(C.weekTitle('2026-12-30'),'KW 53 · 28. Dezember – 3. Januar 2027');
  const grid=C.monthGrid('2026-11-15');
  assert.equal(grid.length,42);assert.equal(grid[0],'2026-10-26');assert.ok(grid.includes('2026-11-30'));
  assert.equal(C.monthTitle('2026-03-02'),'März 2026');
  assert.equal(C.shiftAnchor('2026-01-31','month',1),'2026-02-01');
  assert.equal(C.shiftAnchor('2026-11-04','week',-1),'2026-10-28');
});

test('Kalender content: what is mine, what is due when, what is late',()=>{
  const me='me',other='other';
  const tasks=[
    {id:1,assignee_id:me,created_by:other,due_date:'2026-11-04',title:'b',kind:'aufgabe'},
    {id:2,assignee_id:null,created_by:me,due_date:'2026-11-04',title:'a',kind:'abgabe'},
    {id:3,assignee_id:other,created_by:me,due_date:'2026-11-04',title:'c'},
    {id:4,assignee_id:null,created_by:other,due_date:'2026-11-04',title:'d'},
    {id:5,assignee_id:me,created_by:me,due_date:'2026-11-01',title:'late'},
    {id:6,assignee_id:me,created_by:me,due_date:'2026-11-01',title:'late done',completed_at:'2026-11-02T08:00:00Z'}
  ];
  const mine=C.mineForCalendar(tasks,me);
  assert.deepEqual(mine.map(t=>t.id),[1,2,5,6],'assigned to me, or mine and unassigned');
  assert.deepEqual(C.tasksOnDay(mine,'2026-11-04').map(t=>t.id),[2,1],'Abgaben first');
  assert.deepEqual(C.overdueTasks(mine,'2026-11-04').map(t=>t.id),[5],'done tasks are never late');
  assert.equal(C.dueLabel('2026-11-04','2026-11-04'),'Heute');
  assert.equal(C.dueLabel('2026-11-05','2026-11-04'),'Morgen');
  assert.equal(C.dueLabel('2026-11-03','2026-11-04'),'Gestern');
  assert.equal(C.dueLabel('2026-11-09','2026-11-04'),'Mo., 09.11.');
  assert.equal(C.dueLabel('2027-01-05','2026-11-04'),'Di., 05.01.27');
});

test('The page mirrors the database rules for tasks and buckets',()=>{
  const t={created_by:'a',assignee_id:'b',project_id:'p'};
  assert.equal(C.canEditTask(t,'a',false),true);
  assert.equal(C.canEditTask(t,'b',false),true,'the assignee may edit');
  assert.equal(C.canEditTask(t,'c',false),false);
  assert.equal(C.canEditTask(t,'c',true),true,'the project lead may edit');
  assert.equal(C.canEditTask({...t,project_id:null},'c',true),false,'personal tasks stay personal');
  assert.equal(C.canDeleteTask(t,'b',false),false,'the assignee may not delete');
  assert.equal(C.canDeleteTask(t,'c',true),true);
  assert.equal(C.canEditBucket({created_by:'a'},'a',false),true);
  assert.equal(C.canEditBucket({created_by:'a'},'c',false),false);
  assert.equal(C.nextPosition([{position:3},{position:1}]),4);
  assert.equal(C.nextPosition([]),1);
  assert.deepEqual(C.checklistProgress([{done:true},{done:false}]),{done:1,total:2});
  assert.match(C.taskErrorText({message:'personal_task_is_own'}),/nur Ihnen/);
  assert.match(C.taskErrorText({code:'42501'}),/Berechtigung/);
});

test('Schema: buckets and tasks behind RLS, one rule set for read, write and delete',()=>{
  const sql=read('supabase/migrations/20261104000300_office_planner_v1.sql');
  for(const table of ['office_task_buckets','office_tasks'])assert.match(sql,new RegExp(`alter table public\\.${table} enable row level security;`));
  assert.match(sql,/revoke all on public\.office_task_buckets, public\.office_tasks from public, anon, authenticated;/);
  assert.match(sql,/project_id is not null or created_by = \(select auth\.uid\(\)\) or assignee_id = \(select auth\.uid\(\)\)/,'personal tasks only for their author');
  assert.match(sql,/create function private\.office_can_edit_task\(p_created_by uuid, p_assignee uuid, p_project uuid\)/);
  assert.match(sql,/raise exception 'personal_task_is_own'/);
  assert.match(sql,/raise exception 'bucket_of_other_project'/);
  assert.match(sql,/raise exception 'assignee_not_member'/);
  assert.match(sql,/new\.created_by := old\.created_by;/,'the author never changes');
  assert.match(sql,/new\.completed_at := now\(\);/,'completion time from the server');
  assert.match(sql,/p\.status = 'aktiv'/,'no new tasks in archived projects');
  assert.doesNotMatch(sql,/to anon/);
});

test('Page wiring: Kalender lens, project tabs, Planner before app, no browser dialogs',()=>{
  const index=read('index.html'),planner=read('planner.js'),app=read('app.js');
  assert.match(index,/data-view="kalender" aria-label="Kalender"/);
  assert.match(index,/data-project-tab="panorama"[\s\S]*data-project-tab="planner"/);
  assert.ok(index.indexOf('src="./planner.js')<index.indexOf('src="./app.js'),'planner.js loads before app.js routes');
  assert.match(planner,/\.insert\(\{\.\.\.payload,project_id:projectId,created_by:uid\(\),position:/);
  assert.match(planner,/\.or\(`assignee_id\.eq\.\$\{me\},and\(assignee_id\.is\.null,created_by\.eq\.\$\{me\}\)`\)/);
  assert.match(planner,/btn\.textContent='Wirklich löschen\?'/);
  assert.doesNotMatch(planner,/window\.confirm|\bconfirm\(|\balert\(/);
  assert.match(app,/if\(name==='kalender'\)window\.TBA_PLANNER\?\.openKalender\(\);/);
  assert.match(app,/leadsProject:id=>member\?\.role==='admin'\|\|!!projects\.find/);
});
