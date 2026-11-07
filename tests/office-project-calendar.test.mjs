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
  assert.match(sync,/mine:t\.user_id===user\.id\|\|assigned\.includes\(user\.id\)\|\|linkedTaskIds\.has\(t\.id\)/);
  assert.match(sync,/ownerId:e\.user_id\|\|null,mine:e\.user_id===user\.id/);
  assert.match(sync,/const tasks=\(state\.tasks\|\|\[\]\)\.filter\(own\)\.map/);
  assert.match(sync,/const events=\(state\.events\|\|\[\]\)\.filter\(own\)\.map/);
  assert.match(sync,/if\(kind==='event'&&detail\.after\?\.ownerId&&detail\.after\.ownerId!==user\.id\)return;/);
  assert.match(sync,/category_id:foreign\?\(t\.categoryRowId\|\|null\)/);
});

test('Heute stays yours; Fristen only of your projects', ()=>{
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
