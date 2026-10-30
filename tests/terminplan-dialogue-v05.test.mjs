import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {DISCUSSION_SCHEMA,discussionInstructions,validateDiscussion,toContext} from "../supabase/functions/office-terminplan-ai/core.mjs";
const require=createRequire(import.meta.url);
const E=require("../terminplan-engine.js");
const D=require("../terminplan-dialogue.js");
const state={project:{start:"2026-10-30",end:"2027-05-31",calendar:{nonWorkingDates:[]}},
 groups:[{id:"g02",name:"Fachplanung und Durchbruchsplanung",category:"fach"}],
 tasks:[{id:"a",group:"g02",name:"Fachplanung Arbeitsstand 01",owner:"Fachplaner",
   type:"task",start:"2026-11-02",end:"2026-11-25",category:"fach",dependencies:[]}]};
const context=toContext(state,"LPH5","a");
const draft=(name,owner)=>({name,owner,group_id:"g02",start:"2026-11-02",end:"2026-11-25",
 category:"fach",type:"task",predecessors:[{task_id:"a",relation:"AA",lag_workdays:0}]});
test("discussion contract has exact typed fields and no write tool",()=>{
 assert.equal(DISCUSSION_SCHEMA.additionalProperties,false);
 assert.deepEqual(DISCUSSION_SCHEMA.required,["kind","reply","task_id","offset_workdays","evidence_task_ids","draft_tasks","draft_edits"]);
 assert.match(discussionInstructions(),/professional architectural office|architectural office|architect/i);
 assert.match(discussionInstructions(),/discuss first/);
});
test("model context makes group and owner visible for discussion",()=>{
 assert.equal(context.groups[0].id,"g02");
 assert.equal(context.tasks[0].group_id,"g02");
 assert.equal(context.tasks[0].owner,"Fachplaner");
});
test("normal conversation and clarification stay non-mutating",()=>{
 let result=validateDiscussion({kind:"discuss",reply:"¿Trabajan en paralelo TGA y TWP?",
 task_id:null,offset_workdays:null,evidence_task_ids:[],draft_tasks:[]},context,true);
 assert.equal(result.kind,"discuss");assert.match(result.text,/TGA/);
 assert.equal(result.draft_tasks,undefined);
});
test("multi-task proposal requires a known group, actual dates and valid predecessors",()=>{
 const base={kind:"add_tasks",reply:"Propongo nuevas disciplinas.",task_id:null,offset_workdays:null,
 evidence_task_ids:["a"],draft_tasks:[draft("TGA Arbeitstand","TGA"),draft("TWP Arbeitstand","TWP")]};
 const good=validateDiscussion(base,context,true);
 assert.equal(good.kind,"add_tasks");assert.equal(good.draft_tasks.length,2);
 assert.equal(validateDiscussion({...base,draft_tasks:[{...draft("TGA Arbeitstand","TGA"),group_id:"none"}]},context,true).kind,"clarify");
 assert.equal(validateDiscussion({...base,draft_tasks:[{...draft("TGA Arbeitstand","TGA"),start:"tomorrow"}]},context,true).kind,"clarify");
 assert.equal(validateDiscussion({...base,draft_tasks:[{...draft("TGA Arbeitstand","TGA"),predecessors:[{task_id:"fake",relation:"EA",lag_workdays:0}]}]},context,true).kind,"clarify");
 assert.equal(validateDiscussion(base,context,false).kind,"clarify");
});
test("preview of new tasks is immutable and approved only against exact revision",()=>{
 const valid=validateDiscussion({kind:"add_tasks",reply:"Entwurf",task_id:null,offset_workdays:null,evidence_task_ids:["a"],
 draft_tasks:[draft("TGA Planung","TGA"),draft("TWP Planung","TWP")]},context,true);
 const before=D.stable(state);
 const result=D.fromDiscussion({serverResponse:{version:"office-ai-v0.5",source:"office_ai_discussion_only",
 base_revision:7,result:valid},state,engine:E,revision:7,requestId:"req-abc"});
 assert.equal(result.kind,"proposal");
 assert.equal(result.preview.created.length,2);
 assert.equal(result.preview.created[0].status,"Nicht begonnen");
 assert.equal(result.preview.created[1].owner,"TWP");
 assert.equal(D.stable(state),before);
 assert.equal(D.review(result.proposal,state,E,7).ok,true);
 assert.equal(D.review(result.proposal,state,E,8).ok,false);
 const edited=structuredClone(state);edited.tasks[0].end="2026-11-26";
 assert.equal(D.review(result.proposal,edited,E,7).ok,false);
 assert.equal(result.preview.newIssues.length,0);
});
test("old single-task proposals remain compatible",()=>{
 const r=D.answer({message:"Verschiebe um 5 Arbeitstage",state,engine:E,selectedTaskId:"a",revision:1,requestId:"r1"});
 assert.equal(r.kind,"proposal");assert.equal(D.review(r.proposal,state,E,1).ok,true);
});
test("AI model cannot change plan via a free discussion answer",()=>{
 const text={kind:"discuss",text:"¿Agregamos TGA, ELT, TWP?"};
 const out=D.fromDiscussion({serverResponse:{version:"office-ai-v0.5",source:"office_ai_discussion_only",base_revision:1,result:text},
 state,engine:E,revision:1,requestId:"r2"});
 assert.equal(out.kind,"answer");assert.equal(out.proposal,undefined);
});
test("Edge Function reads user-scoped history, enforces quota and stays read-only",()=>{
 const src=fs.readFileSync(new URL("../supabase/functions/office-terminplan-ai/index.ts",import.meta.url),"utf8");
 assert.match(src,/action==="discuss"/);
 assert.match(src,/office_terminplan_dialogue_messages/);
 assert.match(src,/\.eq\("user_id",auth\.user\.id\)\.eq\("plan_id",planId\)/);
 assert.match(src,/office_ai_consume_request/);
 assert.match(src,/validateDiscussion/);
 assert.doesNotMatch(src,/\bservice_role\b/i);
});
test("editor prioritizes discussion and preserves existing reviewed save",()=>{
 const html=fs.readFileSync(new URL("../terminplan.html",import.meta.url),"utf8");
 for(const m of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Function(m[1]);
 assert.match(html,/body:\{action:'discuss'/);
 assert.match(html,/dialogueEngine\.fromDiscussion/);
 assert.match(html,/dialogueProposal\.kind==='add_tasks'/);
 assert.match(html,/Technische Terminprüfung und Kalender/);
 assert.match(html,/await flushSave\(\)/);
 assert.match(html,/dialogueEngine\.receipt/);
});
