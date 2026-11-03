import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../office-core.js');
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('a project copy keeps the Muster and moves dates by working days',()=>{
  const tpl={project:{start:'2027-01-04',end:'2027-01-08',name:'Muster'},groups:[{id:'g'}],tasks:[{id:'a',start:'2027-01-04',end:'2027-01-05'},{id:'b',start:'2027-01-07',end:'2027-01-08'}]};
  const before=JSON.stringify(tpl);
  const s=C.cloneStateForProject(tpl,{start:'2026-11-09',number:'2701',name:'Schule',phase:'LPH3',version:'1.0',today:'2026-11-04'});
  assert.equal(JSON.stringify(tpl),before,'the Muster is never changed');
  assert.equal(s.project.name,'2701 Schule · LPH 3');
  assert.equal(s.project.start,'2026-11-09');
  assert.equal(s.project.end,'2026-11-13');
  assert.deepEqual(s.tasks.map(t=>[t.start,t.end]),[['2026-11-09','2026-11-10'],['2026-11-12','2026-11-13']]);
  assert.equal(s.project.standLabel,'Projektstart');
});

test('own passwords: long enough, repeated correctly',()=>{
  assert.match(C.passwordProblem('kurz','kurz',10),/Mindestens 10/);
  assert.match(C.passwordProblem('langes passwort','anderes passwort',10),/stimmen nicht/);
  assert.match(C.passwordProblem('aaaaaaaaaaaa','aaaaaaaaaaaa',10),/einzigen Zeichen/);
  assert.equal(C.passwordProblem('Augsburg Büro 2026','Augsburg Büro 2026',10),null);
  assert.match(C.authErrorText({code:'weak_password',message:'Password is known to be weak and easy to guess, please choose a different one. (pwned)'}),/Datenlecks/);
});

test('roles and admin errors read in German',()=>{
  assert.equal(C.canLead('admin'),true);assert.equal(C.canLead('projektleiter'),true);assert.equal(C.canLead('member'),false);
  assert.match(C.adminErrorText('last_admin'),/mindestens eine aktive Administration/);
  assert.match(C.adminErrorText('something_else'),/fehlgeschlagen/);
});

test('both pages use the one Office config: the new project, no old keys',()=>{
  const cfg=read('office-config.js'),index=read('index.html'),editor=read('terminplan.html'),app=read('app.js');
  assert.match(cfg,/url:'https:\/\/ynzsbemisjvfgbqcqliq\.supabase\.co'/);
  assert.match(cfg,/key:'sb_publishable_/);
  assert.doesNotMatch(cfg,/service_role|sb_secret_/);
  for(const page of [index,editor])assert.match(page,/<script src="\.\/office-config\.js\?v=1"><\/script>/);
  for(const src of [app,editor])assert.doesNotMatch(src,/mmrteayudgywutghpdev|sb_publishable_P4l/,'nothing points at the Bernried Project Hub');
  assert.match(editor,/supabase\.createClient\(OFFICE\.url,OFFICE\.key/);
  assert.match(app,/supabase\.createClient\(CFG\.url,CFG\.key/);
});

test('sign-in is per person with the office e-mail; no shared start password or name list',()=>{
  const index=read('index.html'),app=read('app.js');
  assert.match(index,/<input id="email" type="email" autocomplete="username"/);
  assert.doesNotMatch(index,/gemeinsames Startpasswort|<option value="edgar">|access\.invalid/);
  assert.doesNotMatch(app,/access\.invalid|OFFICE_USER_EMAILS/);
  assert.match(app,/signInWithPassword\(\{email:\$\('#email'\)\.value\.trim\(\)\.toLowerCase\(\)/);
  // A start password must be replaced before anything else opens, here and in the editor.
  assert.match(app,/if\(member\.must_change_password\)\{openPassword\(false\);return\}/);
  assert.match(read('terminplan.html'),/if\(member\.must_change_password\)\{location\.href='\.\/';return\}/);
  assert.match(app,/sb\.auth\.updateUser\(\{password:pw\}\)/);
  assert.match(app,/sb\.rpc\('office_password_changed'\)/);
});

test('every new Terminplan belongs to an Office project; only leads create projects',()=>{
  const app=read('app.js');
  assert.match(app,/insert\(\{\s*project_id:project\.id,/);
  assert.match(app,/\(lead\?'<option value="__new">\+ Neues Projekt anlegen …<\/option>':''\)/);
  assert.match(read('index.html'),/id="newProjectBtn" class="primary" data-lead-only hidden/);
  assert.match(read('index.html'),/data-view="members" data-admin-only hidden/);
});

test('the editor and the AI function share the edit rule: owner, admin or Projektleiter',()=>{
  const editor=read('terminplan.html'),fn=read('supabase/functions/office-terminplan-ai/index.ts');
  assert.match(editor,/canEdit=member\.role==='admin'\|\|row\.owner_id===userId\|\|leadsProject/);
  assert.match(fn,/const canEdit=plan\.owner_id===auth\.user\.id\|\|member\.role==="admin"\|\|leadsProject/);
  const sql=read('supabase/migrations/20261104000000_office_base_v1.sql');
  assert.match(sql,/p_owner = \(select auth\.uid\(\)\) or \(select private\.office_leads_project\(p_project\)\)/);
});
