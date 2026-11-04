// TBA Office app (./app/): Window's web app copied and connected to the office.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const appIndex=read('app/index.html');
const loaded=[...appIndex.matchAll(/<script src="\.\/([a-z-]+\.js)\?v=[^"]+"><\/script>/g)].map(m=>m[1]);
const src=f=>read('app/'+f);

test('The app connects only to TBA Office, with the office sign-in',()=>{
  assert.match(appIndex,/<script src="\.\.\/office-config\.js\?v=1"><\/script>\s*<script src="\.\.\/shared\/supabase-client\.js\?v=office1"><\/script>/);
  const client=read('shared/supabase-client.js');
  assert.match(client,/const office = window\.TBA_OFFICE_CONFIG;/);
  assert.match(client,/storageKey: office\.storageKey,/,'one session with the start page');
  assert.doesNotMatch(client,/WINDOW_NATIVE|supabase\.co/);
  for(const f of [...readdirSync(new URL('../app/',import.meta.url)).filter(f=>f.endsWith('.js')),'../shared/supabase-client.js']){
    const s=src(f);
    assert.doesNotMatch(s,/[a-z]{20}\.supabase\.co|sb_publishable_|service_role|sb_secret_/,f+' carries no project address or key');
  }
  assert.doesNotMatch(appIndex,/serviceWorker|sw\.js|oauth-consent/);
});

test('Office loads only its own assistant, not personal Window AI modules',()=>{
  for(const f of ['ai.js','bandeja.js','ambient.js','akte-skills.js','credit.js','situation.js','chat-stream-recovery.js'])
    assert.ok(!loaded.includes(f),f+' is not loaded');
  for(const f of ['shell.js','app.js','work.js','ahora.js','sync.js','task-detail.js','office-fristen.js','office-assistant.js'])
    assert.ok(loaded.includes(f),f+' is loaded');
  assert.ok(loaded.indexOf('office-fristen.js')<loaded.indexOf('app.js'));
  const shell=src('shell.js');
  for(const nav of ['bandeja','readings','thoughts'])
    assert.match(shell,new RegExp(`data-nav="${nav}"[^>]*hidden`),nav+' stays hidden');
  assert.match(shell,/data-nav="assistant" aria-label="Romy"/);
  assert.match(shell,/<button data-work-view="desktop">Desktop<\/button>/,'Desktop is now available');
  assert.match(src('office.css'),/\.office-app \[hidden\]\{display:none !important\}/);
  assert.match(src('app.js'),/^const OFFICE=true;$/m);
  assert.match(src('work.js'),/^const OFFICE=true;$/m);
});

test('Sync: members only, everyone sees the projects, own calendar, no realtime',()=>{
  const sync=src('sync.js');
  assert.match(sync,/if\(!user\)\{location\.replace\('\.\.\/'\);return\}/);
  assert.match(sync,/from\('office_members'\)[\s\S]{0,140}\.eq\('is_active',true\)/);
  assert.match(sync,/if\(memberError\|\|!member\|\|member\.must_change_password\)\{location\.replace\('\.\.\/'\);return\}/);
  assert.match(sync,/app\.getState\(\)\.officeOwner!==user\.id/,'another person on this browser starts empty');
  assert.match(sync,/upsert\(categories,\{onConflict:'user_id,client_key'\}\)/);
  assert.match(sync,/from\('isabella_projects'\)\.select\([^)]*\)\.eq\('archived',false\)/);
  assert.doesNotMatch(sync,/\.channel\(|signInWithOtp/);
  assert.match(sync,/function openLogin\(\)\{location\.replace\('\.\.\/'\)\}/);
  const work=src('work.js');
  assert.doesNotMatch(work.match(/async function loadProject[\s\S]*?\n\}/)?.[0]||'',/user_id/,'projects are shared');
});

test('German screens: date formats and the texts people see',()=>{
  for(const f of ['app.js','work.js','ahora.js','task-detail.js','dashboard.js','time-plan.js','task-team.js'])
    assert.doesNotMatch(src(f),/'es-ES'/,f+' formats dates in German');
  const app=src('app.js'),ahora=src('ahora.js'),work=src('work.js');
  assert.match(app,/wd=\['Mo','Di','Mi','Do','Fr','Sa','So'\]/);
  assert.match(app,/`KW \$\{weekNo\(d\)\}`/);
  assert.match(app,/modal\('Neu anlegen',/);
  assert.match(ahora,/>Demnächst<\/h2>/);
  assert.match(ahora,/<\/svg>Aufgabe hinzufügen<\/button>/);
  assert.match(work,/<h2 id="cockpitNext">Nächste 14 Tage<\/h2>/);
  assert.match(src('task-detail.js'),/>Aufgabe anlegen</);
});

test('Fristen are the milestones of the Terminpläne',()=>{
  const fr=src('office-fristen.js');
  assert.match(fr,/from\('office_terminplan_instances'\)[\s\S]{0,120}\.eq\('is_archived',false\)/);
  assert.match(fr,/t\.type!=='milestone'/);
  assert.match(src('ahora.js'),/if\(window\.TBA_OFFICE_FRISTEN\)\{/);
  assert.match(src('app.js'),/if\(window\.TBA_OFFICE_FRISTEN\)\{/);
  // The logic, run on a sample plan.
  const sandbox={};new Function('window',fr)(sandbox);
  const rows=sandbox.TBA_OFFICE_FRISTEN.rowsFrom([
    {id:'p1',project_id:'a',project_name:'Bernried',state:{tasks:[{id:1,type:'milestone',name:'Abgabe Entwurf',start:'2026-11-13'},{id:2,type:'task',name:'Entwurf',start:'2026-11-01'}]},office_projects:{name:'Bernried Wohnhaus',status:'aktiv'}},
    {id:'p2',project_id:'b',state:{tasks:[{id:1,type:'milestone',name:'Alt',start:'2026-12-01'}]},office_projects:{name:'Archiv',status:'archiviert'}}]);
  assert.deepEqual(rows.map(r=>[r.title,r.date,r.project,r.projectKey]),[['Abgabe Entwurf','2026-11-13','Bernried Wohnhaus','a']]);
});

test('Project team: office members only, changed by the lead',()=>{
  const team=src('work-team.js');
  assert.doesNotMatch(team,/from\('isabella_people'\)\s*\.(insert|update)/,'the people list is read only');
  assert.match(team,/from\('minds_work_project_people'\)\.insert\(\{project_id:project\.id,person_id:personId\}\)/);
  assert.match(team,/Nur die Projektleitung oder ein Admin kann das Team ändern\./);
});

test('Schema fix: categories are unique per person',()=>{
  const sql=read('supabase/migrations/20261104000500_office_window_fixes.sql');
  assert.match(sql,/drop constraint isabella_categories_client_key_key;/);
  assert.match(sql,/add constraint isabella_categories_user_client_key unique \(user_id, client_key\);/);
  assert.match(sql,/create index isabella_tasks_project_assignee_idx/);
  assert.match(src('app.js'),/\{id:'arbeit',name:'Arbeit',color:'#6D7278'\},\s*\{id:'personal',name:'Persönlich',color:'#D08A6A'\}/);
});

test('Start page: an empty address opens the app, #password changes the own password',()=>{
  const root=read('app.js');
  assert.match(root,/if\(!location\.hash\|\|location\.hash==='#'\)\{location\.replace\('\.\/app\/'\);return\}/);
  assert.match(root,/if\(location\.hash==='#password'\)\{openPassword\(true\);return\}/);
  const shell=src('shell.js');
  for(const href of ['../#work','../#plans','../#members','../#password'])assert.ok(shell.includes(`href="${href}"`),href);
});
