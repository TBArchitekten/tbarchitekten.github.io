import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {DISCUSSION_SCHEMA,validateDiscussion,discussionInstructions,toContext} from '../supabase/functions/office-terminplan-ai/core.mjs';
const require=createRequire(import.meta.url);
const E=require('../terminplan-engine.js');
const P=require('../terminplan-planning.js');
const D=require('../terminplan-dialogue.js');
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const base={
 project:{start:'2026-11-02',end:'2026-11-09',calendar:{nonWorkingDates:[]}},
 groups:[{id:'g',name:'Fachplanung'}],
 tasks:[
  {id:'twp',name:'TWP · Fachplanung abgeben',group:'g',owner:'TWP',
   type:'task',start:'2026-11-02',end:'2026-11-04',dependencies:[]},
  {id:'coord',name:'Koordination nach TWP',group:'g',owner:'ARC',
   type:'task',start:'2026-11-05',end:'2026-11-06',
   deadline:'2026-11-10',dependencies:[{pred:'twp',rel:'EA',lagDays:1}]},
  {id:'m',name:'M03 · Übergabe koordiniert',group:'g',owner:'Projektleitung',
   type:'milestone',start:'2026-11-06',end:'2026-11-06',
   dependencies:[{pred:'coord',rel:'EA',lagDays:0}]},
  {id:'parallel',name:'Andere parallele Leistung',group:'g',owner:'ARC',
   type:'task',start:'2026-11-02',end:'2026-11-09',dependencies:[]}
 ]
};
const incoming=(kind='simulate',task_id='twp',offset_workdays=3)=>({
 kind,reply:'Quiero comprobar el retraso de la entrega de TWP.',
 task_id,offset_workdays,evidence_task_ids:['twp'],draft_tasks:[],draft_edits:[]
});
const modelResponse=(result,base_revision=7)=>({source:'office_ai_discussion_only',version:'office-ai-v0.5',base_revision,result});

test('model offers a separate read-only simulation intent, including for viewers',()=>{
 assert.ok(DISCUSSION_SCHEMA.properties.kind.enum.includes('simulate'));
 assert.match(discussionInstructions(),/ALWAYS read-only/);
 const ctx=toContext(base,'LPH3','twp');
 const intent=validateDiscussion(incoming(),ctx,false);
 assert.equal(intent.kind,'simulate');
 assert.equal(intent.task_id,'twp');
 assert.equal(intent.offset_workdays,3);
 assert.deepEqual(validateDiscussion(incoming('simulate','unknown',3),ctx,true).kind,'clarify');
 assert.deepEqual(validateDiscussion(incoming('simulate','twp',-1),ctx,true).kind,'clarify');
 assert.deepEqual(validateDiscussion(incoming('simulate','twp',131),ctx,true).kind,'clarify');
 assert.equal(validateDiscussion({...incoming(),draft_edits:[{task_id:'twp'}]},ctx,true).kind,'clarify');
 assert.equal(validateDiscussion(incoming('shift'),ctx,false).kind,'clarify');
});

test('end-delivery delay differs from moving the whole bar, recalculates all registered successors and deadlines',()=>{
 const snapshot=JSON.stringify(base);
 assert.equal(P.analyze(base).valid,true);
 const s=P.simulateFinishDelay(base,'twp',3);
 assert.equal(s.valid,true,s.reason);
 assert.equal(s.kind,'read_only_finish_delay');
 assert.equal(s.before.start,'2026-11-02');
 assert.equal(s.after.start,'2026-11-02','original start is unchanged');
 assert.equal(s.before.end,'2026-11-04');
 assert.equal(s.after.end,'2026-11-09');
 assert.equal(s.before.projectFinish,'2026-11-09');
 assert.equal(s.after.projectFinish,'2026-11-11');
 assert.equal(s.projectFinishDeltaAT,2);
 assert.equal(s.changedSuccessors.length,2);
 assert.deepEqual(s.changedSuccessors.map(x=>x.id).sort(),['coord','m']);
 assert.equal(s.newWarnings.length,1);
 assert.equal(s.newWarnings[0].id,'coord');
 assert.equal(s.newWarnings[0].kind,'Deadline');
 assert.equal(JSON.stringify(base),snapshot,'no write to canonical task or project dates');
});

test('completed impact is an answer, not proposal, requiring no approval or server save',()=>{
 const intent=validateDiscussion(incoming(),toContext(base,'LPH3','twp'),true);
 const result=D.fromDiscussion({serverResponse:modelResponse(intent),state:base,engine:E,planning:P,revision:7,
  requestId:'what-if',userMessage:'¿Qué pasa si TWP entrega 3 días laborables más tarde?'});
 assert.equal(result.kind,'answer');
 assert.equal(result.proposal,undefined);
 assert.equal(result.simulation.valid,true);
 assert.match(result.text,/2 días laborables/);
 assert.match(result.text,/no una modificación/i);
 assert.equal(D.review(result.proposal,base,E,7).ok,false);
 assert.equal(D.fromDiscussion({serverResponse:modelResponse(intent,6),state:base,engine:E,planning:P,revision:7,
  requestId:'old'}).simulation,undefined,'stale server revision cannot simulate');
});

test('offline deterministic assistant runs the same scenario only for an explicitly identified task',()=>{
 const good=D.answer({message:'¿Qué pasa si "TWP · Fachplanung abgeben" entrega 3 días laborables más tarde?',
  state:base,engine:E,planning:P,revision:7,requestId:'fallback'});
 assert.equal(good.kind,'answer');
 assert.equal(good.simulation.valid,true);
 const ambiguous=D.answer({message:'¿Qué pasa si TWP entrega 3 días laborables más tarde?',
  state:base,engine:E,planning:P,revision:7});
 assert.equal(ambiguous.simulation,undefined,'without exact ID/title fallback must not guess');
 assert.match(ambiguous.text,/genaue Aufgabe/i);
});

test('invalid graph and unknown task never invent a critical path or scenario',()=>{
 const bad=structuredClone(base);
 bad.tasks.find(x=>x.id==='coord').dependencies=[{pred:'missing',rel:'EA',lagDays:1}];
 const s=P.simulateFinishDelay(bad,'twp',3);
 assert.equal(s.valid,false);
 assert.match(s.reason,/nicht konsistent|Unbekannter Vorgänger/i);
 assert.equal(P.simulateFinishDelay(base,'unknown',3).valid,false);
 assert.equal(P.simulateFinishDelay(base,'twp',0).valid,false);
});

test('browser wires real read-only engine to the same assistant flow; no new window or server writes',()=>{
 const html=read('terminplan.html'), dialogue=read('terminplan-dialogue.js');
 assert.match(html,/planning:window\.TBATerminplanPlanning,userMessage:prompt/);
 assert.match(html,/planning:window\.TBATerminplanPlanning,/);
 assert.match(dialogue,/kind==="simulate"/);
 assert.match(dialogue,/simulateFinishDelay/);
 assert.doesNotMatch(dialogue,/if\(intent\.kind==="simulate"\)[\s\S]{0,150}proposal=\{/);
 for(const m of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Function(m[1]);
 assert.doesNotThrow(()=>new Function(dialogue));
});
