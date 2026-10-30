import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import {domainLens,OFFICIAL_SOURCES,EXPERTISE_VERSION} from "../supabase/functions/office-terminplan-ai/expertise.mjs";
import {MODEL} from "../supabase/functions/office-terminplan-ai/core.mjs";
const require=createRequire(import.meta.url);
const E=require("../terminplan-engine.js");
const D=require("../terminplan-dialogue.js");
const editor=fs.readFileSync(new URL("../terminplan.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../assistant-surface.css",import.meta.url),"utf8");
const edge=fs.readFileSync(new URL("../supabase/functions/office-terminplan-ai/index.ts",import.meta.url),"utf8");
test("stronger reasoning model without MINDS runtime dependency",()=>{
 assert.equal(MODEL,"gpt-5.4");
 assert.ok(!edge.includes("gari01234")&&!edge.includes("isabella-chat"));
 assert.match(edge,/TBA_OFFICE_OPENAI_API_KEY/);
 assert.match(edge,/store:false/);
 assert.match(edge,/reasoning:\{effort:"medium"\}/);
});
test("domain lens is evidenced, phase-specific and not a mandatory template",()=>{
 assert.match(EXPERTISE_VERSION,/v0\.6/);
 assert.equal(OFFICIAL_SOURCES.length,4);
 for(const s of OFFICIAL_SOURCES){assert.ok(s.url.startsWith("https://"));assert.ok(s.title.length>15);}
 assert.match(domainLens("LPH3"),/Kostenberechnung/);
 assert.match(domainLens("LPH5"),/Durchbruchsplanung/);
 assert.doesNotMatch(domainLens("LPH3"),/always create 10 tasks/);
 assert.match(domainLens("LPH5"),/hypotheses|hypothesis|not automatic/i);
});
test("model-initiated online research is available with tracked source metadata",()=>{
 assert.match(edge,/type:"web_search"/);
 assert.match(edge,/tool_choice:"auto"/);
 assert.match(edge,/url_citation/);
 assert.match(edge,/sources\.push\(\{url:url\.href/);
 assert.match(edge,/domainLens\(plan\.phase\)/);
 assert.match(edge,/EXPERTISE_VERSION/);
});
test("proactive review never bypasses RLS and never creates a proposal",()=>{
 assert.match(edge,/action==="review"/);
 assert.match(edge,/auth\.getUser\(token\)/);
 assert.match(edge,/from\("office_members"\)/);
 assert.match(edge,/from\("office_terminplan_instances"\)/);
 assert.match(edge,/if\(action==="review"&&result\.kind!=="discuss"/);
 assert.match(edge,/office_ai_consume_request/);
 assert.match(editor,/if\(manualChange&&pendingProactiveIds\.length\)/);
 assert.match(editor,/!dialogueAIReady\|\|!\$\('#dialogueAI'\)\.checked/);
 assert.match(editor,/if\(Date\.now\(\)-lastProactiveAt<120000\)return/);
});
test("floating window does not resize the Gantt and supports collapsed/wide modes",()=>{
 assert.match(css,/position:fixed!important/);
 assert.match(css,/\.assistant-panel\.is-open/);
 assert.match(css,/\.assistant-panel\.is-wide/);
 assert.match(css,/@media print\{\.assistant-panel\{display:none!important\}\}/);
 assert.match(editor,/href="\.\/assistant-surface\.css"/);
 assert.match(editor,/id="assistantWide"/);
 assert.match(editor,/id="assistantClose"/);
 assert.match(editor,/classList\.toggle\('is-open',assistantExpanded\)/);
 assert.match(editor,/classList\.toggle\('is-wide',assistantExpanded&&assistantWide\)/);
});
test("assistant citations use safe link elements, no HTML injection",()=>{
 for(const m of editor.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Function(m[1]);
 const ids=new Set([...editor.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 const missing=[...new Set([...editor.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]))].filter(x=>!ids.has(x));
 assert.deepEqual(missing,[]);
 assert.match(editor,/url\.protocol!=='https:'/);
 assert.match(editor,/a\.rel='noopener noreferrer'/);
 assert.match(editor,/sources:Array\.isArray\(x\.event_data\?\.cited_sources\)/);
 assert.doesNotMatch(editor,/innerHTML\s*=\s*entry\.body/);
});
test("existing proposal/revision safety stays in place",()=>{
 assert.match(editor,/dialogueEngine\.review\(proposal,data,auditEngine,serverRevision\)/);
 assert.match(editor,/\.eq\('server_revision',serverRevision\)/);
 assert.match(editor,/verifiedRevision:observed\.server_revision/);
 const sample={project:{start:"2026-10-30",end:"2027-02-01"},groups:[{id:"g",name:"Planung"}],tasks:[{id:"a",name:"Existing",group:"g",start:"2026-11-01",end:"2026-11-05",dependencies:[]}]};
 const v=D.answer({message:"Verschiebe um 3 Arbeitstage",state:sample,engine:E,selectedTaskId:"a",revision:3,requestId:"r"});
 assert.equal(v.kind,"proposal");assert.equal(D.review(v.proposal,sample,E,3).ok,true);
});
