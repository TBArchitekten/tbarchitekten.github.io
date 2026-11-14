import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../office-core.js');
const P=require('../terminplan-planning.js');
const E=require('../terminplan-engine.js');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const templates=JSON.parse(read('supabase/seed/terminplan-templates.json'));
const tpl=templates.find(x=>x.phase==='LPH5');
const links=state=>state.tasks.reduce((sum,t)=>sum+(t.dependencies||[]).length,0);

test('LPH5 v0.2 is a complete generic 8-group network with typed multi-predecessor gates',()=>{
 assert.equal(tpl.version,'0.2');
 assert.equal(tpl.state.project.scheduleModel,'network-v1');
 assert.equal(tpl.state.project.releaseMilestoneId,'m60');
 assert.deepEqual(tpl.state.groups.map(x=>x.wbs),['00','01','02','03','04','05','06','07']);
 assert.equal(tpl.state.tasks.length,45);
 assert.equal(links(tpl.state),95);
 const ids=new Set(tpl.state.tasks.map(x=>x.id));
 assert.equal(ids.size,45);
 for(const t of tpl.state.tasks){
  assert.equal(t.progress,0);
  assert.equal(t.status,'Nicht begonnen');
  assert.equal(t.critical,false,'Critical path is derived, not assumed');
  assert.ok(Number.isInteger(t.durationAT));
  assert.equal(t.durationAT===0,t.type==='milestone');
  for(const d of t.dependencies){
   assert.ok(ids.has(d.pred),t.id+' references known predecessor');
   assert.ok(['AA','EA','EE','AE'].includes(d.rel));
   assert.ok(Number.isInteger(d.lagDays));
  }
 }
 assert.equal(E.analyze(tpl.state).errors,0);
 const audit=P.analyze(tpl.state);
 assert.equal(audit.valid,true,audit.reason);
});

test('Fachplaner are parallel and M03, M06, M07 require all mandatory contributions',()=>{
 const map=new Map(tpl.state.tasks.map(x=>[x.id,x]));
 const incoming=id=>map.get(id).dependencies.map(d=>d.pred);
 for(const id of ['t021','t022','t023'])assert.ok(incoming(id).includes('t020'));
 for(const id of ['t021','t022','t023','t025'])assert.ok(incoming('m20').includes(id));
 for(const id of ['t050','t051','t052','t054','t055'])assert.ok(incoming('m50').includes(id));
 for(const id of ['t062','t063','t064'])assert.ok(incoming('m60').includes(id));
 assert.equal(map.get('t024').optional,true);
 assert.equal(map.get('t053').optional,true);
 assert.ok(map.get('m60').start < map.get('m70').start,'coordinated release distinct from optional follow-up');
 assert.ok(['t070','m71','t072','t073','m70'].every(id=>map.get(id).optional));
});

test('Old LPH3 remains intact and creating a historic LPH5 start shifts all dates deterministically',()=>{
 assert.equal(templates.find(t=>t.phase==='LPH3').version,'1.3');
 const source=JSON.stringify(tpl);
 const args={start:'2026-11-02',number:'2601',name:'Testprojekt',phase:'LPH5',version:'0.2',today:'2026-11-11'};
 const state=C.cloneStateForProject(tpl.state,args);
 const again=C.cloneStateForProject(tpl.state,args);
 assert.deepEqual(state,again);
 assert.equal(state.project.start,args.start);
 assert.equal(state.project.phase,'LPH5');
 assert.equal(state.tasks.length,40,'default plan ends at first coordinated issue');
 assert.ok(!state.tasks.some(t=>t.group==='g07'));
 assert.equal(state.project.planningAssumptions.includePostIssueLPH5,false);
 const chosen=C.cloneStateForProject(tpl.state,{...args,includePostIssueLPH5:true});
 assert.equal(chosen.tasks.length,45,'explicit option includes conditional follow-up');
 assert.equal(links(chosen),95);
 assert.equal(chosen.project.planningAssumptions.includePostIssueLPH5,true);
 assert.equal(P.analyze(chosen).valid,true,P.analyze(chosen).reason);
 assert.ok(state.project.end>=state.tasks.find(x=>x.id==='m60').end);
 assert.equal(P.analyze(state).valid,true,P.analyze(state).reason);
 assert.equal(E.analyze(state).errors,0);
 assert.ok(state.tasks.every(t=>t.status==='Nicht begonnen'&&t.progress===0));
 assert.equal(JSON.stringify(tpl),source,'source template is not altered');
});

test('SQL migration mirrors seed exactly; older active LPH5 remains referential but is inactivated only',()=>{
 const sql=read('supabase/migrations/20261111110000_office_lph5_template_v02.sql');
 const match=/\$tpl\$([\s\S]*?)\$tpl\$::jsonb/.exec(sql);
 assert.ok(match);
 assert.deepEqual(JSON.parse(match[1]),tpl.state);
 assert.match(sql,/on conflict \(phase,version\) do nothing/);
 assert.match(sql,/update public\.office_terminplan_templates set is_active=false/);
 assert.doesNotMatch(sql,/office_terminplan_instances|delete\s+from|truncate|drop\s+table/i);
});

test('Two-part illustrated guide has distinct LPH3 and LPH5 professional planning sections',()=>{
 const html=read('terminplan-hilfe.html');
 assert.match(html,/id="werkzeug"/);
 assert.match(html,/id="planung"/);
 assert.match(html,/id="planung-lph5"/);
 assert.match(html,/Schlitz- und Durchbruchspläne/);
 assert.match(html,/HOAI Anlage 15/);
 assert.match(html,/M07/);
 assert.ok((html.match(/<svg /g)||[]).length>=5);
 assert.ok(read('app/office-projects.js').includes('terminplan-hilfe.html'));
});
