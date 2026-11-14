'use strict';
// Planner ↔ Terminplan: linked tasks take their dates from the project Terminplan, by Vorgang-ID.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const S=require('../app/planner-terminplan-sync.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

const state={
  groups:[{id:'g1',wbs:'00'},{id:'g5',wbs:'04'}],
  tasks:[
    {id:'a',group:'g1',start:'2026-12-04',end:'2026-12-04',type:'milestone'},
    {id:'prep',group:'g5',start:'2026-11-16',end:'2026-12-11',type:'task'},
    {id:'hand',group:'g5',start:'2026-12-11',end:'2026-12-11',type:'milestone'},
    {id:'bem',group:'g5',start:'2026-12-14',end:'2026-12-24',type:'task'}
  ]
};
const inst={id:'plan-1',state};
const link=(o)=>({office_planner:{task_code:'X',terminplan_psp:'',work_result:'R',terminplan:{instance_id:'plan-1',executes:[],waits_for:[],anchor:null,...o}}});

test('PSP comes from group WBS and the order of Vorgänge, not from stored text',()=>{
  const m=S.pspMap(state);
  assert.equal(m.get('a'),'00.01');
  assert.equal(m.get('prep'),'04.01');
  assert.equal(m.get('bem'),'04.03');
});

test('A task executing Vorgänge starts with the earliest and is due with the latest',()=>{
  const t=S.target({executes:['prep','hand']},state);
  assert.equal(t.start_date,'2026-11-16');
  assert.equal(t.due_date,'2026-12-11');
  assert.equal(t.terminplan_psp,'04.01, 04.02');
  assert.deepEqual(t.missing,[]);
});

test('A task without own Vorgang but with an anchor is due on the anchor date',()=>{
  const t=S.target({executes:[],anchor:{id:'bem',field:'start'}},state);
  assert.equal(t.start_date,undefined);
  assert.equal(t.due_date,'2026-12-14');
});

test('Plan lists only real changes, keeps done tasks and tasks of other plans, reports lost Vorgänge',()=>{
  const tasks=[
    {id:'1',title:'Vorbereiten',start_date:'2026-11-16',due_date:'2026-12-04',metadata:link({executes:['prep']})},
    {id:'2',title:'Schon richtig',start_date:'2026-12-14',due_date:'2026-12-24',metadata:{office_planner:{terminplan_psp:'04.03',terminplan:{instance_id:'plan-1',executes:['bem']}}}},
    {id:'3',title:'Erledigt',start_date:'2026-01-01',due_date:'2026-01-02',completed_at:'2026-01-02T10:00:00Z',metadata:link({executes:['bem']})},
    {id:'4',title:'Anderer Plan',start_date:null,due_date:null,metadata:{office_planner:{terminplan:{instance_id:'plan-2',executes:['bem']}}}},
    {id:'5',title:'Ohne Verknüpfung',start_date:null,due_date:null,metadata:{}},
    {id:'6',title:'Gelöschter Vorgang',start_date:null,due_date:null,metadata:link({executes:['weg']})}
  ];
  const r=S.plan(tasks,inst);
  assert.equal(r.linked,4);
  assert.equal(r.done,1);
  assert.equal(r.unchanged,1);
  assert.deepEqual(r.changes.map(c=>c.id),['1']);
  assert.deepEqual(r.changes[0].after,{start_date:'2026-11-16',due_date:'2026-12-11',terminplan_psp:'04.01'});
  assert.deepEqual(r.missing,[{id:'6',title:'Gelöschter Vorgang',vorgaenge:['weg']}]);
});

test('Saving keeps every other metadata field (Ergebnis, Code, Verknüpfung, Planung)',()=>{
  const task={metadata:{planning:{estimated_minutes:60},...link({executes:['prep']})}};
  const m=S.metadataWith(task,'04.01');
  assert.equal(m.planning.estimated_minutes,60);
  assert.equal(m.office_planner.task_code,'X');
  assert.equal(m.office_planner.work_result,'R');
  assert.deepEqual(m.office_planner.terminplan.executes,['prep']);
  assert.equal(m.office_planner.terminplan_psp,'04.01');
});

test('Planner offers the sync only for linked tasks, never in the Muster, and only writes after confirmation',()=>{
  const work=read('app/work.js'),index=read('app/index.html');
  assert.ok(index.indexOf('planner-terminplan-sync.js')>0&&index.indexOf('planner-terminplan-sync.js')<index.indexOf('./work.js?v='),'module loads before work.js');
  assert.match(work,/tasks\.some\(t=>window\.TBAPlannerTerminplanSync\?\.linkOf\(t\)\)\?'<button type="button" data-work-terminplan-sync/);
  const handler=work.indexOf("$('[data-work-terminplan-sync]')"),guard=work.indexOf('if(preview)return; // The Muster shares the real Planner renderer');
  assert.ok(guard>0&&handler>guard,'no sync handler in the read-only Muster');
  assert.match(work,/select\('id,client_key,title,due_date,completed_at,notes,[^']*,metadata'\)/,'Planner loads task metadata (link)');
  const fn=work.slice(work.indexOf('async function syncFromTerminplan('),work.indexOf('async function renderPlanner('));
  assert.ok(fn.indexOf(".update(")>fn.indexOf("$('#workSyncApply').onclick"),'writes only inside the confirm handler');
  assert.match(fn,/S\.metadataWith\(/);
});
