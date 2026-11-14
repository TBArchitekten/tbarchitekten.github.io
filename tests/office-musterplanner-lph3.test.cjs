'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const model=JSON.parse(read('app/data/muster-planner-lph3-v0.3.json'));
const all=model.buckets.flatMap(bucket=>bucket.tasks.map(task=>({...task,bucket:bucket.id})));
const tasks=new Map(all.map(task=>[task.id,task]));
const fromOld=id=>all.filter(t=>t.origin.muster_v021.includes(id));
test('Masterplanner is a versioned, explicitly unapproved LPH3 draft',()=>{
 assert.equal(model.phase,'LPH3');assert.equal(model.draft,true);assert.equal(model.version,'0.3.1-draft');
 assert.deepEqual(model.buckets.map(x=>x.id),['A1','A2','A3','A4','A5','A6','A7']);
 assert.equal(all.length,52);assert.equal(all.reduce((n,x)=>n+x.checks.length,0),334);
 assert.equal(tasks.size,all.length);
 assert.match(model.reference,/Muster-Terminplan LPH 3 v1\.3/);
 assert.match(model.status,/nicht freigegeben/);
});
test('Only TBA-owned work is represented, never Fachplaner deliveries or Bauherrn waiting as tasks',()=>{
 for(const task of all){
   assert.ok(task.sourceType.includes('TBA-eigene'),task.id);
   assert.ok(task.title.length>14&&task.result.length>15,task.id);
   assert.ok(task.checks.length>=1&&task.checks.length<=10,task.id+' checklist as long as needed, at most 10');
   assert.ok(task.psp.length>=1,task.id+' missing original Terminplan trace');
   assert.equal(task.effortHours,null,'no invented hours '+task.id);
   assert.ok(task.owner&&task.owner!=='Auftraggeber'&&task.owner!=='TWP'&&task.owner!=='HLS'&&task.owner!=='ELT',task.id);
 }
 assert.ok(fromOld('L3-KOO-01').length&&fromOld('L3-KOS-02').length,'internal verification of external contributions is represented');
 assert.ok(!all.some(x=>/^\s*(TWP|HLS|ELT|BRS)\s*[·-]/.test(x.title)),'no external planner outputs copied as TBA tasks');
});
test('Bemusterung has real research, alternatives, samples, documents, drawings and cost handoff',()=>{
 const b=model.buckets.find(b=>b.id==='A5');assert.equal(b.tasks.length,10);
 for(const id of ['L3-BEM-03','L3-BEM-04','L3-BEM-05','L3-BEM-07','L3-BEM-08',
   'L3-BEM-09','L3-BEM-10','L3-BEM-11','L3-BEM-12','L3-BEM-13','L3-BEM-14'])assert.ok(fromOld(id).some(t=>t.bucket==='A5'),id);
 for(const id of ['L3.MUS.1','L3.BAD.1','L3.TRE.1','L3.FAS.1','L3.LIC.1'])assert.match(tasks.get(id).scope,/Bedingt/);
 assert.match(tasks.get('L3.FAS.1').basis,/LPH 5/);
 assert.ok(model.buckets.some(b=>b.id==='A6'&&b.tasks.some(t=>t.id==='L3.KOB.1'&&t.requires.includes('QUA.2'))));
 assert.ok(b.tasks.filter(t=>t.step==='Erarbeiten').every(t=>t.schedule.executes.includes('t058')),'own preparation Vorgang');
});
test('The Muster uses the canonical Planner renderer and cannot trigger project writes',()=>{
 const html=read('muster-planner.html'),work=read('app/work.js');
 const detail=read('app/task-detail.js'),app=read('app/office-projects.js');
 assert.match(html,/location\.replace\('\.\/app\/#section=work&muster=LPH3'\)/);
 assert.match(work,/function taskCard\(t,preview=false\)/);
 assert.match(work,/renderPlanner\(true\)/);
 assert.match(work,/if\(preview\)return; \/\/ The Muster shares the real Planner renderer, but NEVER its write handlers/);
 assert.match(detail,/function preview\(\{task,buckets=\[\]/);
 assert.match(detail,/if\(ctx\.readOnly\)\{/);
 assert.match(detail,/host\?\.querySelectorAll\('input,textarea,select,button'\)/);
 // Beide Muster-Planner-Links laden die Seite neu (iPhone-App: ein reiner #-Wechsel öffnete das letzte Projekt).
 assert.match(app,/planner\.href='\.\.\/muster-planner\.html'/);
 assert.doesNotMatch(app,/planner\.href='\.\/#section=work&muster=LPH3'/);
});
