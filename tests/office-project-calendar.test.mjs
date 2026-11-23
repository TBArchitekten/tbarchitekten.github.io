// The Kalender is the calendar of your projects (decision of Gari, 07.11.2026); Heute stays yours.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Project Termine are read by the project team; only their author changes them', ()=>{
  const sql=read('supabase/migrations/20261107163056_office_project_calendar_v1.sql');
  assert.match(sql,/create policy isabella_events_project_team_select on public\.isabella_events\s+for select to authenticated/);
  assert.match(sql,/project_id is not null\s+and \(select private\.office_in_project_team\(project_id\)\)/);
  assert.doesNotMatch(sql,/drop policy|for (update|delete|insert|all)/i,'no new write path, nothing removed');
});

test('Kalender loads your projects: all dated tasks and Termine of your teams; only own rows are pushed', ()=>{
  const sync=read('app/sync.js');
  assert.match(sync,/from\('office_project_members'\)\.select\('project_id'\)\.eq\('user_id',user\.id\)/);
  assert.match(sync,/',and\(project_id\.in\.\('\+teamProjectIds\.join\(','\)\+'\),or\(due_date\.not\.is\.null,start_date\.not\.is\.null\)\)'/);
  assert.match(sync,/const filter='user_id\.eq\.'\+user\.id\+\(teamProjectIds\.length\?',project_id\.in\.\('\+teamProjectIds\.join\(','\)\+'\)':''\);/);
  // Since 23.11.2026 (Gari): a task with responsibles is theirs only; without responsibles it stays with its author.
  assert.match(sync,/const verantwortlich=assigned\.includes\(user\.id\)\|\|linkedTaskIds\.has\(t\.id\);/);
  assert.match(sync,/mine:assigned\.length\|\|linkedTaskIds\.has\(t\.id\)\?verantwortlich:t\.user_id===user\.id\}/);
  assert.match(sync,/ownerId:e\.user_id\|\|null,mine:e\.user_id===user\.id/);
  assert.match(sync,/const tasks=\(state\.tasks\|\|\[\]\)\.filter\(own\)\.map/);
  assert.match(sync,/const events=\(state\.events\|\|\[\]\)\.filter\(own\)\.map/);
  assert.match(sync,/if\(kind==='event'&&detail\.after\?\.ownerId&&detail\.after\.ownerId!==user\.id\)return;/);
  assert.match(sync,/category_id:foreign\?\(t\.categoryRowId\|\|null\)/);
});

test('Heute stays yours; Fristen only of your projects', ()=>{
  // Desktop Heute, Plan, the Aufgaben list and the summary show only own tasks (Gari, 23.11.2026).
  const dash=read('app/dashboard.js'),app=read('app/app.js');
  assert.match(dash,/const ownTasks = state => \(state\.tasks \|\| \[\]\)\.filter\(t => t\.mine !== false\);/);
  assert.equal((dash.match(/M\.tasksForDay\(\{\.\.\.state,tasks:ownTasks\(state\)\}/g)||[]).length,2);
  assert.doesNotMatch(dash,/M\.tasksForDay\(state,/);
  assert.match(app,/const listTasks=\(\)=>OFFICE\?state\.tasks\.filter\(t=>t\.mine!==false\):state\.tasks;/);
  assert.match(app,/function tasksPanel\(\)\{\n  const pending=listTasks\(\)/);
  assert.match(app,/function taskGroupPanel\(group\)\{\n  const all=listTasks\(\)/);
  assert.match(app,/activeTask\(x\)&&x\.mine!==false\);\$\('#todaySummary'\)/);
  // The rule itself, on sample rows.
  const rule=(t,me,assigned,linked)=>{const verantwortlich=assigned.includes(me)||linked.has(t.id);return assigned.length||linked.has(t.id)?verantwortlich:t.user_id===me};
  assert.equal(rule({id:1,user_id:'gari'},'gari',[],new Set()),true,'own task without responsibles');
  assert.equal(rule({id:2,user_id:'gari'},'gari',['ana'],new Set()),false,'created by me, Ana is responsible');
  assert.equal(rule({id:2,user_id:'gari'},'ana',['ana'],new Set()),true);
  assert.equal(rule({id:3,user_id:'ana'},'gari',[],new Set()),false,'colleague task without responsibles');
  assert.equal(rule({id:4,user_id:'ana'},'gari',['ana','gari'],new Set()),true);
  assert.match(read('app/ahora.js'),/tasks:\(full\.tasks\|\|\[\]\)\.filter\(t=>t\.mine!==false\),events:\(full\.events\|\|\[\]\)\.filter\(e=>e\.mine!==false\)/);
  const fr=read('app/office-fristen.js');
  assert.match(fr,/from\('office_project_members'\)\.select\('project_id'\)\.eq\('user_id',user\.id\)/);
  assert.match(fr,/\.eq\('is_archived',false\)\.in\('project_id',ids\)/);
  assert.match(fr,/if\(!ids\.length\)return \{data:\[\],error:null\};/);
});

test('Initials show whose it is; "Nur meine" filters; colleagues\' Termine are read-only', ()=>{
  const app=read('app/app.js');
  assert.match(app,/function whoBadge\(item\)\{\n  if\(!item\|\|item\.mine!==false\)return '';/);
  assert.match(app,/const id=item\.assigneePersonIds\?\.\[0\]\|\|item\.assigneePersonId\|\|item\.ownerId;/);
  assert.ok((app.match(/whoBadge\((t|e|item)\)/g)||[]).length>=7,'badge in agenda, week and day');
  assert.match(app,/data-native-only-mine aria-pressed=/);
  assert.match(app,/state\.calendarOnlyMine=!state\.calendarOnlyMine;save\(\);renderCalendar\(\);/);
  assert.match(app,/if\(kind==='event'&&item\.mine===false\)\{/);
  assert.match(app,/\$\$\('\.hours \.event-item\[data-kind="event"\]:not\(\[data-readonly\]\)'\)/);
  assert.match(read('app/minds-calendar-shell.css'),/\.app \.who-badge\{/);
  // The plan filter, run on sample tasks.
  const box={};new Function('window',read('app/calendar-plan.js'))(box);
  const P=box.MINDS_CALENDAR_PLAN;
  assert.equal(P.qualifies({id:'a',mine:false},{onlyMine:true}),false);
  assert.equal(P.qualifies({id:'b',mine:true},{onlyMine:true}),true);
  assert.equal(P.qualifies({id:'c'},{onlyMine:true}),true,'tasks without the flag are own (created here)');
  assert.equal(P.qualifies({id:'a',mine:false},{}),true);
});
