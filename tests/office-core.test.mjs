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


test('LPH3 v1.2 keeps 00–09 PSP, parallel multi-dependency gates and required review stages',()=>{
  const E=require('../terminplan-engine.js');
  const templates=JSON.parse(read('supabase/seed/terminplan-templates.json'));
  const tpl=templates.find(x=>x.phase==='LPH3');
  assert.equal(tpl.version,'1.2');
  assert.equal(tpl.state.project.scheduleModel,'network-v1');
  assert.equal(tpl.state.project.criticalPathState,'not_calculated');
  assert.deepEqual(tpl.state.groups.map(g=>g.wbs),Array.from({length:10},(_,i)=>String(i).padStart(2,'0')));
  assert.equal(tpl.state.tasks.length,57);
  assert.equal(tpl.state.tasks.reduce((sum,t)=>sum+(t.dependencies||[]).length,0),96);
  const byId=new Map(tpl.state.tasks.map(t=>[t.id,t]));
  for(const task of tpl.state.tasks){
    assert.equal(task.status,'Nicht begonnen');
    assert.equal(task.progress,0);
    assert.equal(task.critical,false,'do not falsely infer a critical path');
    assert.ok(Number.isInteger(task.durationAT));
    for(const dep of task.dependencies){
      assert.ok(byId.has(dep.pred),task.id+' has a known predecessor');
      assert.ok(['EA','AA','EE','AE'].includes(dep.rel));
      assert.ok(!('sourceEvidence' in dep),'no PDF-specific provenance');
    }
  }
  for(const [id,days] of [['t009',5],['t014',5],['t028',5],['t054',5],
    ['t007',5],['t047',5],['t038',15],['t040',5],['t049',5],
    ['t019',15],['t020',15],['t021',15],['t033',15],['t034',15],['t035',15]])
    assert.equal(byId.get(id).durationAT,days,id+' correct initial duration');
  assert.equal(byId.get('t051').planningCondition,'commissioning_pending');
  assert.equal(byId.get('t052').planningCondition,'commissioning_pending');
  assert.equal(byId.get('t018').optional,true);
  assert.equal(byId.get('t032').optional,true);
  const incoming=id=>byId.get(id).dependencies.map(d=>d.pred);
  assert.deepEqual(incoming('t022').sort(),['t019','t020','t021'].sort());
  assert.deepEqual(incoming('t036').sort(),['t033','t034','t035'].sort());
  for(const id of ['t030','t027','t015','t044'])assert.ok(incoming('t031').includes(id));
  for(const id of ['t045','t046','t056','t036'])assert.ok(incoming('t047').includes(id));
  assert.ok(incoming('t055').includes('t054'),'final approval follows client review');
  assert.equal(E.analyze(tpl.state).errors,0,'template has no broken dependency, cycle or date');
  const source=JSON.stringify(tpl);
  const copy=C.cloneStateForProject(tpl.state,{
    start:'2026-11-02',number:'2701',name:'Beispiel',phase:'LPH3',version:'1.2',today:'2026-11-09'
  });
  assert.equal(copy.project.start,'2026-11-02');
  assert.equal(copy.project.end>=copy.project.start,true);
  assert.equal(copy.tasks.length,57);
  assert.equal(E.analyze(copy).errors,0,'network is still valid after a different calendar start');
  assert.equal(copy.tasks.reduce((sum,x)=>sum+x.dependencies.length,0),96);
  assert.equal(copy.project.planningAssumptions.fachplanerAlreadyCommissioned,false);
  assert.equal(JSON.stringify(tpl).includes('"projectNumber"'),false);
  assert.equal(JSON.stringify(tpl),source,'copy never mutates the Muster');
});

test('Already commissioned Fachplaner skip the procurement wait but not coordination or fictitious progress',()=>{
  const E=require('../terminplan-engine.js');
  const tpl=JSON.parse(read('supabase/seed/terminplan-templates.json')).find(x=>x.phase==='LPH3');
  const base={start:'2026-11-02',number:'2701',name:'Beispiel',phase:'LPH3',version:'1.2',today:'2026-11-09'};
  const ordinary=C.cloneStateForProject(tpl.state,base);
  const already=C.cloneStateForProject(tpl.state,{...base,fachplanerAlreadyCommissioned:true});
  assert.equal(already.tasks.length,55);
  assert.ok(!already.tasks.some(t=>['t051','t052'].includes(t.id)));
  assert.ok(already.project.end<ordinary.project.end,'no artificial procurement wait');
  assert.equal(already.project.planningAssumptions.fachplanerAlreadyCommissioned,true);
  assert.ok(already.tasks.every(t=>t.status==='Nicht begonnen'&&t.progress===0));
  assert.equal(E.analyze(already).errors,0);
  const gate=already.tasks.find(t=>t.id==='t053');
  assert.match(gate.name,/laut Eingabe/);
});

test('Bavarian holiday calendar is explicit and holiday starts are rejected',()=>{
  const E=require('../terminplan-engine.js');
  const holidays=C.bavarianHolidays(2027);
  for(const date of ['2027-01-06','2027-03-26','2027-03-29','2027-05-06','2027-05-17','2027-05-27','2027-11-01'])
    assert.ok(holidays.includes(date),date+' is a Bavarian statewide holiday');
  assert.ok(!holidays.includes('2027-08-08'),'city-specific Augsburg holiday is not assumed statewide');
  const tpl=JSON.parse(read('supabase/seed/terminplan-templates.json')).find(x=>x.phase==='LPH3');
  const args={number:'2701',name:'Beispiel',phase:'LPH3',version:'1.2',today:'2026-11-09'};
  assert.throws(()=>C.cloneStateForProject(tpl.state,{...args,start:'2027-05-27'}),/Feiertag/);
  assert.throws(()=>C.cloneStateForProject(tpl.state,{...args,start:'2027-05-29'}),/Werktag/);
  const plan=C.cloneStateForProject(tpl.state,{...args,start:'2027-03-30'});
  assert.equal(plan.project.calendar.region,'DE-BY');
  assert.ok(plan.project.calendar.nonWorkingDates.includes('2027-05-27'));
  for(const t of plan.tasks){
    assert.equal(E.workday(t.start,E.calendarOf(plan)),true,t.id+' starts on workday');
    assert.equal(E.workday(t.end,E.calendarOf(plan)),true,t.id+' ends on workday');
  }
  assert.equal(E.analyze(plan).errors,0);
});

test('LPH 5 accepts a past Projektstart without changing its independent Muster',()=>{
  const tpl=JSON.parse(read('supabase/seed/terminplan-templates.json')).find(x=>x.phase==='LPH5');
  const before=JSON.stringify(tpl);
  const plan=C.cloneStateForProject(tpl.state,{
    start:'2026-11-02',number:'2702',name:'Beispiel',phase:'LPH5',version:tpl.version,today:'2026-11-09'
  });
  assert.equal(plan.project.start,'2026-11-02');
  assert.equal(plan.project.phase,'LPH5');
  assert.equal(plan.tasks.length,tpl.state.tasks.length-5,'Post-Ausgabe-Optionen werden nicht stillschweigend geplant');
  assert.equal(plan.project.planningAssumptions.includePostIssueLPH5,false);
  assert.equal(JSON.stringify(tpl),before);
});

test('Office plan creation previews dates and keeps manual approval',()=>{
  const ui=read('app/office-projects.js');
  assert.match(ui,/officeCreatePlanPreview/);
  assert.match(ui,/updatePlanPreview\(\)/);
  assert.match(ui,/Startdatum in der Vergangenheit/);
  assert.match(ui,/fachplanerAlreadyCommissioned/);
  assert.match(ui,/core\.cloneStateForProject/);
  assert.match(ui,/type="submit" class="primary">Terminplan anlegen/);
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
  // In the browser the plan sends a start password to the start page; in the Window app it says so (no second sign-in there).
  assert.match(read('terminplan.html'),/if\(member\.must_change_password\)\{\n\s*if\(inApp\)\{document\.body\.innerHTML='<div class="empty">Bitte zuerst im Browser auf tbarchitekten\.github\.io das Startpasswort ändern\.<\/div>';return\}\n\s*location\.href='\.\/';return\}/);
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
  const sql=read('supabase/migrations/20261103222203_office_base_v1.sql');
  assert.match(sql,/p_owner = \(select auth\.uid\(\)\) or \(select private\.office_leads_project\(p_project\)\)/);
});

test('Window design: helpers for the account avatar, the next milestone and the address bar',()=>{
  assert.equal(C.initials('Edgar Martínez'),'EM');
  assert.equal(C.initials('titus'),'TI');
  assert.equal(C.initials('natalia.k@bernhardarchitekten.com'),'NK');
  assert.equal(C.initials(''),'·');
  const state={tasks:[{type:'milestone',name:'Alt',start:'2026-01-01'},{type:'task',name:'Arbeit',start:'2026-12-01'},
    {type:'milestone',name:'Abgabe Entwurf',start:'2027-02-12'},{type:'milestone',name:'Kick-off',start:'2026-11-20'}]};
  assert.equal(C.nextMilestone(state,'2026-11-04').name,'Kick-off');
  assert.equal(C.nextMilestone(state,'2027-03-01'),null);
  assert.equal(C.nextMilestone(null,'2026-11-04'),null);
  const id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  assert.deepEqual(C.viewFromHash('#project='+id),{view:'project',id,tab:'panorama'});
  assert.deepEqual(C.viewFromHash('#project='+id+'/planner'),{view:'project',id,tab:'planner'});
  assert.deepEqual(C.viewFromHash('#kalender'),{view:'kalender',id:null,tab:null});
  assert.deepEqual(C.viewFromHash('#project=not-a-uuid'),{view:'work',id:null,tab:null});
  assert.deepEqual(C.viewFromHash('#members'),{view:'members',id:null,tab:null});
  assert.deepEqual(C.viewFromHash(''),{view:'work',id:null,tab:null});
  assert.equal(C.hashFor('project',id,'planner'),'#project='+id+'/planner');
  assert.equal(C.hashFor('project',id),'#project='+id);
  assert.equal(C.hashFor('tools'),'#tools');
});

test('Window design: sidebar of views, Mitglieder in the account menu, one id per element',()=>{
  const index=read('index.html'),css=read('style.css'),app=read('app.js');
  const ids=[...index.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(ids.filter((x,i)=>ids.indexOf(x)!==i),[],'no duplicate ids');
  for(const view of ['work','tools'])assert.match(index,new RegExp(`class="lens-nav-item[^"]*" data-view="${view}"`));
  assert.match(index,/<div id="accountMenu" class="account-menu" role="menu" hidden>[\s\S]*data-view="members" data-admin-only hidden[\s\S]*id="changePasswordBtn"[\s\S]*id="logoutBtn"/);
  assert.match(index,/<section id="projectView"[\s\S]*id="projectNewPlanBtn" class="primary"/);
  // One blue for actions, Window tokens, cards with a hairline.
  assert.match(css,/--m-blue:#0062cc;/);
  assert.match(css,/button\.primary\{[^}]*background:var\(--m-blue\)/);
  assert.match(css,/--m-type:-apple-system/);
  assert.doesNotMatch(css,/Arial,Helvetica,sans-serif\}/,'no Arial page font');
  // Projects open their page; the dialog preselects the project.
  assert.match(app,/card\.onclick=\(\)=>switchView\('project',\{id:p\.id\}\)/);
  assert.match(app,/\$\('#projectNewPlanBtn'\)\.onclick=\(\)=>openCreate\('LPH3',currentProjectId\)/);
  assert.match(app,/if\(name==='members'&&member\?\.role!=='admin'\)name='work';/);
});

test('Window design: the editor uses the same chrome and returns to the Terminplan library',()=>{
  const editor=read('terminplan.html'),css=read('window-editor.css');
  assert.match(editor,/<link rel="stylesheet" href="\.\/window-editor\.css\?v=1">/);
  assert.match(editor,/<a href="\.\/app\/#section=plans" id="officeBack">‹ Terminpläne<\/a>/);
  assert.match(editor,/back\.href='\.\/app\/#section=plans'/);
  assert.match(css,/--accent:#0062cc;/);
  assert.match(css,/@media print\{html,body\{font-family:Arial,Helvetica,sans-serif\}\}/,'print layout keeps its font');
});
