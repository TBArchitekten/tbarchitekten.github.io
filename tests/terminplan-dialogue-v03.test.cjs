"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const E=require("../terminplan-engine.js");
const D=require("../terminplan-dialogue.js");
const plan=()=>({project:{name:"Test",start:"2026-10-28",end:"2027-02-01",calendar:{nonWorkingDates:[]}},groups:[],tasks:[
{id:"a",name:"Planpaket Ausführungsplanung",type:"task",start:"2026-10-28",end:"2026-11-03",dependencies:[]},
{id:"b",name:"Fachplanung Abstimmung",type:"task",start:"2026-11-03",end:"2026-11-10",dependencies:[{pred:"a",rel:"EA",lagDays:0}]},
{id:"c",name:"Planlauf 01 abgeschlossen",type:"milestone",start:"2026-11-10",end:"2026-11-10",dependencies:[{pred:"b",rel:"EA",lagDays:0}]}]});
const ask=(message,selectedTaskId="a")=>D.answer({message,state:plan(),engine:E,selectedTaskId,revision:3,requestId:"req-test"});
test("German and Spanish questions stay read-only and scoped to registered edges",()=>{
  const de=ask("Welche Nachfolger sind betroffen?");
  const es=ask("¿Qué entregas se ven afectadas?");
  assert.equal(de.kind,"answer");assert.match(de.text,/Planlauf 01/);
  assert.match(es.text,/Fachplanung/);
});
test("proposals carry immutable origin and deterministic preview, not applied actions",()=>{
  const original=plan(),snapshot=D.stable(original);
  const result=D.answer({message:"Verschiebe um 5 Arbeitstage",state:original,engine:E,selectedTaskId:"a",revision:3,requestId:"r1"});
  assert.equal(result.kind,"proposal");
  assert.equal(result.proposal.requires_confirmation,true);
  assert.equal(result.proposal.status,"proposed");
  assert.equal(result.proposal.base_revision,3);
  assert.equal(D.stable(original),snapshot);
  const check=D.review(result.proposal,original,E,3);
  assert.equal(check.ok,true);
  assert.notEqual(D.stable(check.state),snapshot);
  assert.equal(D.review(result.proposal,original,E,4).ok,false);
  original.tasks[0].end="2026-11-04";
  assert.equal(D.review(result.proposal,original,E,3).reason,"local_plan_changed");
});
test("no invented target or conversion from calendar days",()=>{
 assert.notEqual(ask("Verschiebe 3 Tage",null).kind,"proposal");
 assert.notEqual(ask("Retrasa 7 días",null).kind,"proposal");
 assert.notEqual(ask("Verschiebe 5 Arbeitstage",null).kind,"proposal");
});
test("bounded weeks and protected date remain visible in preview audit",()=>{
 const p=plan();p.tasks[0].protectedDate="2026-11-03";
 const x=D.answer({message:"Retrasa dos semanas laborales",state:p,engine:E,selectedTaskId:"a",revision:1,requestId:"test2"});
 assert.equal(x.kind,"proposal");assert.equal(x.proposal.offset_workdays,10);
 assert.ok(x.preview.newIssues.some(i=>i.code==="protected_deadline"));
});
test("free-form unsupported claims never invent an edit",()=>{
 for(const message of ["¿Puedes revisar el presupuesto?","Rédige un email.","Borra todo."]){
   const x=ask(message);assert.equal(x.kind,"answer");assert.equal(x.proposal,undefined);
 }
});
test("server readback receipt is only verified on matching revision AND matching data",()=>{
 const p=plan(),candidate=structuredClone(p);candidate.tasks[0].end="2026-11-04";
 const common={requestId:"r1",planId:"p",baseRevision:3,expectedState:candidate};
 assert.equal(D.receipt({...common,verifiedRevision:4,observedState:structuredClone(candidate)}).status,"verified");
 assert.equal(D.receipt({...common,verifiedRevision:5,observedState:candidate}).status,"unverified");
 assert.equal(D.receipt({...common,verifiedRevision:4,observedState:p}).status,"unverified");
});
test("editor contains permission and server revision checks, real chat controls, no MINDS credentials",()=>{
 const html=fs.readFileSync(require("node:path").join(__dirname,"../terminplan.html"),"utf8");
 for(const m of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Function(m[1]);
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const missing=[...new Set([...html.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]))].filter(x=>!ids.has(x));
 assert.deepEqual(missing,[]);
 assert.match(html,/if\(!canEdit\|\|!PLAN_ID\|\|!dialogueProposal/);
 assert.match(html,/dialogueEngine\.review\(proposal,data,auditEngine,serverRevision\)/);
 assert.match(html,/select\('server_revision,state'\)/);
 assert.match(html,/verified_revision|verifiedRevision/);
 assert.match(html,/id="dialogueStream"/);
 assert.match(html,/id="dialogueApprove"/);
 assert.match(html,/terminplan-dialogue\.js/);
 assert.doesNotMatch(html,/gari01234|lodexwyyynlarkqgkyhy|isabella-chat/);
});
