'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const planner=JSON.parse(read('app/data/muster-planner-lph3-v0.3.json'));
const previous=JSON.parse(read('app/data/muster-planner-lph3-v0.2.json'));
const templates=JSON.parse(read('supabase/seed/terminplan-templates.json'));
const schedule=templates.find(x=>x.phase==='LPH3'&&x.version==='1.3').state;
const taskById=new Map(schedule.tasks.map(t=>[t.id,t]));
const all=planner.buckets.flatMap(b=>b.tasks.map(t=>({bucket:b,task:t})));
const pspOf=(()=>{const wbs=new Map(schedule.groups.map(g=>[g.id,g.wbs])),n={},m=new Map();
  for(const t of schedule.tasks){n[t.group]=(n[t.group]||0)+1;m.set(t.id,wbs.get(t.group)+'.'+String(n[t.group]).padStart(2,'0'))}
  return id=>m.get(id)})();
const origin=key=>{const m=new Map();for(const {bucket,task} of all)for(const o of task.origin[key])m.set(o,[...(m.get(o)||[]),{bucket:bucket.id,id:task.id}]);return m};

test('LPH3 Musterplanner is draft only, with exactly seven delivery-linked Buckets and no transversal bucket',()=>{
  assert.equal(planner.phase,'LPH3');
  assert.equal(planner.draft,true);
  assert.equal(planner.version,'0.3.1-draft');
  assert.equal(planner.buckets.length,7);
  assert.ok(planner.buckets.every(b=>b.kind==='Abgabe'&&b.gate&&b.tasks.length>0));
  assert.deepEqual(planner.buckets.map(b=>b.id),['A1','A2','A3','A4','A5','A6','A7']);
  assert.ok(!planner.buckets.some(b=>/ORG|Organisation/i.test(b.id)));
  assert.equal(all.length,52);
  assert.equal(new Set(all.map(x=>x.task.id)).size,52);
  assert.equal(all.reduce((sum,x)=>sum+x.task.checks.length,0),334);
});

test('Every card has an assignable TBA role, documented result and checklist, and no invented effort hours',()=>{
  for(const {bucket,task} of all){
    assert.ok(task.id&&task.title&&task.result&&task.basis&&task.owner&&task.scope,bucket.id+' missing field');
    assert.match(task.id,/^L3\.([A-Z]{3}\.[1-3]|A[1-7]\.(PRF|AUS|ABS))$/,'stable code L3.<Objekt>.<Zustand>');
    assert.ok(task.checks.length<=10,task.id+' checklist as long as needed, at most 10');
    assert.ok(task.checks.every(s=>typeof s==='string'&&s.trim()));
    assert.deepEqual(task.checkCodes,task.checks.map((_,i)=>task.id+'-'+String(i+1).padStart(2,'0')));
    assert.ok(Array.isArray(task.psp)&&task.psp.length);
    assert.equal(task.effortHours,null,task.id+' must not assert unsupported hours');
    assert.ok(!/^(Auftraggeber|Bauherr|TWP|HLS|ELT|BRS|Fachplaner)$/.test(task.owner),
      task.id+' incorrectly makes a third-party delivery an internal TBA task');
  }
});

test('Every Abgabe has one Ausgabe card (label Abgabe) and one Abschluss card, linked to real Vorgänge',()=>{
  for(const b of planner.buckets){
    const aus=b.tasks.filter(t=>t.step==='Ausgeben'),abs=b.tasks.filter(t=>t.step==='Abschließen');
    assert.equal(aus.length,1,b.id+' Ausgabe');
    assert.equal(abs.length,1,b.id+' Abschluss');
    assert.deepEqual(aus[0].labels,['Abgabe']);
    assert.ok(b.tasks.filter(t=>t.step!=='Ausgeben').every(t=>!t.labels.includes('Abgabe')));
    const out=b.scheduleReferences.find(r=>r.role==='Ausgabe'),done=b.scheduleReferences.find(r=>r.role==='Abschluss');
    assert.ok(aus[0].schedule.executes.includes(out.taskId),b.id+' Ausgabe executes its Vorgang');
    const absRefs=[...abs[0].schedule.executes,...abs[0].schedule.waitsFor,abs[0].schedule.anchor?.taskId];
    assert.ok(absRefs.includes(done.taskId),b.id+' Abschluss bound to its Vorgang');
    for(const r of b.scheduleReferences){
      const v=taskById.get(r.taskId);
      assert.ok(v,r.taskId+' exists in Muster-Terminplan v1.3');
      assert.equal(r.name,v.name);assert.equal(r.psp,pspOf(r.taskId));
      if(v.type==='milestone')assert.equal(r.date,v.end);else assert.equal(r.dateEnd,v.end);
      assert.ok(b.gate.includes(pspOf(r.taskId)),b.id+' gate shows PSP '+pspOf(r.taskId));
    }
  }
});

test('Results are linked as one system: every requirement is produced once and in time by the Muster-Terminplan',()=>{
  const producer=new Map();
  for(const {task} of all)for(const e of task.produces){assert.ok(!producer.has(e),e+' produced twice');producer.set(e,task)}
  for(const {task} of all){
    for(const id of [...task.schedule.executes,...task.schedule.waitsFor])assert.ok(taskById.has(id),task.id+' → '+id);
    assert.equal(task.schedule.noOwnActivity,false,task.id+' has its own Vorgang or anchor');
    for(const need of task.requires){
      const p=producer.get(need);
      assert.ok(p,task.id+' requires unknown result '+need);
      assert.ok(p.schedule.templateEnd<=task.schedule.templateEnd,
        task.id+' ('+task.schedule.templateEnd+') needs '+need+' from '+p.id+' ('+p.schedule.templateEnd+')');
    }
  }
  const linked=new Set(all.flatMap(({task})=>[...task.schedule.executes,...task.schedule.waitsFor,task.schedule.anchor?.taskId].filter(Boolean)));
  assert.deepEqual(schedule.tasks.map(t=>t.id).filter(id=>!linked.has(id)),[],'every Vorgang is executed, awaited or anchors a card');
  assert.ok(planner.validation.every(v=>v.result!=='FEHLER'));
});

test('Bemusterung Bucket uses the REAL v1.3 preparation, handover, Abstimmung and M06',()=>{
  const bm=planner.buckets.find(x=>x.id==='A5');
  assert.ok(bm);
  assert.equal(bm.tasks.length,10);
  assert.deepEqual(bm.scheduleReferences.map(r=>[r.taskId,r.role]),[['t059','Ausgabe'],['t030','Weiterer Vorgang'],['t031','Abschluss']]);
  assert.equal(taskById.get('t058').name,'Bemusterungsunterlagen vorbereiten · Qualitäten, Materialien und Themenpläne');
  assert.equal(taskById.get('t059').name,'Bemusterungsunterlagen an Auftraggeber übergeben');
  assert.equal(taskById.get('t030').name,'Qualitätsfestlegungen und kostenrelevante Bemusterung abstimmen');
  assert.match(taskById.get('t031').name,/M06.*Abstimmung Entwurfsstand LPH 3/);
  assert.equal(taskById.get('t058').type,'task');
  assert.equal(taskById.get('t059').type,'milestone');
  assert.equal(taskById.get('t030').type,'task');
  assert.equal(taskById.get('t031').type,'milestone');
  assert.ok(bm.gate.includes('M06'));
  const prep=bm.tasks.filter(t=>t.step==='Erarbeiten');
  assert.equal(prep.length,8);
  assert.ok(prep.every(t=>t.schedule.executes.length===1&&t.schedule.executes[0]==='t058'),'preparation executes t058');
  assert.ok(prep.every(t=>t.schedule.templateEnd===taskById.get('t058').end));
  assert.deepEqual(bm.tasks.find(t=>t.id==='L3.A5.AUS').schedule.executes,['t059']);
  assert.deepEqual(bm.tasks.find(t=>t.id==='L3.A5.ABS').schedule.executes,['t030','t031']);
  assert.match(bm.tasks.find(t=>t.id==='L3.A5.ABS').checks[0],/Bemusterungstermin/);
  const costs=taskById.get('t039'); // M08 Kostenbesprechung
  assert.ok(costs.name.includes('M08'));
  assert.ok(taskById.get('t030').end<costs.start,'Bemusterung precedes Muster Kostenbesprechung');
});

test('Bemusterung includes distinct decisions, samples, bathroom plans, staircase, façade, light and cost inputs',()=>{
  const bm=planner.buckets.find(x=>x.id==='A5');
  const ids=bm.tasks.map(t=>t.id);
  for(const id of ['L3.QUA.1','L3.MAT.1','L3.MUS.1','L3.MAP.1','L3.BAD.1','L3.TRE.1','L3.FAS.1','L3.LIC.1'])
    assert.ok(ids.includes(id),'missing Bemusterung task '+id);
  const m=origin('muster_v021');
  for(const id of ['L3-BEM-03','L3-BEM-04','L3-BEM-05','L3-BEM-07','L3-BEM-08',
    'L3-BEM-09','L3-BEM-10','L3-BEM-11','L3-BEM-12','L3-BEM-13','L3-BEM-14'])
    assert.ok((m.get(id)||[]).some(x=>x.bucket==='A5'),'v0.2.1 Bemusterung task '+id+' merged into A5');
  const scope=bm.tasks.filter(t=>/^Bedingt/.test(t.scope));
  assert.ok(scope.length>=4,'variable special-plan scope must be explicit');
  assert.ok(planner.buckets.find(b=>b.id==='A6').tasks.some(t=>t.id==='L3.KOB.1'&&t.requires.includes('QUA.2')),
    'Kostenberechnung must consume quality selection, not duplicate Bemusterung');
});

test('Former Projektorganisation tasks are mapped to actual linked Abgabe buckets',()=>{
  const m=origin('muster_v021');
  for(const id of ['L3-ORG-01','L3-ORG-02','L3-ORG-03'])assert.ok(m.get(id).every(x=>x.bucket==='A1'),id);
  assert.ok(m.get('L3-ORG-05').every(x=>x.bucket==='A7'));
  assert.match(planner.retired.muster_v021['L3-ORG-04'],/Terminplan/,'recurring Terminplan update is a checkpoint, not a card');
  // HOAI LPH 3 f): fortgeschriebener Terminplan in jeder Ausgabe; in A7 als Teil der Entwurfsdokumentation L3.DOK.1.
  for(const b of planner.buckets){
    const holder=b.id==='A7'?b.tasks.find(t=>t.id==='L3.DOK.1'):b.tasks.find(t=>t.step==='Ausgeben');
    assert.ok(holder.checkBlocks.includes('F'),b.id+' updates Terminplan (HOAI LPH 3 f)');
  }
});

test('Concordance: every card of the previous Muster v0.2.1 is mapped or explicitly retired',()=>{
  const m=origin('muster_v021');
  for(const b of previous.buckets)for(const t of b.tasks)
    assert.ok(m.has(t.id)||planner.retired.muster_v021[t.id],t.id+' lost without reason');
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
  assert.match(index,/work\.js\?v=office46/);
  assert.match(work,/fetch\('\.\/data\/muster-planner-lph3-v0\.3\.json/);
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
