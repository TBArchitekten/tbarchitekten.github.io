import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {INTENT_SCHEMA,MODEL,validId,validMessage,validRevision,toContext,validateIntent,modelInstructions} from "../supabase/functions/office-terminplan-ai/core.mjs";
const require=createRequire(import.meta.url);
const E=require("../terminplan-engine.js");
const D=require("../terminplan-dialogue.js");
const state={project:{start:"2026-10-28",end:"2027-02-28",calendar:{nonWorkingDates:[]}},tasks:[
 {id:"a",name:"Planlauf 01",type:"task",start:"2026-10-28",end:"2026-11-06",dependencies:[]},
 {id:"b",name:"Planprüfung",type:"task",start:"2026-11-06",end:"2026-11-12",dependencies:[{pred:"a",rel:"EA",lagDays:0}]}
 ]};
const context=toContext(state,"LPH5","a");
test("strict intent schema never grants tool execution",()=>{
 assert.deepEqual(INTENT_SCHEMA.required,["kind","reply","task_id","offset_workdays","evidence_task_ids"]);
 assert.equal(INTENT_SCHEMA.additionalProperties,false);
 assert.equal(MODEL,"gpt-4.1-mini");
 assert.match(modelInstructions(),/Never claim you changed anything/);
});
test("context is minimized and excludes notes, user profiles, and secrets",()=>{
 const source=structuredClone(state);
 source.tasks[0].note="TOP SECRET NOTE";source.tasks[0].owner="Personal person";source.project.projectName="CLIENT SECRET";
 const c=toContext(source,"LPH5","a");
 const encoded=JSON.stringify(c);
 for(const sensitive of ["TOP SECRET","Personal person","CLIENT SECRET"])assert.ok(!encoded.includes(sensitive));
 assert.deepEqual(c.tasks[1].predecessors,[{task_id:"a",relation:"EA",lag_workdays:0}]);
 assert.equal(c.selected_task_id,"a");
});
test("model hallucinated identifiers cannot be accepted as action",()=>{
 const base={kind:"shift",reply:"ok",task_id:"unknown",offset_workdays:5,evidence_task_ids:[]};
 assert.equal(validateIntent(base,context,true).kind,"clarify");
 assert.equal(validateIntent({...base,task_id:"a",offset_workdays:131},context,true).kind,"clarify");
 assert.equal(validateIntent({...base,task_id:"a",offset_workdays:0},context,true).kind,"clarify");
 assert.equal(validateIntent({...base,task_id:"a",evidence_task_ids:["unknown"]},context,true).kind,"clarify");
 assert.equal(validateIntent({...base,task_id:"a",offset_workdays:5},context,false).kind,"clarify");
 const ok=validateIntent({...base,task_id:"a",offset_workdays:5},context,true);
 assert.equal(ok.kind,"shift");assert.equal(ok.offset_workdays,5);
});
test("legitimate model shift must pass local deterministic proposal/review",()=>{
 const intent=validateIntent({kind:"shift",reply:"Verschiebe Planlauf 01 um 5 Arbeitstage",task_id:"a",offset_workdays:5,evidence_task_ids:["a"]},context,true);
 const server={version:"office-ai-v0.4",source:"office_ai_interpretation_only",base_revision:8,result:intent};
 const local=D.fromModelIntent({serverResponse:server,state,engine:E,revision:8,requestId:"req-v04"});
 assert.equal(local.kind,"proposal");
 assert.equal(local.proposal.base_revision,8);
 assert.equal(D.review(local.proposal,state,E,8).ok,true);
 assert.equal(D.review(local.proposal,state,E,9).ok,false);
 assert.equal(state.tasks[0].start,"2026-10-28");
});
test("stale response and false provider return never mutate",()=>{
 const r=D.fromModelIntent({serverResponse:{version:"office-ai-v0.4",source:"office_ai_interpretation_only",base_revision:7,
 result:{kind:"shift",task_id:"a",offset_workdays:5,text:"move"}},state,engine:E,revision:8,requestId:"req"});
 assert.equal(r.kind,"answer");
 const bad=D.fromModelIntent({serverResponse:{version:"office-ai-v0.4",source:"fake",base_revision:8,
 result:{kind:"shift",task_id:"a",offset_workdays:5,text:"move"}},state,engine:E,revision:8,requestId:"req"});
 assert.equal(bad.kind,"answer");
});
test("backend requires real user authorization, plan RLS, and separate secret",()=>{
 const src=fs.readFileSync(new URL("../supabase/functions/office-terminplan-ai/index.ts",import.meta.url),"utf8");
 assert.match(src,/auth\.getUser\(token\)/);
 assert.match(src,/from\("office_members"\)/);
 assert.match(src,/from\("office_terminplan_instances"\)/);
 assert.match(src,/TBA_OFFICE_OPENAI_API_KEY/);
 assert.match(src,/store:false/);
 assert.match(src,/modelInstructions\(\)/);
 assert.match(src,/validateIntent\(JSON\.parse\(text\),context,canEdit\)/);
 assert.doesNotMatch(src,/SERVICE_ROLE|isabella|minds[_-]|OPENAI_API_KEY"\)\|\|/i);
});
test("browser exposes active, opt-in mode, preserving rules fallback",()=>{
 const html=fs.readFileSync(new URL("../terminplan.html",import.meta.url),"utf8");
 for(const m of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Function(m[1]);
 assert.match(html,/id="dialogueAI"/);
 assert.match(html,/office-terminplan-ai/);
 assert.match(html,/fromModelIntent/);
 assert.match(html,/if\(dialogueAIReady&&/);
 assert.match(html,/$('#dialogueAI')\.checked/);
 assert.match(html,/dialogueEngine\.review\(proposal,data,auditEngine,serverRevision\)/);
});
test("bounded size and identity validation",()=>{
 assert.equal(validId("db9f4a37-8ac9-491d-920c-40a566858cb4"),true);
 assert.equal(validId("../../anything"),false);
 assert.equal(validRevision(3),true);assert.equal(validRevision(0),false);
 assert.equal(validMessage("bitte auswerten"),true);assert.equal(validMessage("x".repeat(1201)),false);
});
