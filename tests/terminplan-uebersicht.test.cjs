'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const view=require('../terminplan-link-view.js');
const read=p=>fs.readFileSync(new URL('../'+p,'file://'+__filename),'utf8');
const templates=JSON.parse(read('supabase/seed/terminplan-templates.json'));
const deps=t=>Array.isArray(t.dependencies)?t.dependencies:t.pred?[{pred:t.pred,rel:t.rel||'EA',lagDays:0}]:[];
const get=phase=>templates.find(t=>t.phase===phase);
const shown=(plan,mode,selected=null,visible)=>view.visibleConnections(
  plan.tasks,visible||plan.tasks.map(t=>t.id),mode,selected,deps,plan.project.calendar
);

test('Übersicht reduces each actual Muster to one timing representative per dependent task',()=>{
  const expected={LPH3:{complete:99,overview:58},LPH5:{complete:95,overview:44}};
  for(const phase of Object.keys(expected)){
    const state=get(phase).state;
    const before=JSON.stringify(state);
    const full=shown(state,'all'),overview=shown(state,'overview');
    assert.equal(full.length,expected[phase].complete,phase+' all dependencies');
    assert.equal(overview.length,expected[phase].overview,phase+' representative dependencies');
    assert.equal(new Set(overview.map(e=>e.target)).size,overview.length,'exactly one per successor');
    assert.ok(overview.every(e=>full.some(x=>x.pred===e.pred&&x.target===e.target&&
      x.rel===e.rel&&x.lagDays===e.lagDays)),'no synthetic links');
    assert.equal(JSON.stringify(state),before,'only a projection of the original DAG');
  }
});

test('A milestone with five parallel mandatory contributors remains visibly aggregated but selectable',()=>{
  const state=get('LPH5').state;
  const full=shown(state,'all');
  const target='m50'; // M06: mandatory Fachplaner contributions
  assert.equal(full.filter(e=>e.target===target).length,5);
  const overview=shown(state,'overview');
  assert.equal(overview.filter(e=>e.target===target).length,1);
  const expanded=shown(state,'overview',target);
  assert.equal(expanded.filter(e=>e.target===target).length,5);
  assert.ok(expanded.filter(e=>e.target===target).every(e=>e.direction==='incoming'));
  assert.equal(shown(state,'selected',target).filter(e=>e.target===target).length,5);
  assert.ok(expanded.length>overview.length);
  assert.deepEqual(shown(state,'hidden',target),[]);
  assert.equal(shown(state,'all',target).length,full.length);
});

test('LPH3 milestone with multiple Bauherr and Fachplaner prerequisites is not silently rewritten',()=>{
  const state=get('LPH3').state, id='t031';
  assert.equal(shown(state,'all').filter(e=>e.target===id).length,4);
  const original=JSON.stringify(state);
  assert.equal(shown(state,'overview').filter(e=>e.target===id).length,1);
  assert.equal(shown(state,'overview',id).filter(e=>e.target===id).length,4);
  assert.equal(shown(state,'selected',id).filter(e=>e.target===id).length,4);
  assert.equal(JSON.stringify(state),original);
});

test('Temporal ranking prefers the strongest constraint (not first alphabetical predecessor)',()=>{
  const tasks=[
    {id:'a',start:'2027-01-04',end:'2027-01-08',group:'A',type:'task'},
    {id:'z',start:'2027-01-04',end:'2027-01-12',group:'A',type:'task'},
    {id:'t',start:'2027-01-13',end:'2027-01-18',group:'A',type:'task',
      dependencies:[
        {pred:'a',rel:'EA',lagDays:0},
        {pred:'z',rel:'EA',lagDays:0},
        {pred:'a',rel:'AA',lagDays:1},
        {pred:'z',rel:'EE',lagDays:0}
      ]}
  ];
  const result=view.visibleConnections(tasks,tasks.map(t=>t.id),'overview',null,deps,{});
  assert.equal(result.length,1);
  assert.deepEqual([result[0].pred,result[0].rel],['z','EA']);
  assert.equal(view.visibleConnections(tasks,tasks.map(t=>t.id),'all',null,deps,{}).length,4);
});

test('Tied timing constraints prefer cross-PSP relationship and then a milestone predecessor',()=>{
  const tasks=[
    {id:'aaa',start:'2027-01-04',end:'2027-01-08',group:'same'},
    {id:'bbb',start:'2027-01-04',end:'2027-01-08',group:'other',type:'milestone'},
    {id:'target',start:'2027-01-11',end:'2027-01-13',group:'same',dependencies:[
      {pred:'aaa',rel:'EA',lagDays:0},{pred:'bbb',rel:'EA',lagDays:0}
    ]}
  ];
  // Use a valid milestone date in a tie and keep both scores identical.
  tasks[1].start='2027-01-08';
  const result=view.visibleConnections(tasks,tasks.map(t=>t.id),'overview',null,deps,{});
  assert.equal(result.length,1);
  assert.equal(result[0].pred,'bbb');
  const sameGroup=structuredClone(tasks);
  sameGroup[1].group='same';
  assert.equal(view.visibleConnections(sameGroup,sameGroup.map(t=>t.id),'overview',null,deps,{})[0].pred,
    'bbb','milestone link wins when timing and group ties');
});

test('Workday rank responds to project calendar and typed EE/AE links without mutating dates',()=>{
  const tasks=[
    {id:'ea',start:'2027-01-04',end:'2027-01-08',group:'g'},
    {id:'ee',start:'2027-01-04',end:'2027-01-12',group:'g'},
    {id:'target',start:'2027-01-15',end:'2027-01-19',group:'g',dependencies:[
      {pred:'ea',rel:'EA',lagDays:3},
      {pred:'ee',rel:'EE',lagDays:4},
      {pred:'ee',rel:'AE',lagDays:1}
    ]}
  ];
  const snap=JSON.stringify(tasks);
  const without=view.visibleConnections(tasks,tasks.map(t=>t.id),'overview',null,deps,{});
  assert.equal(without.length,1);
  assert.ok(['EA','EE'].includes(without[0].rel));
  const withHoliday=view.visibleConnections(tasks,tasks.map(t=>t.id),'overview',null,deps,
    {nonWorkingDates:['2027-01-11']});
  assert.equal(withHoliday.length,1);
  assert.equal(JSON.stringify(tasks),snap);
});

test('Overview ranks using full network before search/PSP collapse to avoid fake substitute predecessor',()=>{
  const state=get('LPH5').state;
  const chosen=shown(state,'overview');
  const edge=chosen.find(e=>{
    const t=state.tasks.find(t=>t.id===e.target);
    return t.dependencies?.length>1;
  });
  assert.ok(edge);
  const competitors=state.tasks.find(t=>t.id===edge.target).dependencies.filter(d=>d.pred!==edge.pred);
  assert.ok(competitors.length);
  const restricted=[edge.target,competitors[0].pred];
  const clipped=shown(state,'overview',null,restricted);
  assert.equal(clipped.filter(e=>e.target===edge.target).length,0,
    'do not silently choose a different weaker edge when the true representative is collapsed');
  const all=shown(state,'all',null,restricted);
  assert.equal(all.filter(e=>e.target===edge.target).length,1);
});

test('Invalid schedule dates degrade to deterministic visual ranking, never a false critical-path verdict',()=>{
  const tasks=[
    {id:'b',group:'A'}, {id:'a',group:'A'},
    {id:'target',group:'A',dependencies:[{pred:'b',rel:'AA',lagDays:1},{pred:'a',rel:'EA',lagDays:0}]}
  ];
  const snapshot=JSON.stringify(tasks);
  const actual=view.visibleConnections(tasks,tasks.map(t=>t.id),'overview',null,deps,{});
  assert.equal(actual.length,1);
  assert.equal(actual[0].pred,'a');
  assert.equal(JSON.stringify(tasks),snapshot);
  assert.deepEqual(view.MODES,['hidden','overview','selected','all']);
});

test('Overview is genuinely the default for fresh and old selection-default browsers',()=>{
  const html=read('terminplan.html');
  assert.match(html,/<option value="overview" selected>Übersicht<\/option>/);
  assert.match(html,/linkModeVersion===2\|\|saved\.linkMode==='hidden'\|\|saved\.linkMode==='all'/);
  assert.match(html,/saved\.linkMode:'overview'/);
  assert.match(html,/linkMode:'overview',linkModeVersion:2/);
  assert.match(html,/uiState\.linkModeVersion=2/);
  assert.match(html,/data\.project\?\.calendar/);
  assert.match(html,/terminplan-link-view\.js\?v=office2/);
  assert.match(html,/let printConnectionMode='hidden'/,'ordinary PDF remains clean');
  assert.match(html,/if\(printConnectionMode==='all'\)/,'technical PDF remains available');
});

test('Handbuch states that Übersicht is only a visual representative, not the critical path',()=>{
  const help=read('terminplan-hilfe.html');
  for(const phrase of ['vier Modi','Übersicht','engste zeitliche Startbedingung',
    'nicht</strong> eine Berechnung des kritischen Pfads','alle direkten Verbindungen',
    'Die Beziehung bleibt jedoch gespeichert']){
    assert.ok(help.includes(phrase),'missing handbook caveat '+phrase);
  }
});
