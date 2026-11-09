'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const P=require('../terminplan-planning.js');
const E=require('../terminplan-engine.js');
const read=path=>fs.readFileSync(new URL('../'+path,'file://'+__filename),'utf8');
const make=(tasks,calendar={nonWorkingDates:[]})=>({project:{start:'2026-11-02',end:'2026-11-30',calendar},tasks});
const task=(id,start,end,deps=[],extra={})=>({id,start,end,dependencies:deps,...extra});
const dep=(pred,rel='EA',lagDays=1)=>({pred,rel,lagDays});

test('four relation types allow parallelism and multi-predecessor gate',()=>{
  const state=make([
    task('a','2026-11-02','2026-11-04'),
    task('b','2026-11-02','2026-11-06',[dep('a','AA',0)]),
    task('c','2026-11-04','2026-11-06',[dep('a','EE',2)]),
    task('d','2026-11-02','2026-11-06',[dep('b','AE',0)]),
    task('m','2026-11-06','2026-11-06',[dep('b','EA',0),dep('c','EA',0),dep('d','EA',0)],{type:'milestone'})
  ]);
  const result=P.analyze(state);
  assert.equal(result.valid,true,result.reason);
  assert.equal(result.byId.m.critical,true,'final handover is on the critical path');
  assert.ok(result.criticalCount>=1);
  assert.equal(Object.keys(result.byId).length,5);
});

test('critical path has zero total float, parallel branch has positive float',()=>{
  const state=make([
    task('a','2026-11-02','2026-11-04'),
    task('b','2026-11-05','2026-11-06',[dep('a','EA',1)]),
    task('c','2026-11-02','2026-11-02'),
    task('m','2026-11-06','2026-11-06',[dep('b','EA',0)],{type:'milestone'})
  ]);
  const result=P.analyze(state);
  assert.equal(result.valid,true,result.reason);
  for(const id of ['a','b','m'])assert.equal(result.byId[id].totalFloatAT,0);
  assert.equal(result.byId.c.totalFloatAT,4);
  assert.equal(result.byId.c.freeFloatAT,4);
});

test('deadline warns without moving date and can make a task critical',()=>{
  const state=make([
    task('a','2026-11-02','2026-11-05',[],{deadline:'2026-11-05'}),
    task('b','2026-11-02','2026-11-06')
  ]);
  const before=JSON.stringify(state);
  const result=P.analyze(state);
  assert.equal(result.valid,true,result.reason);
  assert.equal(result.byId.a.totalFloatAT,0);
  assert.equal(result.byId.a.critical,true);
  assert.equal(E.analyze(state).issues.filter(x=>x.code==='deadline_overrun').length,0);
  state.tasks[0].deadline='2026-11-04';
  assert.ok(E.analyze(state).issues.some(x=>x.code==='deadline_overrun'&&x.severity==='warning'));
  assert.equal(P.analyze(state).byId.a.deadlineMiss,true);
  assert.equal(JSON.stringify(state).includes('2026-11-06'),true);
  assert.notEqual(JSON.stringify(state),before,'only the test changed the deadline');
});

test('weekend deadline uses prior workday and calendar exceptions shorten remaining buffer',()=>{
  const state=make([
    task('a','2026-11-02','2026-11-04',[],{deadline:'2026-11-07'}),
    task('b','2026-11-06','2026-11-06')
  ],{nonWorkingDates:['2026-11-05']});
  const result=P.analyze(state);
  assert.equal(result.valid,true,result.reason);
  assert.equal(result.byId.a.totalFloatAT,1);
});

test('cycle, missing predecessors and calendar mistakes reject CPM instead of fake critical path',()=>{
  const broken=make([
    task('a','2026-11-02','2026-11-03',[dep('b')]),
    task('b','2026-11-04','2026-11-05',[dep('a')])
  ]);
  assert.equal(P.analyze(broken).valid,false);
  broken.tasks[0].dependencies=[dep('unknown')];
  assert.equal(P.analyze(broken).valid,false);
  broken.tasks[0].dependencies=[];
  broken.tasks[1].dependencies=[];
  broken.tasks[0].start='2026-11-07';
  assert.equal(P.analyze(broken).valid,false);
});

test('append-only snapshots preserve unique id, named state and deviations without changing source',()=>{
  const s=make([task('a','2026-11-02','2026-11-06',[],{effortHours:12})]);
  const original=JSON.stringify(s);
  const first=P.captureBaseline(s,'Freigabe Entwurf','2026-11-09T12:00:00.000Z');
  assert.equal(JSON.stringify(s),original);
  assert.equal(first.state.project.baselines.length,1);
  assert.equal(first.baseline.id,'BL-001');
  assert.equal(first.baseline.tasks[0].effortHours,12);
  first.state.tasks[0].end='2026-11-10';
  const var1=P.baselineVariance(first.state,P.selectedBaseline(first.state));
  assert.equal(var1.a.finishDeltaKT,4);
  const second=P.captureBaseline(first.state,'Besprechung','2026-11-10T12:00:00.000Z');
  assert.equal(second.baseline.id,'BL-002');
  assert.equal(second.state.project.baselines[0].tasks[0].end,'2026-11-06');
  assert.equal(second.state.project.activeBaselineId,'BL-002');
});

test('successor preview moves all affected successors, respects multiple predecessors and never mutates input',()=>{
  const state=make([
    task('a','2026-11-02','2026-11-09'),
    task('b','2026-11-05','2026-11-06'),
    task('c','2026-11-09','2026-11-09',[dep('a','EA',0),dep('b','EA',0)],{type:'milestone'}),
    task('d','2026-11-10','2026-11-12',[dep('c','EA',1)])
  ]);
  const source=JSON.stringify(state);
  const r=P.previewSuccessors(state,'a');
  assert.equal(JSON.stringify(state),source,'preview is isolated');
  assert.equal(r.updates.length,0,'no shift when all successor dependencies already hold');
  state.tasks[0].end='2026-11-11';
  const changed=JSON.stringify(state);
  const next=P.previewSuccessors(state,'a');
  assert.equal(next.updates.length,2);
  assert.equal(JSON.stringify(state),changed);
  assert.equal(next.state.tasks.find(t=>t.id==='c').start,'2026-11-11');
  assert.equal(next.state.tasks.find(t=>t.id==='d').start,'2026-11-12');
  assert.equal(next.afterValid,true);
});

test('same generic analysis works for Office LPH3 and LPH5 and existing legacy pred/rel',()=>{
  const templates=JSON.parse(read('supabase/seed/terminplan-templates.json'));
  const C=require('../office-core.js');
  for(const tpl of templates){
    const plan=C.cloneStateForProject(tpl.state,{start:'2026-11-02',number:'2700',name:'Testprojekt',phase:tpl.phase,version:tpl.version,today:'2026-11-09'});
    assert.equal(P.analyze(plan).valid,true,tpl.phase+' '+P.analyze(plan).reason);
  }
  const legacy=make([
    task('p','2026-11-02','2026-11-03'),
    {...task('s','2026-11-04','2026-11-05'),pred:'p',rel:'EA'}
  ]);
  delete legacy.tasks[1].dependencies;
  assert.equal(P.analyze(legacy).valid,true,P.analyze(legacy).reason);
});

test('all plans load shared analytics UI and illustrated two-part help guide',()=>{
  const html=read('terminplan.html'),ui=read('terminplan-features.js'),guide=read('terminplan-hilfe.html');
  for(const name of ['terminplan-planning.js','terminplan-features.js','terminplan-planning.css'])
    assert.ok(html.includes(name),name+' attached');
  for(const id of ['taskDeadline','taskEffortHours','taskActualStart','taskActualEnd'])assert.ok(html.includes('id="'+id+'"'));
  assert.match(ui,/captureBaseline/);
  assert.match(ui,/previewSuccessors/);
  assert.match(ui,/totalFloatAT/);
  assert.match(guide,/id="werkzeug"/);
  assert.match(guide,/id="planung"/);
  assert.ok((guide.match(/<svg /g)||[]).length>=4);
});

test('browser feature scripts parse and preserve explicit write approval',()=>{
  const vm=require('node:vm');
  assert.doesNotThrow(()=>new vm.Script(read('terminplan-features.js')),'browser UI syntax');
  assert.doesNotThrow(()=>new vm.Script(read('terminplan-planning.js')),'network module syntax');
  const ui=read('terminplan-features.js');
  assert.match(ui,/preview\.signature!==JSON\.stringify\(bridge\.read\(\)\)/,'stale previews rejected');
  assert.match(ui,/root\.confirm\(preview\.updates\.length/,'cascade requires user confirmation');
  assert.match(ui,/bridge\.write\(state\)/,'only explicit confirmation enters revisioned save flow');
  assert.match(ui,/!bridge\.canEdit\(\)/,'write permission checked');
});

test('LPH3 v1.2 migration is exactly the reviewed generic seed and never mutates project instances',()=>{
  const sql=read('supabase/migrations/20261109131000_office_lph3_template_v12.sql');
  const tpl=JSON.parse(read('supabase/seed/terminplan-templates.json')).find(x=>x.phase==='LPH3');
  const match=/\$tpl\$([\s\S]*?)\$tpl\$::jsonb/.exec(sql);
  assert.ok(match,'versioned migration contains a JSONB template');
  assert.deepEqual(JSON.parse(match[1]),tpl.state,'deployed migration must match reviewed seed');
  assert.equal(tpl.version,'1.2');
  assert.doesNotMatch(sql,/office_terminplan_instances|delete\s+from|truncate|drop\s+table/i,
    'existing project instances are not modified');
  assert.ok(tpl.state.tasks.every(t=>!('actualStart' in t)&&!('actualEnd' in t)));
  assert.ok(tpl.state.tasks.every(t=>!t.dependencies.some(d=>'sourceEvidence' in d)));
});
