import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {DISCUSSION_SCHEMA,toContext,validateDiscussion} from "../supabase/functions/office-terminplan-ai/core.mjs";
const require=createRequire(import.meta.url);
const E=require("../terminplan-engine.js");
const D=require("../terminplan-dialogue.js");
const original={
 project:{start:"2026-10-30",end:"2027-04-30",calendar:{nonWorkingDates:[]}},
 groups:[{id:"fach",name:"Fachplanung"}],
 tasks:[
  {id:"tga",group:"fach",name:"TGA Durchbrüche",start:"2026-11-02",end:"2026-11-16",owner:"TGA",type:"task",dependencies:[]},
  {id:"twp",group:"fach",name:"TWP Prüfrunde",start:"2026-11-16",end:"2026-11-23",owner:"TWP",type:"task",dependencies:[{pred:"tga",rel:"EA",lagDays:0}]}
 ]
};
const ctx=toContext(original,"LPH5","tga");
const edit={
 task_id:"twp",start:"2026-11-18",end:"2026-11-25",owner:"Tragwerksplanung",
 predecessors:[{task_id:"tga",relation:"EA",lag_workdays:1}]
};
test("structured output includes a bounded multi-task edit capability",()=>{
 assert.ok(DISCUSSION_SCHEMA.properties.kind.enum.includes("edit_tasks"));
 assert.ok(DISCUSSION_SCHEMA.required.includes("draft_edits"));
 const good=validateDiscussion({kind:"edit_tasks",reply:"Ändere TWP",task_id:null,offset_workdays:null,
   evidence_task_ids:["twp"],draft_tasks:[],draft_edits:[edit]},ctx,true);
 assert.equal(good.kind,"edit_tasks");
 assert.equal(validateDiscussion({kind:"edit_tasks",reply:"Ändere TWP",draft_edits:[{...edit,task_id:"not-real"}],
   evidence_task_ids:[]},ctx,true).kind,"clarify");
 assert.equal(validateDiscussion({kind:"edit_tasks",reply:"Ändere TWP",draft_edits:[edit],
   evidence_task_ids:[]},ctx,false).kind,"clarify");
});
test("multi-task preview does not mutate and requires exact revision",()=>{
 const source=D.stable(original);
 const valid=validateDiscussion({kind:"edit_tasks",reply:"TWP anpassen",evidence_task_ids:["tga","twp"],
   draft_edits:[edit]},ctx,true);
 const p=D.fromDiscussion({serverResponse:{version:"office-ai-v0.5",source:"office_ai_discussion_only",
    base_revision:2,result:valid},state:original,engine:E,revision:2,requestId:"req-edits"});
 assert.equal(p.kind,"proposal");
 assert.equal(p.proposal.kind,"edit_tasks");
 assert.equal(p.preview.edited.length,1);
 assert.equal(p.preview.edited[0].after.owner,"Tragwerksplanung");
 assert.equal(D.stable(original),source);
 assert.equal(D.review(p.proposal,original,E,2).ok,true);
 assert.equal(D.review(p.proposal,original,E,3).ok,false);
 const stale=structuredClone(original);stale.tasks[1].start="2026-11-20";
 assert.equal(D.review(p.proposal,stale,E,2).ok,false);
});
test("proposal cannot remove tasks and invalid predecessor/self-references are rejected",()=>{
 assert.throws(()=>D.previewTaskEdits(original,[{...edit,
    predecessors:[{task_id:"twp",relation:"EA",lag_workdays:0}]}],E));
 const preview=D.previewTaskEdits(original,[edit],E);
 assert.equal(preview.state.tasks.length,original.tasks.length);
 assert.equal(preview.state.tasks[0].name,"TGA Durchbrüche");
 assert.equal(preview.state.tasks[1].dependencies[0].lagDays,1);
});
