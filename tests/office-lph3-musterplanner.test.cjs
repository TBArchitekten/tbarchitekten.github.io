'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const planner=JSON.parse(read('app/data/muster-planner-lph3-v0.2.json'));
const templates=JSON.parse(read('supabase/seed/terminplan-templates.json'));
const schedule=templates.find(x=>x.phase==='LPH3'&&x.version==='1.2').state;
const taskById=new Map(schedule.tasks.map(t=>[t.id,t]));
const all=planner.buckets.flatMap(b=>b.tasks.map(t=>({bucket:b,task:t})));

test('LPH3 Musterplanner is draft only, with exactly seven delivery-linked Buckets and no transversal bucket',()=>{
  assert.equal(planner.phase,'LPH3');
  assert.equal(planner.draft,true);
  assert.equal(planner.buckets.length,7);
  assert.ok(planner.buckets.every(b=>b.kind==='Abgabe'&&b.gate&&b.tasks.length>0));
  assert.deepEqual(planner.buckets.map(b=>b.id),['A1','A2','A3','A4','A5','A6','A7']);
  assert.ok(!planner.buckets.some(b=>/ORG|Organisation/i.test(b.id)));
  assert.equal(all.length,57);
  assert.equal(new Set(all.map(x=>x.task.id)).size,57);
  assert.equal(all.reduce((sum,x)=>sum+x.task.checks.length,0),228);
});

test('Every card has an assignable TBA role, documented result and checklist, and no invented effort hours',()=>{
  for(const {bucket,task} of all){
    assert.ok(task.id&&task.title&&task.result&&task.basis&&task.owner&&task.scope,bucket.id+' missing field');
    assert.ok(task.checks.length>=3,task.id+' underdefined checklist');
    assert.ok(task.checks.every(s=>typeof s==='string'&&s.trim()));
    assert.ok(Array.isArray(task.psp)&&task.psp.length);
    assert.equal(task.effortHours,null,task.id+' must not assert unsupported hours');
    assert.ok(!/^(Auftraggeber|Bauherr|TWP|HLS|ELT|BRS|Fachplaner)$/.test(task.owner),
      task.id+' incorrectly makes a third-party delivery an internal TBA task');
  }
});

test('Bemusterung Bucket belongs to REAL LPH3 PSP 04.03 and ends at M06; not invented milestone',()=>{
  const bm=planner.buckets.find(x=>x.id==='A5');
  assert.ok(bm);
  assert.equal(bm.tasks.length,14);
  assert.ok(bm.gate.includes('04.03')&&bm.gate.includes('M06'));
  assert.equal(bm.scheduleReferences.length,2);
  const first=bm.scheduleReferences[0],last=bm.scheduleReferences[1];
  assert.equal(first.taskId,'t030');
  assert.equal(last.taskId,'t031');
  assert.equal(taskById.get('t030').name,'Qualitätsfestlegungen und kostenrelevante Bemusterung abstimmen');
  assert.match(taskById.get('t031').name,/M06.*Abstimmung Entwurfsstand LPH 3/);
  assert.equal(first.dateEnd,taskById.get('t030').end);
  assert.equal(last.date,taskById.get('t031').end);
  assert.equal(taskById.get('t030').type,'task');
  assert.equal(taskById.get('t031').type,'milestone');
  const costs=taskById.get('t039'); // M08 Kostenbesprechung
  assert.ok(costs.name.includes('M08'));
  assert.ok(taskById.get('t030').end<costs.start,'Bemusterung precedes Muster Kostenbesprechung');
});

test('Bemusterung includes distinct decisions, samples, bathroom plans, staircase, façade and cost inputs',()=>{
  const bm=planner.buckets.find(x=>x.id==='A5');
  const ids=bm.tasks.map(t=>t.id);
  for(const id of ['L3-BEM-03','L3-BEM-04','L3-BEM-05','L3-BEM-07','L3-BEM-08',
    'L3-BEM-09','L3-BEM-10','L3-BEM-11','L3-BEM-12','L3-BEM-13','L3-BEM-14']){
    assert.ok(ids.includes(id),'missing Bemusterung task '+id);
  }
  const scope=ids.map(id=>bm.tasks.find(t=>t.id===id)).filter(t=>/^Bedingt/.test(t.scope));
  assert.ok(scope.length>=4,'variable special-plan scope must be explicit');
  assert.ok(planner.buckets.find(b=>b.id==='A6').tasks.some(t=>t.id==='L3-KOS-03'),
    'Kostenberechnung must consume quality selection, not duplicate Bemusterung');
});

test('Former Projektorganisation tasks are mapped to actual linked Abgabe buckets',()=>{
  const a1=planner.buckets.find(b=>b.id==='A1'),a7=planner.buckets.find(b=>b.id==='A7');
  const ids1=new Set(a1.tasks.map(t=>t.id)),ids7=new Set(a7.tasks.map(t=>t.id));
  for(const id of ['L3-ORG-01','L3-ORG-02','L3-ORG-03','L3-ORG-04'])assert.ok(ids1.has(id),id);
  assert.ok(ids7.has('L3-ORG-05'));
  assert.ok(a1.tasks.find(t=>t.id==='L3-ORG-04').scope.includes('Wiederkehrend'));
});

test('Muster is rendered inside EXISTING Office Work Planner (no second custom board or task modal)',()=>{
  const html=read('muster-planner.html'),work=read('app/work.js'),
    detail=read('app/task-detail.js'),office=read('app/office-projects.js'),index=read('app/index.html');
  assert.match(html,/location\.replace\('\.\/app\/#section=work&muster=LPH3'\)/);
  assert.doesNotMatch(html,/id="board"/);
  assert.match(office,/planner\.href='\.\/#section=work&muster=LPH3'/);
  assert.match(work,/function isMusterPlanner\(\)/);
  assert.match(work,/await waitForWork\(renderPlanner\(true\),'Muster-Planner'\)/);
  assert.match(work,/async function renderPlanner\(preview=false\)/);
  assert.match(work,/function taskCard\(t,preview=false\)/);
  assert.match(work,/if\(preview\)return; \/\/ The Muster shares the real Planner renderer, but NEVER its write handlers/);
  assert.match(work,/window\.MINDS_TASK_DETAIL\?\.preview\?\./);
  assert.match(detail,/function preview\(\{task,buckets=\[\],projectName='Muster LPH 3'/);
  assert.match(detail,/if\(ctx\.readOnly\)\{/);
  assert.match(detail,/return; \/\/ No autoguardado, Upload, Checklistenänderung, Archiv oder Zeitplanung/);
  assert.match(index,/work\.js\?v=office44/);
  assert.match(index,/task-detail\.js\?v=office4/);
});

test('Original task editor gains only optional Office metadata and keeps its operational features',()=>{
  const detail=read('app/task-detail.js');
  for(const field of ['taskDetailTaskCode','taskDetailPSP','taskDetailWorkResult',
      'taskDetailProfessionalContext','Prüfbares Arbeitsergebnis','Fachliche Einordnung']){
    assert.ok(detail.includes(field),field);
  }
  for(const feature of ['taskDetailComplete','taskDetailStart','taskDetailDue',
    'taskDetailWorkStatus','taskDetailPriority','taskDetailAddCheck','taskDetailAddFile',
    'taskDetailAddLink','MINDS_TASK_TEAM.allocationsHtml','taskDetailPropose','taskDetailBook']){
    assert.ok(detail.includes(feature),'original task function lost: '+feature);
  }
  assert.match(detail,/metadata:\{\.\.\.current,office_planner:/,'metadata fields are additive');
  assert.match(detail,/ctx\.queue=ctx\.queue\.then\(async\(\)=>/,'updates are sequenced against newest row');
});

test('Existing Project Buckets persist optional description and PSP without touching tasks or Terminplan',()=>{
  const work=read('app/work.js'),migration=read('supabase/migrations/20261113131000_office_planner_bucket_explanation_v1.sql');
  assert.match(work,/id,name,description,terminplan_ref,sort_order,archived/);
  assert.match(work,/work-bucket-explanation/);
  assert.match(work,/workBucketDescription/);
  assert.match(work,/workBucketPlanRef/);
  assert.match(work,/update\(\{name,description,terminplan_ref,updated_at:/);
  assert.match(migration,/alter table public\.minds_work_buckets/);
  assert.doesNotMatch(migration,/drop table|drop column|security definer|disable row level security/i);
});

test('Obsolete second Muster board scripts and stylesheet are no longer used',()=>{
  const fs=require('node:fs');
  assert.equal(fs.existsSync(require('node:path').join(root,'muster-planner.js')),false);
  assert.equal(fs.existsSync(require('node:path').join(root,'muster-planner.css')),false);
});
