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
 assert.equal(model.phase,'LPH3');assert.equal(model.draft,true);assert.equal(model.version,'0.3.5-draft');
 assert.deepEqual(model.buckets.map(x=>x.id),['A1','A2','A3','A4','A5','A6','A7']);
 assert.equal(all.length,52);assert.equal(all.reduce((n,x)=>n+x.checks.length,0),366);
 assert.equal(tasks.size,all.length);
 assert.match(model.reference,/Muster-Terminplan LPH 3 v1\.6/);
 assert.match(model.status,/nicht freigegeben/);
});
test('Only TBA-owned work is represented, never Fachplaner deliveries or Bauherrn waiting as tasks',()=>{
 for(const task of all){
   assert.ok(task.sourceType.includes('TBA-eigene'),task.id);
   assert.ok(task.title.length>14&&task.result.length>15,task.id);
   assert.ok(task.checks.length>=1&&task.checks.length<=10,task.id+' checklist as long as needed, at most 10');
   assert.ok(task.psp.length>=1,task.id+' missing original Terminplan trace');
   assert.equal(task.effortHours,null,'no invented hours '+task.id);
   assert.ok(task.owner&&!['Auftraggeber','TWP','HLS','ELT','BRS','BPH'].includes(task.owner),task.id);
 }
 assert.ok(fromOld('L3-KOO-01').length&&fromOld('L3-KOS-02').length,'internal verification of external contributions is represented');
 assert.ok(!all.some(x=>/^\s*(TWP|HLS|ELT|BRS|BPH)\s*[·-]/.test(x.title)),'no external planner outputs copied as TBA tasks');
});
test('Bemusterung has real research, alternatives, samples, documents, drawings and cost handoff',()=>{
 const b=model.buckets.find(b=>b.id==='A5');assert.equal(b.tasks.length,10);
 for(const id of ['L3-BEM-03','L3-BEM-04','L3-BEM-05','L3-BEM-07','L3-BEM-08',
   'L3-BEM-09','L3-BEM-10','L3-BEM-11','L3-BEM-12','L3-BEM-13','L3-BEM-14'])assert.ok(fromOld(id).some(t=>t.bucket==='A5'),id);
 const PAKETE=['L3.BAD.1','L3.TRE.1','L3.FAS.1','L3.LIC.1','L3.BOD.1','L3.WEI.1'];
 for(const id of PAKETE)assert.match(tasks.get(id).scope,/Bedingt/);
 // Je Paket eine Person, vom Plan bis zur Entscheidungsvorlage, mit Recherche, Varianten und Mustern (Gari, 24.11.2026);
 // Optionen und Muster je Option für den Auftraggeber (Gari, 14.11.2026) bleiben Teil jedes Pakets.
 assert.ok(!tasks.has('L3.MAT.1')&&!tasks.has('L3.MUS.1'),'Recherche und Muster sind keine eigenen Karten mehr');
 for(const id of PAKETE){
   const t=tasks.get(id);
   assert.match(t.owner,/eine Person für das ganze Paket/,id);
   assert.ok(t.checks.some(c=>/mindestens zwei Varianten recherchiert/.test(c)),id+' Varianten');
   assert.ok(t.checks.some(c=>/^Varianten verglichen/.test(c)&&/Preis mit Quelle und Datum/.test(c)),id+' Vergleich');
   assert.ok(t.checks.some(c=>/^Muster je Variante angefragt/.test(c)),id+' Muster angefragt');
   assert.ok(t.checks.some(c=>/Referenzcode in der Musterliste/.test(c)),id+' Musterliste');
   assert.ok(t.checks.some(c=>/^Entscheidungsvorlage des Pakets/.test(c)),id+' Entscheidungsvorlage');
   assert.ok(t.checks.some(c=>/LPH 5/.test(c))||/LPH 5/.test(t.basis),id+' Abgrenzung LPH 5');
   assert.ok(tasks.get('L3.A5.AUS').requires.includes(id.slice(3)),'Übergabe braucht '+id);
 }
 assert.ok(tasks.get('L3.QUA.1').checks.some(c=>/jedes Entscheidungsfeld genau einem Paket/.test(c)&&/je Paket eine Person/.test(c)),'QUA.1 verteilt die Pakete');
 assert.ok(tasks.get('L3.A5.AUS').checks.some(c=>/^Pakete untereinander abgeglichen/.test(c)),'A5.AUS gleicht die Pakete ab');
 assert.ok(!JSON.stringify(b).includes('L3.MUS.1')||/entfallen/.test(b.note),'nur die Notiz nennt die gestrichenen Karten');
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
