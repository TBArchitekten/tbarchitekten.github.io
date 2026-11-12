'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const model=JSON.parse(read('app/data/muster-planner-lph3-v0.2.json'));
const all=model.buckets.flatMap(bucket=>bucket.tasks.map(task=>({...task,bucket:bucket.id})));
const tasks=new Map(all.map(task=>[task.id,task]));
test('Masterplanner is a versioned, explicitly unapproved LPH3 draft',()=>{
 assert.equal(model.phase,'LPH3');assert.equal(model.draft,true);assert.equal(model.version,'0.2');
 assert.deepEqual(model.buckets.map(x=>x.id),['ORG','A1','A2','A3','A4','A5','A6','A7']);
 assert.equal(all.length,57);assert.equal(all.reduce((n,x)=>n+x.checks.length,0),228);
 assert.equal(tasks.size,all.length);
});
test('Only TBA-owned work is represented, never Fachplaner deliveries or Bauherrn waiting as tasks',()=>{
 for(const task of all){
   assert.ok(task.sourceType.includes('TBA-eigene'),task.id);
   assert.ok(task.title.length>14&&task.result.length>15,task.id);
   assert.ok(task.checks.length>=4,task.id+' missing detailed checklist');
   assert.ok(task.psp.length>=1,task.id+' missing original Terminplan trace');
   assert.equal(task.effortHours,null,'no invented hours '+task.id);
   assert.ok(task.owner&&task.owner!=='Auftraggeber'&&task.owner!=='TWP'&&task.owner!=='HLS'&&task.owner!=='ELT',task.id);
 }
 assert.ok(tasks.has('L3-KOO-01')&&tasks.has('L3-KOS-02'),'internal verification of external contributions is represented');
 assert.ok(!all.some(x=>/^\s*(TWP|HLS|ELT|BRS)\s*[·-]/.test(x.title)),'no external planner outputs copied as TBA tasks');
});
test('Bemusterung has real research, alternatives, samples, documents, drawings and cost handoff',()=>{
 const b=model.buckets.find(b=>b.id==='A5');assert.equal(b.tasks.length,14);
 for(const id of ['L3-BEM-03','L3-BEM-04','L3-BEM-05','L3-BEM-07','L3-BEM-08',
   'L3-BEM-09','L3-BEM-10','L3-BEM-11','L3-BEM-12','L3-BEM-13','L3-BEM-14'])assert.ok(tasks.has(id),id);
 for(const id of ['L3-BEM-08','L3-BEM-09','L3-BEM-10','L3-BEM-11','L3-BEM-12'])assert.match(tasks.get(id).scope,/Bedingt/);
 assert.match(tasks.get('L3-BEM-11').basis,/LPH5/);
 assert.ok(model.buckets.some(b=>b.id==='A6'&&b.tasks.some(t=>t.id==='L3-KOS-03')));
});
test('The review interface is read-only, user choices cannot change project database',()=>{
 const html=read('muster-planner.html');
 const js=read('muster-planner.js');
 const app=read('app/office-projects.js');
 assert.match(html,/Muster · nur Ansicht/);
 assert.match(html,/Review exportieren/);
 assert.match(html,/Bemusterung/);
 assert.match(js,/localStorage\.setItem/);
 assert.match(js,/new Blob/);
 assert.match(js,/\.\/app\/data\/muster-planner-lph3-v0\.2\.json/);
 assert.doesNotMatch(js,/\.from\(['"](?:isabella_tasks|minds_work_buckets|office_terminplan_instances)['"]\)/);
 assert.match(app,/plannerOpen\.href='\.\.\/muster-planner\.html'/);
 assert.match(app,/LPH3 · MUSTER-PLANNER/);
});
