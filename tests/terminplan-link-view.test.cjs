'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const view=require('../terminplan-link-view.js');
const read=p=>fs.readFileSync(new URL('../'+p,'file://'+__filename),'utf8');
const dependencyOf=t=>Array.isArray(t.dependencies)?t.dependencies:(t.pred?[{pred:t.pred,rel:t.rel||'EA'}]:[]);
const synthetic=[
  {id:'a',dependencies:[]},
  {id:'b',dependencies:[{pred:'a',rel:'EA'}]},
  {id:'c',dependencies:[{pred:'a',rel:'AA'},{pred:'b',rel:'EE'}]},
  {id:'d',dependencies:[{pred:'c',rel:'AE'}]}
];
const ids=['a','b','c','d'];

test('Default is selection: without a selected task, the Gantt has no arrows',()=>{
  assert.equal(view.normalizeMode(undefined),'selected');
  assert.equal(view.normalizeMode('not-a-mode'),'selected');
  assert.deepEqual(view.visibleConnections(synthetic,ids,'selected',null,dependencyOf),[]);
  assert.deepEqual(view.visibleConnections(synthetic,ids,'hidden','b',dependencyOf),[]);
  assert.equal(view.visibleConnections(synthetic,ids,'all',null,dependencyOf).length,4);
});

test('Selected task shows direct incoming predecessors and direct outgoing successors only',()=>{
  const actual=view.visibleConnections(synthetic,ids,'selected','b',dependencyOf);
  assert.deepEqual(actual.map(x=>[x.pred,x.target,x.rel,x.direction]),
    [['a','b','EA','incoming'],['b','c','EE','outgoing']]);
  const c=view.visibleConnections(synthetic,ids,'selected','c',dependencyOf);
  assert.deepEqual(c.map(x=>x.direction),['incoming','incoming','outgoing']);
  assert.equal(c.length,3,'no transitive A→B line when C is selected');
});

test('Collapsed, searched, or otherwise hidden endpoints never get an off-row arrow',()=>{
  assert.deepEqual(view.visibleConnections(synthetic,['b','c'],'selected','b',dependencyOf)
    .map(x=>[x.pred,x.target]),[['b','c']]);
  assert.deepEqual(view.visibleConnections(synthetic,['a','d'],'all',null,dependencyOf),[]);
  assert.deepEqual(view.visibleConnections(synthetic,['a','c'],'selected','b',dependencyOf),[]);
});

test('Display filtering preserves canonical dependency data and original task objects',()=>{
  const original=JSON.stringify(synthetic);
  view.visibleConnections(synthetic,ids,'selected','b',dependencyOf);
  view.visibleConnections(synthetic,ids,'hidden','a',dependencyOf);
  view.visibleConnections(synthetic,ids,'all',null,dependencyOf);
  assert.equal(JSON.stringify(synthetic),original);
});

test('Real LPH3 and LPH5 Muster retain every link in technical all mode',()=>{
  const templates=JSON.parse(read('supabase/seed/terminplan-templates.json'));
  const expected={LPH3:96,LPH5:95};
  for(const template of templates){
    if(!expected[template.phase])continue;
    const tasks=template.state.tasks;
    assert.equal(view.visibleConnections(tasks,tasks.map(t=>t.id),'all',null,dependencyOf).length,expected[template.phase]);
    assert.equal(view.visibleConnections(tasks,tasks.map(t=>t.id),'hidden',null,dependencyOf).length,0);
  }
});

test('Gantt and print controls are independent and cannot write to plan data',()=>{
  const html=read('terminplan.html');
  assert.match(html,/id="linkMode"/);
  assert.match(html,/<option value="selected" selected>Auswahl<\/option>/);
  assert.match(html,/id="printConnectionMode"/);
  assert.match(html,/<option value="hidden" selected>Ohne \(Standard\)<\/option>/);
  assert.match(html,/let printConnectionMode='hidden'/);
  assert.match(html,/visibleConnections\(data\.tasks,taskRows\.keys\(\),linkMode,selectedId,taskDependencies\)/);
  assert.match(html,/el\.onclick=\(\)=>\{selectedId=r\.id;proposedShift=null;renderLeft\(\);updateDependencyOverlay\(\);renderAssistant\(\)\}/);
  assert.match(html,/updateDependencyOverlay\(\);\s*renderAssistant\(\);\s*drag=\{/);
  assert.match(html,/if\(printConnectionMode==='all'\)\{\s*data\.tasks\.forEach\(task=>taskDependencies/);
  assert.match(html,/saveUIState\(\); \/\/ Per-browser display preference, not part of the saved plan/);
  assert.match(html,/src="\.\/terminplan-link-view\.js\?v=office1"/);
  assert.match(html,/\.dep-path\.dep-incoming/);
  assert.match(html,/\.dep-path\.dep-outgoing/);
});

test('German handbook documents visibility, predecessor/successor colors and print modes',()=>{
  const help=read('terminplan-hilfe.html');
  for(const phrase of ['Verbindungen','Auswahl','Vorgänger','Nachfolger','Drucken / PDF',
    'technische','Beziehung bleibt jedoch gespeichert']){
    assert.ok(help.includes(phrase),'Missing handbook topic '+phrase);
  }
});

test('Read-only Muster permits Gantt selection but does not enable drag or resize',()=>{
  const editor=read('terminplan.html');
  const drag=editor.slice(editor.indexOf('function startDrag(e,t,mode){'),editor.indexOf('function onDrag(',editor.indexOf('function startDrag(e,t,mode){')));
  const selected=drag.indexOf('selectedId=task.id');
  const redraw=drag.indexOf('updateDependencyOverlay()');
  const guard=drag.indexOf('if(!canEdit)return;');
  assert.ok(selected>=0&&redraw>selected&&guard>redraw,
    'selection happens before edit-permission check');
  assert.ok(drag.indexOf('drag={')>guard,'dragging remains edit-only');
});
