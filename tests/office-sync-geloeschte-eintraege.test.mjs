// A task deleted on the server disappears for everyone (Gari, 24.11.2026): it leaves the Kalender of the team,
// and the local copy of its author no longer pushes it back. The real functions of app/sync.js run on sample rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sync=read('app/sync.js');
const pick=name=>{
  const m=sync.match(new RegExp('\\nfunction '+name+'\\([\\s\\S]*?\\n\\}\\n'));
  assert.ok(m,name+' in app/sync.js');
  return m[0];
};
const load=(pending=new Set())=>new Function('pendingEntityMutations',
  ['entityRevisionTime','shouldKeepLocalEntity','mergeRemoteEntities','mergePulledEntityState'].map(pick).join('')+
  '\nreturn {mergeRemoteEntities,mergePulledEntityState};')(pending);
const ids=list=>list.map(x=>x.id);

test('A task the server no longer returns leaves the Kalender of the team', ()=>{
  const {mergeRemoteEntities:merge}=load();
  // Seen by a colleague: two cards of the project lead, one of them deleted on the server.
  const local=[{id:'L3.MAT.1',ownerId:'gari',title:'Materialien recherchieren'},{id:'L3.QUA.1',ownerId:'gari',title:'alt'}];
  const remote=[{id:'L3.QUA.1',ownerId:'gari',title:'neu',updatedAt:'2026-11-24T08:36:10Z'}];
  assert.deepEqual(merge(remote,local,'task').map(x=>[x.id,x.title]),[['L3.QUA.1','neu']]);
});

test('Deleted in the Planner or by the project lead: the own copy does not bring it back', ()=>{
  const {mergeRemoteEntities:merge}=load();
  assert.deepEqual(merge([],[{id:'t1',ownerId:'ana',title:'Bad prüfen'}],'task'),[]);
  assert.deepEqual(merge([],[{id:'e1',ownerId:'ana',title:'Bemusterung'}],'event'),[],'Termine as well');
});

test('What was never on the server stays until it is pushed; what is being saved stays', ()=>{
  const {mergeRemoteEntities:merge}=load(new Set(['task:t2','event:e2']));
  const local=[{id:'neu',title:'hier angelegt'},{id:'t2',ownerId:'ana',title:'wird gespeichert'},{id:'t3',ownerId:'ana',title:'gelöscht'}];
  assert.deepEqual(ids(merge([],local,'task')),['neu','t2']);
  assert.deepEqual(ids(merge([],[{id:'e1'},{id:'e2',ownerId:'ana'},{id:'e3',ownerId:'gari'}],'event')),['e1','e2']);
});

test('The newer copy still wins; an answer that may be cut off drops nothing', ()=>{
  const {mergeRemoteEntities:merge}=load();
  const remote=[{id:'a',ownerId:'ana',title:'Server',updatedAt:'2026-11-24T09:00:00Z'}];
  assert.equal(merge(remote,[{id:'a',ownerId:'ana',title:'lokal',updatedAt:'2026-11-24T10:00:00Z'}])[0].title,'lokal');
  assert.equal(merge(remote,[{id:'a',ownerId:'ana',title:'lokal',updatedAt:'2026-11-24T08:00:00Z'}])[0].title,'Server');
  assert.deepEqual(ids(merge([],[{id:'x',ownerId:'ana'}],'task',false)),['x']);
});

test('Pulled state: tombstones first, then the rule, separately for tasks and Termine', ()=>{
  const {mergePulledEntityState:pulled}=load();
  const current={tasks:[{id:'weg',ownerId:'gari'},{id:'grab',ownerId:'gari'},{id:'neu'}],events:[{id:'termin',ownerId:'gari'}],
    deletedTaskIds:[],deletedEventIds:[]};
  const next=pulled([],[],current,{deletedTaskIds:['grab'],deletedEventIds:[]},{tasks:true,events:false});
  assert.deepEqual(ids(next.tasks),['neu']);
  assert.deepEqual(ids(next.events),['termin'],'the answer for Termine may be cut off: kept');
  assert.deepEqual(next.deletedTaskIds,['grab']);
  assert.deepEqual(ids(pulled([],[],current,{}).tasks),['neu'],'without the flag the answer counts as complete');
});

test('The pull says whether its answer is complete; a duplicate is a new entry of your own', ()=>{
  assert.match(sync,/const PULL_ROW_LIMIT=1000;/);
  assert.match(sync,/const complete=rows=>\(rows\|\|\[\]\)\.length<PULL_ROW_LIMIT;/);
  assert.match(sync,/mergePulledEntityState\(remoteTasks,remoteEvents,app\.getState\(\),local,\{tasks:complete\(tasks\),events:complete\(events\)\}\)/);
  // Pushed in bulk only when it is your own; the Planner pulls right after deleting.
  assert.match(sync,/const own=x=>!x\.ownerId\|\|x\.ownerId===user\.id;/);
  assert.match(read('app/task-detail.js'),/from\('isabella_tasks'\)\.delete\(\)\.eq\('id',ctx\.task\.id\)[\s\S]{0,400}window\.ISABELLA_SYNC_PULL_NOW\?\.\(\)/);
  const dup=read('app/app.js').match(/function duplicateItem\(kind,id\)\{[\s\S]*?\n\}\n/);
  assert.ok(dup,'duplicateItem');
  assert.match(dup[0],/delete copy\.ownerId;delete copy\.mine;/);
});
